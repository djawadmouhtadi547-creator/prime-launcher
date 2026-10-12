// Prime Launcher - محرّك التشغيل (Rust)
// يتولى: تنزيل ملفات ماينكرافت، بناء أمر Java، الدخول الأوفلاين، المودات، والسكنات.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};

const LAUNCHER_NAME: &str = "PrimeLauncher";
const LAUNCHER_VERSION: &str = "1.0.0";
const MANIFEST_URL: &str = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const LIBRARIES_URL: &str = "https://libraries.minecraft.net/";
const ASSETS_URL: &str = "https://resources.download.minecraft.net/";

// ───────────────────────── الأنواع ─────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LaunchRequest {
    version: String,
    loader: String,
    username: String,
    uuid: String,
    access_token: String,
    ram_mb: u32,
    #[serde(default)]
    java_path: String,
    #[serde(default)]
    extra_jvm_args: String,
    width: Option<u32>,
    height: Option<u32>,
    #[serde(default)]
    fullscreen: bool,
}

#[derive(Serialize)]
struct LaunchResult {
    command: String,
    pid: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VersionEntry {
    id: String,
    #[serde(rename = "type")]
    kind: String,
    release_time: String,
}

#[derive(Serialize, Clone)]
struct Progress {
    stage: String,
    label: String,
    current: usize,
    total: usize,
}

#[derive(Serialize, Clone)]
struct JavaInfo {
    path: String,
    version: String,
    major: u32,
}

#[derive(Serialize)]
struct ModFile {
    name: String,
    size: u64,
}

struct DlTask {
    url: String,
    path: PathBuf,
    size: u64,
}

struct NativeJar {
    path: PathBuf,
    exclude: Vec<String>,
}

struct LibPlan {
    classpath: Vec<PathBuf>,
    natives: Vec<NativeJar>,
    downloads: Vec<DlTask>,
}

struct Prepared {
    java: String,
    args: Vec<String>,
    game_dir: PathBuf,
}

// ───────────────────────── مسارات ومساعدات ─────────────────────────

fn root_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("PrimeLauncher")
}

fn clean_id(s: &str) -> String {
    let c: String = s
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '.' | '_'))
        .collect();
    if c.is_empty() || c.starts_with('.') {
        "default".to_string()
    } else {
        c
    }
}

fn instance_dir(instance: &str) -> PathBuf {
    root_dir().join("instances").join(clean_id(instance))
}

fn s(p: &Path) -> String {
    p.to_string_lossy().to_string()
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(format!("{LAUNCHER_NAME}/{LAUNCHER_VERSION}"))
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())
}

fn emit_progress(app: &AppHandle, stage: &str, label: &str, current: usize, total: usize) {
    let _ = app.emit(
        "progress",
        Progress {
            stage: stage.to_string(),
            label: label.to_string(),
            current,
            total,
        },
    );
}

fn validate_name(n: &str) -> Result<(), String> {
    let ok = (3..=16).contains(&n.len()) && n.chars().all(|c| c.is_ascii_alphanumeric() || c == '_');
    if ok {
        Ok(())
    } else {
        Err("اسم اللاعب يجب أن يكون من 3 إلى 16 حرفاً إنجليزياً أو رقماً أو _".to_string())
    }
}

// ───────────────────────── UUID الأوفلاين ─────────────────────────
// نفس خوارزمية UUID.nameUUIDFromBytes("OfflinePlayer:" + name) في Java:
// MD5 للاسم ثم ضبط بتات الإصدار (3) والمتغيّر (RFC 4122).

fn offline_uuid_of(name: &str) -> String {
    let mut b = md5::compute(format!("OfflinePlayer:{name}")).0;
    b[6] = (b[6] & 0x0f) | 0x30;
    b[8] = (b[8] & 0x3f) | 0x80;
    let h: String = b.iter().map(|x| format!("{x:02x}")).collect();
    format!(
        "{}-{}-{}-{}-{}",
        &h[0..8],
        &h[8..12],
        &h[12..16],
        &h[16..20],
        &h[20..32]
    )
}

// ───────────────────────── الشبكة والتنزيل ─────────────────────────

async fn fetch_json(client: &reqwest::Client, url: &str) -> Result<Value, String> {
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("تعذّر الاتصال بالخادم ({url}): {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("ردّ الخادم برمز {} للعنوان {url}", resp.status()));
    }
    resp.json::<Value>()
        .await
        .map_err(|e| format!("استجابة غير صالحة من {url}: {e}"))
}

async fn download_once(client: &reqwest::Client, url: &str, dest: &Path) -> Result<(), String> {
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("تعذّر تنزيل {url}: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("ردّ الخادم برمز {} أثناء تنزيل {url}", resp.status()));
    }
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("انقطع التنزيل ({url}): {e}"))?;
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }
    let tmp = PathBuf::from(format!("{}.part", dest.display()));
    tokio::fs::write(&tmp, &bytes)
        .await
        .map_err(|e| e.to_string())?;
    tokio::fs::rename(&tmp, dest)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

async fn download_file(client: &reqwest::Client, url: &str, dest: &Path) -> Result<(), String> {
    let mut last = String::new();
    for attempt in 0..3u64 {
        match download_once(client, url, dest).await {
            Ok(()) => return Ok(()),
            Err(e) => {
                last = e;
                tokio::time::sleep(Duration::from_millis(400 * (attempt + 1))).await;
            }
        }
    }
    Err(last)
}

fn is_valid(t: &DlTask) -> bool {
    match std::fs::metadata(&t.path) {
        Ok(m) => m.is_file() && (t.size == 0 || m.len() == t.size),
        Err(_) => false,
    }
}

async fn download_all(
    app: &AppHandle,
    client: &reqwest::Client,
    stage: &str,
    label: &str,
    tasks: Vec<DlTask>,
) -> Result<(), String> {
    let pending: Vec<DlTask> = tasks.into_iter().filter(|t| !is_valid(t)).collect();
    let total = pending.len();
    if total == 0 {
        return Ok(());
    }
    emit_progress(app, stage, label, 0, total);

    let done = Arc::new(AtomicUsize::new(0));
    let client = client.clone();
    let app = app.clone();
    let stage = stage.to_string();
    let label = label.to_string();

    let mut stream = futures_util::stream::iter(pending.into_iter().map(move |t| {
        let client = client.clone();
        let app = app.clone();
        let done = done.clone();
        let stage = stage.clone();
        let label = label.clone();
        async move {
            let r = download_file(&client, &t.url, &t.path).await;
            let n = done.fetch_add(1, Ordering::SeqCst) + 1;
            if n == total || n % 10 == 0 {
                emit_progress(&app, &stage, &label, n, total);
            }
            r
        }
    }))
    .buffer_unordered(12);

    while let Some(r) = stream.next().await {
        r?;
    }
    Ok(())
}

// ───────────────────────── قواعد النظام (rules) ─────────────────────────

fn os_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    }
}

fn arch_ok(arch: &str) -> bool {
    match arch {
        "x86" => cfg!(target_arch = "x86"),
        "arm64" | "aarch64" => cfg!(target_arch = "aarch64"),
        "x86_64" | "amd64" => cfg!(target_arch = "x86_64"),
        _ => true,
    }
}

fn rules_allow(rules: Option<&Value>, features: &HashMap<&str, bool>) -> bool {
    let arr = match rules.and_then(|r| r.as_array()) {
        Some(a) if !a.is_empty() => a,
        _ => return true,
    };
    let mut allowed = false;
    for rule in arr {
        let action = rule["action"].as_str().unwrap_or("allow");
        let mut matches_rule = true;
        if let Some(os) = rule.get("os") {
            if let Some(n) = os.get("name").and_then(|v| v.as_str()) {
                if n != os_name() {
                    matches_rule = false;
                }
            }
            if let Some(a) = os.get("arch").and_then(|v| v.as_str()) {
                if !arch_ok(a) {
                    matches_rule = false;
                }
            }
        }
        if let Some(f) = rule.get("features").and_then(|v| v.as_object()) {
            for (k, v) in f {
                let want = v.as_bool().unwrap_or(false);
                let have = features.get(k.as_str()).copied().unwrap_or(false);
                if have != want {
                    matches_rule = false;
                }
            }
        }
        if matches_rule {
            allowed = action == "allow";
        }
    }
    allowed
}

fn build_features(req: &LaunchRequest) -> HashMap<&'static str, bool> {
    let mut f = HashMap::new();
    f.insert(
        "has_custom_resolution",
        req.width.is_some() && req.height.is_some(),
    );
    f.insert("is_demo_user", false);
    f
}

fn subst(input: &str, vars: &HashMap<String, String>) -> String {
    let mut out = input.to_string();
    for (k, v) in vars {
        out = out.replace(&format!("${{{k}}}"), v);
    }
    out
}

fn collect_args(
    list: Option<&Value>,
    features: &HashMap<&str, bool>,
    vars: &HashMap<String, String>,
) -> Vec<String> {
    let mut out = Vec::new();
    if let Some(arr) = list.and_then(|v| v.as_array()) {
        for item in arr {
            if let Some(text) = item.as_str() {
                out.push(subst(text, vars));
            } else if rules_allow(item.get("rules"), features) {
                match item.get("value") {
                    Some(Value::String(text)) => out.push(subst(text, vars)),
                    Some(Value::Array(values)) => {
                        for x in values {
                            if let Some(text) = x.as_str() {
                                out.push(subst(text, vars));
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    }
    out
}

// ───────────────────────── المكتبات ─────────────────────────

fn maven_path(name: &str) -> Option<String> {
    let (coords, ext) = match name.split_once('@') {
        Some((c, e)) => (c, e),
        None => (name, "jar"),
    };
    let p: Vec<&str> = coords.split(':').collect();
    if p.len() < 3 {
        return None;
    }
    let group = p[0].replace('.', "/");
    let (artifact, version) = (p[1], p[2]);
    let classifier = if p.len() > 3 {
        format!("-{}", p[3])
    } else {
        String::new()
    };
    Some(format!(
        "{group}/{artifact}/{version}/{artifact}-{version}{classifier}.{ext}"
    ))
}

fn lib_key(name: &str) -> String {
    let base = name.split('@').next().unwrap_or(name);
    let p: Vec<&str> = base.split(':').collect();
    if p.len() > 3 {
        format!("{}:{}:{}", p[0], p[1], p[3])
    } else if p.len() >= 2 {
        format!("{}:{}", p[0], p[1])
    } else {
        name.to_string()
    }
}

fn plan_libraries(libs: &[Value], libdir: &Path, features: &HashMap<&str, bool>) -> LibPlan {
    let mut plan = LibPlan {
        classpath: Vec::new(),
        natives: Vec::new(),
        downloads: Vec::new(),
    };
    let mut seen: HashSet<String> = HashSet::new();

    for lib in libs {
        if !rules_allow(lib.get("rules"), features) {
            continue;
        }
        let name = lib["name"].as_str().unwrap_or("");
        let key = lib_key(name);

        // (المسار، الرابط، الحجم)
        let mut artifact: Option<(String, String, u64)> = None;
        if let Some(a) = lib.pointer("/downloads/artifact") {
            let path = a["path"]
                .as_str()
                .map(|p| p.to_string())
                .or_else(|| maven_path(name));
            if let Some(path) = path {
                let url = a["url"].as_str().unwrap_or("").to_string();
                artifact = Some((path, url, a["size"].as_u64().unwrap_or(0)));
            }
        } else if lib.get("downloads").is_none() && lib.get("natives").is_none() {
            // مكتبات Fabric: اسم Maven + عنوان المستودع
            if let Some(path) = maven_path(name) {
                let base = lib["url"].as_str().unwrap_or(LIBRARIES_URL);
                let base = if base.ends_with('/') {
                    base.to_string()
                } else {
                    format!("{base}/")
                };
                artifact = Some((path.clone(), format!("{base}{path}"), 0));
            }
        }

        if let Some((path, url, size)) = artifact {
            if seen.insert(key) {
                let full = libdir.join(&path);
                if !url.is_empty() {
                    plan.downloads.push(DlTask {
                        url,
                        path: full.clone(),
                        size,
                    });
                }
                plan.classpath.push(full);
            }
        }

        // مكتبات natives القديمة (≤ 1.18)
        if let Some(n) = lib
            .get("natives")
            .and_then(|n| n.get(os_name()))
            .and_then(|v| v.as_str())
        {
            let arch = if cfg!(target_pointer_width = "64") { "64" } else { "32" };
            let classifier = n.replace("${arch}", arch);
            if let Some(c) = lib.pointer(&format!("/downloads/classifiers/{classifier}")) {
                if let (Some(path), Some(url)) = (c["path"].as_str(), c["url"].as_str()) {
                    let full = libdir.join(path);
                    plan.downloads.push(DlTask {
                        url: url.to_string(),
                        path: full.clone(),
                        size: c["size"].as_u64().unwrap_or(0),
                    });
                    let exclude = lib
                        .pointer("/extract/exclude")
                        .and_then(|v| v.as_array())
                        .map(|a| {
                            a.iter()
                                .filter_map(|x| x.as_str().map(|t| t.to_string()))
                                .collect::<Vec<String>>()
                        })
                        .unwrap_or_default();
                    plan.natives.push(NativeJar {
                        path: full,
                        exclude,
                    });
                }
            }
        }
    }
    plan
}

fn extract_natives(jar: &Path, dest: &Path, exclude: &[String]) -> Result<(), String> {
    let file = std::fs::File::open(jar).map_err(|e| format!("تعذّر فتح {}: {e}", jar.display()))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        if entry.is_dir() {
            continue;
        }
        let name = entry.name().to_string();
        if name.starts_with("META-INF") || exclude.iter().any(|e| name.starts_with(e.as_str())) {
            continue;
        }
        let file_name = match Path::new(&name).file_name() {
            Some(f) => f.to_owned(),
            None => continue,
        };
        let mut out = std::fs::File::create(dest.join(file_name)).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ───────────────────────── ملفات الإصدارات ─────────────────────────

async fn load_manifest(client: &reqwest::Client, root: &Path) -> Result<Value, String> {
    let cache = root.join("version_manifest.json");
    match fetch_json(client, MANIFEST_URL).await {
        Ok(v) => {
            let _ = tokio::fs::create_dir_all(root).await;
            let _ = tokio::fs::write(&cache, v.to_string()).await;
            Ok(v)
        }
        Err(e) => {
            if let Ok(text) = tokio::fs::read_to_string(&cache).await {
                if let Ok(v) = serde_json::from_str::<Value>(&text) {
                    return Ok(v);
                }
            }
            Err(e)
        }
    }
}

async fn get_vanilla_json(client: &reqwest::Client, root: &Path, id: &str) -> Result<Value, String> {
    let path = root.join("versions").join(id).join(format!("{id}.json"));
    if let Ok(text) = tokio::fs::read_to_string(&path).await {
        if let Ok(v) = serde_json::from_str::<Value>(&text) {
            return Ok(v);
        }
    }
    let manifest = load_manifest(client, root).await?;
    let url = manifest["versions"]
        .as_array()
        .and_then(|a| a.iter().find(|v| v["id"] == id))
        .and_then(|v| v["url"].as_str())
        .ok_or_else(|| format!("الإصدار {id} غير موجود في قائمة ماينكرافت"))?
        .to_string();
    let v = fetch_json(client, &url).await?;
    if let Some(parent) = path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    let _ = tokio::fs::write(&path, v.to_string()).await;
    Ok(v)
}

fn cached_fabric(root: &Path, mc: &str) -> Option<Value> {
    let suffix = format!("-{mc}");
    for e in std::fs::read_dir(root.join("versions")).ok()?.flatten() {
        let n = e.file_name().to_string_lossy().to_string();
        if n.starts_with("fabric-loader-") && n.ends_with(&suffix) {
            let text = std::fs::read_to_string(e.path().join(format!("{n}.json"))).ok()?;
            return serde_json::from_str(&text).ok();
        }
    }
    None
}

async fn get_fabric_json(client: &reqwest::Client, root: &Path, mc: &str) -> Result<Value, String> {
    let list = match fetch_json(
        client,
        &format!("https://meta.fabricmc.net/v2/versions/loader/{mc}"),
    )
    .await
    {
        Ok(l) => l,
        Err(e) => {
            return cached_fabric(root, mc).ok_or(e);
        }
    };
    let arr = list
        .as_array()
        .filter(|a| !a.is_empty())
        .ok_or_else(|| format!("محرّك Fabric غير متوفر للإصدار {mc}"))?;
    let entry = arr
        .iter()
        .find(|e| e["loader"]["stable"].as_bool() == Some(true))
        .unwrap_or(&arr[0]);
    let loader = entry["loader"]["version"]
        .as_str()
        .ok_or("استجابة Fabric غير مكتملة")?
        .to_string();
    let id = format!("fabric-loader-{loader}-{mc}");
    let path = root.join("versions").join(&id).join(format!("{id}.json"));
    if let Ok(text) = tokio::fs::read_to_string(&path).await {
        if let Ok(v) = serde_json::from_str::<Value>(&text) {
            return Ok(v);
        }
    }
    let v = fetch_json(
        client,
        &format!("https://meta.fabricmc.net/v2/versions/loader/{mc}/{loader}/profile/json"),
    )
    .await?;
    if let Some(parent) = path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    let _ = tokio::fs::write(&path, v.to_string()).await;
    Ok(v)
}

fn merge_versions(parent: Value, child: Value) -> Value {
    let mut out = parent.clone();
    if let (Some(o), Some(c)) = (out.as_object_mut(), child.as_object()) {
        for (k, v) in c {
            match k.as_str() {
                "inheritsFrom" => {}
                "libraries" => {
                    let mut libs = v.as_array().cloned().unwrap_or_default();
                    libs.extend(parent["libraries"].as_array().cloned().unwrap_or_default());
                    o.insert(k.clone(), Value::Array(libs));
                }
                "arguments" => {
                    let mut args = serde_json::Map::new();
                    for part in ["game", "jvm"] {
                        let mut list = parent["arguments"][part]
                            .as_array()
                            .cloned()
                            .unwrap_or_default();
                        list.extend(v[part].as_array().cloned().unwrap_or_default());
                        args.insert(part.to_string(), Value::Array(list));
                    }
                    o.insert(k.clone(), Value::Object(args));
                }
                _ => {
                    o.insert(k.clone(), v.clone());
                }
            }
        }
    }
    out
}

// ───────────────────────── Java ─────────────────────────

fn parse_major(v: &str) -> u32 {
    let mut parts = v.split(|c: char| c == '.' || c == '_' || c == '-' || c == '+');
    let first: u32 = parts.next().and_then(|x| x.parse().ok()).unwrap_or(0);
    if first == 1 {
        parts.next().and_then(|x| x.parse().ok()).unwrap_or(8)
    } else {
        first
    }
}

async fn java_info(path: &str) -> Result<JavaInfo, String> {
    let mut cmd = tokio::process::Command::new(path);
    cmd.arg("-version");
    #[cfg(windows)]
    {
        cmd.creation_flags(0x0800_0000);
    }
    let out = cmd.output().await.map_err(|e| e.to_string())?;
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stderr),
        String::from_utf8_lossy(&out.stdout)
    );
    let version = text
        .split('"')
        .nth(1)
        .ok_or("لم يُعثر على رقم إصدار Java في المخرجات")?
        .to_string();
    let major = parse_major(&version);
    Ok(JavaInfo {
        path: path.to_string(),
        version,
        major,
    })
}

fn candidate_java_paths() -> Vec<String> {
    let exe = if cfg!(windows) { "java.exe" } else { "java" };
    let mut roots: Vec<PathBuf> = Vec::new();
    if cfg!(windows) {
        for base in [
            "C:\\Program Files\\Java",
            "C:\\Program Files\\Eclipse Adoptium",
            "C:\\Program Files\\Microsoft",
            "C:\\Program Files\\Zulu",
            "C:\\Program Files\\BellSoft",
            "C:\\Program Files\\Amazon Corretto",
            "C:\\Program Files (x86)\\Java",
        ] {
            roots.push(PathBuf::from(base));
        }
    } else if cfg!(target_os = "macos") {
        roots.push(PathBuf::from("/Library/Java/JavaVirtualMachines"));
    } else {
        roots.push(PathBuf::from("/usr/lib/jvm"));
    }

    let mut found = Vec::new();
    if let Ok(home) = std::env::var("JAVA_HOME") {
        let j = Path::new(&home).join("bin").join(exe);
        if j.exists() {
            found.push(s(&j));
        }
    }
    for r in roots {
        if let Ok(rd) = std::fs::read_dir(&r) {
            for e in rd.flatten() {
                let mut p = e.path();
                if cfg!(target_os = "macos") {
                    p = p.join("Contents").join("Home");
                }
                let j = p.join("bin").join(exe);
                if j.exists() {
                    found.push(s(&j));
                }
            }
        }
    }
    found
}

async fn all_javas() -> Vec<JavaInfo> {
    let mut cands = vec!["java".to_string()];
    cands.extend(candidate_java_paths());
    let mut out: Vec<JavaInfo> = Vec::new();
    for c in cands {
        if let Ok(info) = java_info(&c).await {
            if !out.iter().any(|o| o.path == info.path) {
                out.push(info);
            }
        }
    }
    out
}

async fn find_suitable_java(required: u32) -> Option<String> {
    let found = all_javas().await;
    if let Some(i) = found.iter().find(|i| i.major == required) {
        return Some(i.path.clone());
    }
    found
        .iter()
        .filter(|i| i.major >= required)
        .min_by_key(|i| i.major)
        .map(|i| i.path.clone())
}

// ───────────────────────── تجهيز أمر التشغيل ─────────────────────────

async fn prepare(app: &AppHandle, req: &LaunchRequest) -> Result<Prepared, String> {
    validate_name(&req.username)?;
    if !(512..=65536).contains(&req.ram_mb) {
        return Err("قيمة الذاكرة خارج المدى المسموح (512 ميغابايت إلى 64 غيغابايت)".to_string());
    }
    if req.loader != "vanilla" && req.loader != "fabric" {
        return Err("محرّك غير مدعوم".to_string());
    }
    let mc = req.version.trim().to_string();
    if mc.is_empty() {
        return Err("لم يتم اختيار إصدار".to_string());
    }

    let client = http_client()?;
    let root = root_dir();
    let game_dir = instance_dir(&format!("{}-{}", mc, req.loader));
    tokio::fs::create_dir_all(&game_dir)
        .await
        .map_err(|e| e.to_string())?;
    if req.loader == "fabric" {
        let _ = tokio::fs::create_dir_all(game_dir.join("mods")).await;
    }

    // 1) ملف الإصدار
    emit_progress(app, "meta", "جلب معلومات الإصدار", 0, 0);
    let vanilla = get_vanilla_json(&client, &root, &mc).await?;
    let (ver, final_id) = if req.loader == "fabric" {
        let fabric = get_fabric_json(&client, &root, &mc).await?;
        let id = fabric["id"].as_str().unwrap_or("fabric").to_string();
        (merge_versions(vanilla, fabric), id)
    } else {
        (vanilla, mc.clone())
    };

    // 2) Java
    emit_progress(app, "java", "فحص Java", 0, 0);
    let has_requirement = ver.pointer("/javaVersion/majorVersion").is_some();
    let required = ver
        .pointer("/javaVersion/majorVersion")
        .and_then(|v| v.as_u64())
        .unwrap_or(8) as u32;
    let java = if req.java_path.trim().is_empty() {
        find_suitable_java(required)
            .await
            .unwrap_or_else(|| "java".to_string())
    } else {
        req.java_path.trim().to_string()
    };
    let info = java_info(&java).await.map_err(|e| {
        format!("تعذّر تشغيل Java ({java}): {e}. ثبّت Java {required} أو أحدث، أو حدّد مساره من الإعدادات.")
    })?;
    if has_requirement && info.major < required {
        return Err(format!(
            "هذا الإصدار يحتاج Java {required} أو أحدث، والمتوفر Java {}. حدّد مساراً صحيحاً من الإعدادات.",
            info.major
        ));
    }

    // 3) ملف اللعبة
    let jar_path = root.join("versions").join(&mc).join(format!("{mc}.jar"));
    let client_dl = &ver["downloads"]["client"];
    let jar_url = client_dl["url"]
        .as_str()
        .ok_or("بيانات تنزيل اللعبة غير موجودة في ملف الإصدار")?;
    download_all(
        app,
        &client,
        "client",
        "تنزيل ملف اللعبة",
        vec![DlTask {
            url: jar_url.to_string(),
            path: jar_path.clone(),
            size: client_dl["size"].as_u64().unwrap_or(0),
        }],
    )
    .await?;

    // 4) المكتبات
    let libdir = root.join("libraries");
    let features = build_features(req);
    let libs = ver["libraries"].as_array().cloned().unwrap_or_default();
    let plan = plan_libraries(&libs, &libdir, &features);
    download_all(app, &client, "libraries", "تنزيل المكتبات", plan.downloads).await?;

    // 5) الأصول (أصوات، لغات...)
    let asset_index = &ver["assetIndex"];
    let index_id = asset_index["id"]
        .as_str()
        .or_else(|| ver["assets"].as_str())
        .unwrap_or("legacy")
        .to_string();
    let assets_root = root.join("assets");
    let index_path = assets_root.join("indexes").join(format!("{index_id}.json"));
    let index_url = asset_index["url"]
        .as_str()
        .ok_or("فهرس الأصول غير موجود في ملف الإصدار")?;
    download_all(
        app,
        &client,
        "assets-index",
        "تنزيل فهرس الأصول",
        vec![DlTask {
            url: index_url.to_string(),
            path: index_path.clone(),
            size: asset_index["size"].as_u64().unwrap_or(0),
        }],
    )
    .await?;
    let index_text = tokio::fs::read_to_string(&index_path)
        .await
        .map_err(|e| e.to_string())?;
    let index: Value = serde_json::from_str(&index_text).map_err(|e| e.to_string())?;
    let objects = index["objects"].as_object().ok_or("فهرس الأصول تالف")?;
    let objects_dir = assets_root.join("objects");

    let mut asset_tasks: Vec<DlTask> = Vec::new();
    let mut seen_hashes: HashSet<String> = HashSet::new();
    for (_name, obj) in objects {
        if let Some(hash) = obj["hash"].as_str() {
            if hash.len() >= 2 && seen_hashes.insert(hash.to_string()) {
                let prefix = &hash[..2];
                asset_tasks.push(DlTask {
                    url: format!("{ASSETS_URL}{prefix}/{hash}"),
                    path: objects_dir.join(prefix).join(hash),
                    size: obj["size"].as_u64().unwrap_or(0),
                });
            }
        }
    }
    download_all(app, &client, "assets", "تنزيل الأصول", asset_tasks).await?;

    // إصدارات قديمة جداً تحتاج نسخة "virtual" أو مجلد resources
    let is_virtual = index["virtual"].as_bool().unwrap_or(false);
    let map_resources = index["map_to_resources"].as_bool().unwrap_or(false);
    let mut game_assets = assets_root.clone();
    if is_virtual || map_resources {
        let target = if map_resources {
            game_dir.join("resources")
        } else {
            assets_root.join("virtual").join(&index_id)
        };
        for (name, obj) in objects {
            if let Some(hash) = obj["hash"].as_str() {
                if hash.len() < 2 {
                    continue;
                }
                let src = objects_dir.join(&hash[..2]).join(hash);
                let dst = target.join(name);
                if !dst.exists() {
                    if let Some(parent) = dst.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                    let _ = std::fs::copy(&src, &dst);
                }
            }
        }
        game_assets = target;
    }

    // 6) ملفات natives
    emit_progress(app, "natives", "تجهيز ملفات النظام", 0, 0);
    let natives_dir = root.join("versions").join(&final_id).join("natives");
    let _ = std::fs::remove_dir_all(&natives_dir);
    std::fs::create_dir_all(&natives_dir).map_err(|e| e.to_string())?;
    for nj in &plan.natives {
        extract_natives(&nj.path, &natives_dir, &nj.exclude)?;
    }

    // 7) classpath
    let sep = if cfg!(windows) { ";" } else { ":" };
    let mut cp: Vec<String> = plan.classpath.iter().map(|p| s(p)).collect();
    cp.push(s(&jar_path));
    let classpath = cp.join(sep);

    // 8) المتغيّرات: --username --uuid --accessToken --gameDir ...
    let vars: HashMap<String, String> = [
        ("auth_player_name", req.username.clone()),
        ("version_name", final_id.clone()),
        ("game_directory", s(&game_dir)),
        ("assets_root", s(&assets_root)),
        ("assets_index_name", index_id.clone()),
        ("auth_uuid", req.uuid.replace('-', "")),
        ("auth_access_token", req.access_token.clone()),
        (
            "auth_session",
            format!("token:{}:{}", req.access_token, req.uuid.replace('-', "")),
        ),
        ("clientid", String::new()),
        ("auth_xuid", String::new()),
        ("user_type", "legacy".to_string()),
        (
            "version_type",
            ver["type"].as_str().unwrap_or("release").to_string(),
        ),
        ("user_properties", "{}".to_string()),
        ("game_assets", s(&game_assets)),
        ("natives_directory", s(&natives_dir)),
        ("launcher_name", LAUNCHER_NAME.to_string()),
        ("launcher_version", LAUNCHER_VERSION.to_string()),
        ("classpath", classpath.clone()),
        ("classpath_separator", sep.to_string()),
        ("library_directory", s(&libdir)),
        ("resolution_width", req.width.unwrap_or(854).to_string()),
        ("resolution_height", req.height.unwrap_or(480).to_string()),
    ]
    .into_iter()
    .map(|(k, v)| (k.to_string(), v))
    .collect();

    let (json_jvm, mut game_args) = if ver.get("arguments").is_some() {
        (
            collect_args(ver.pointer("/arguments/jvm"), &features, &vars),
            collect_args(ver.pointer("/arguments/game"), &features, &vars),
        )
    } else {
        (
            vec![
                format!("-Djava.library.path={}", s(&natives_dir)),
                "-cp".to_string(),
                classpath.clone(),
            ],
            ver["minecraftArguments"]
                .as_str()
                .unwrap_or("")
                .split_whitespace()
                .map(|a| subst(a, &vars))
                .collect(),
        )
    };
    if req.fullscreen {
        game_args.push("--fullscreen".to_string());
    }

    // 9) الأمر النهائي
    let ram = req.ram_mb;
    let mut args: Vec<String> = vec![
        format!("-Xmx{ram}M"),
        format!("-Xms{}M", (ram / 2).max(512).min(ram)),
        "-XX:+UseG1GC".to_string(),
        "-XX:MaxGCPauseMillis=100".to_string(),
        "-Dfile.encoding=UTF-8".to_string(),
    ];
    args.extend(json_jvm);
    args.extend(req.extra_jvm_args.split_whitespace().map(|a| a.to_string()));
    args.push(
        ver["mainClass"]
            .as_str()
            .ok_or("ملف الإصدار لا يحدد الكلاس الرئيسي")?
            .to_string(),
    );
    args.extend(game_args);

    Ok(Prepared {
        java,
        args,
        game_dir,
    })
}

// ───────────────────────── أوامر Tauri ─────────────────────────

#[tauri::command]
fn get_root_path() -> String {
    s(&root_dir())
}

#[tauri::command]
fn offline_uuid(name: String) -> Result<String, String> {
    validate_name(&name)?;
    Ok(offline_uuid_of(&name))
}

#[tauri::command]
async fn list_versions() -> Result<Vec<VersionEntry>, String> {
    let client = http_client()?;
    let manifest = load_manifest(&client, &root_dir()).await?;
    let list = manifest["versions"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|v| {
                    let id = v["id"].as_str()?.to_string();
                    Some(VersionEntry {
                        id,
                        kind: v["type"].as_str().unwrap_or("").to_string(),
                        release_time: v["releaseTime"].as_str().unwrap_or("").to_string(),
                    })
                })
                .collect::<Vec<VersionEntry>>()
        })
        .unwrap_or_default();
    Ok(list)
}

#[tauri::command]
async fn detect_java() -> Vec<JavaInfo> {
    all_javas().await
}

#[tauri::command]
async fn launch_game(app: AppHandle, req: LaunchRequest) -> Result<LaunchResult, String> {
    let prep = prepare(&app, &req).await?;
    emit_progress(&app, "launch", "تشغيل اللعبة", 0, 0);

    let mut cmd = tokio::process::Command::new(&prep.java);
    cmd.args(&prep.args)
        .current_dir(&prep.game_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        cmd.creation_flags(0x0800_0000);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("تعذّر تشغيل Java: {e}"))?;
    let pid = child.id().unwrap_or(0);

    if let Some(out) = child.stdout.take() {
        let app2 = app.clone();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(out).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app2.emit("game_log", line);
            }
        });
    }
    if let Some(err) = child.stderr.take() {
        let app2 = app.clone();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(err).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app2.emit("game_log", line);
            }
        });
    }

    // إذا أُغلقت اللعبة خلال ثوانٍ فهذا يعني فشلاً في التشغيل
    if let Ok(Ok(status)) = tokio::time::timeout(Duration::from_millis(2500), child.wait()).await {
        let code = status.code().unwrap_or(-1);
        let _ = app.emit("game_exit", code);
        return Err(format!(
            "أُغلقت اللعبة فور التشغيل (رمز الخروج {code}). راجع سجل اللعبة في الصفحة الرئيسية."
        ));
    }

    let app3 = app.clone();
    tauri::async_runtime::spawn(async move {
        let code = child
            .wait()
            .await
            .ok()
            .and_then(|st| st.code())
            .unwrap_or(-1);
        let _ = app3.emit("game_exit", code);
    });

    let command = std::iter::once(prep.java.clone())
        .chain(prep.args.iter().cloned())
        .map(|a| if a.contains(' ') { format!("\"{a}\"") } else { a })
        .collect::<Vec<String>>()
        .join(" ");

    Ok(LaunchResult { command, pid })
}

// طلبات GET إلى Modrinth و CurseForge فقط (تتجاوز قيود CORS وتسمح بإرسال x-api-key)
#[tauri::command]
async fn api_get(url: String, headers: Option<HashMap<String, String>>) -> Result<String, String> {
    let allowed = ["https://api.modrinth.com/", "https://api.curseforge.com/"];
    if !allowed.iter().any(|p| url.starts_with(p)) {
        return Err("عنوان غير مسموح".to_string());
    }
    let client = http_client()?;
    let mut rb = client.get(&url).header("Accept", "application/json");
    if let Some(h) = headers {
        for (k, v) in h {
            rb = rb.header(k, v);
        }
    }
    let resp = rb.send().await.map_err(|e| format!("تعذّر الاتصال: {e}"))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        let short: String = text.chars().take(200).collect();
        return Err(format!("خطأ {status}: {short}"));
    }
    Ok(text)
}

fn valid_jar_name(name: &str) -> bool {
    let plain = Path::new(name)
        .file_name()
        .and_then(|n| n.to_str())
        .map(|n| n == name)
        .unwrap_or(false);
    plain
        && !name.starts_with('.')
        && !name.contains(':')
        && name.to_lowercase().ends_with(".jar")
}

#[tauri::command]
async fn download_mod(instance: String, url: String, file_name: String) -> Result<String, String> {
    let hosts = [
        "https://cdn.modrinth.com/",
        "https://edge.forgecdn.net/",
        "https://mediafilez.forgecdn.net/",
        "https://media.forgecdn.net/",
    ];
    if !hosts.iter().any(|p| url.starts_with(p)) {
        return Err("مصدر التنزيل غير مسموح".to_string());
    }
    if !valid_jar_name(&file_name) {
        return Err("اسم ملف غير صالح".to_string());
    }
    let dest = instance_dir(&instance).join("mods").join(&file_name);
    let client = http_client()?;
    download_file(&client, &url, &dest).await?;
    Ok(s(&dest))
}

#[tauri::command]
fn list_mods(instance: String) -> Result<Vec<ModFile>, String> {
    let dir = instance_dir(&instance).join("mods");
    let mut out = Vec::new();
    if let Ok(rd) = std::fs::read_dir(&dir) {
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            if name.to_lowercase().ends_with(".jar") {
                let size = e.metadata().map(|m| m.len()).unwrap_or(0);
                out.push(ModFile { name, size });
            }
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

#[tauri::command]
fn delete_mod(instance: String, file_name: String) -> Result<(), String> {
    if !valid_jar_name(&file_name) {
        return Err("اسم ملف غير صالح".to_string());
    }
    let path = instance_dir(&instance).join("mods").join(&file_name);
    std::fs::remove_file(path).map_err(|e| e.to_string())
}

// يكتب إعداد CustomSkinLoader ليجلب السكنات من سيرفرك: {server}/skins/{USERNAME}.png
#[tauri::command]
fn setup_skin_loader(instance: String, skin_server: String) -> Result<String, String> {
    let server = skin_server.trim().trim_end_matches('/').to_string();
    if !(server.starts_with("http://") || server.starts_with("https://")) {
        return Err("عنوان سيرفر السكنات يجب أن يبدأ بـ http:// أو https://".to_string());
    }
    let dir = instance_dir(&instance).join("CustomSkinLoader");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let config = json!({
        "enable": true,
        "loadlist": [
            {
                "name": "PrimeSkins",
                "type": "Legacy",
                "checkPNG": false,
                "skin": format!("{server}/skins/{{USERNAME}}.png"),
                "cape": format!("{server}/capes/{{USERNAME}}.png"),
                "model": "auto"
            },
            { "name": "Mojang", "type": "MojangAPI" }
        ],
        "enableDynamicSkull": true,
        "enableTransparentSkin": true,
        "ignoreHttpsCertificate": false,
        "forceLoadAllTextures": false,
        "cacheExpiry": 30,
        "enableUpdateSkull": false,
        "enableLocalProfileCache": false,
        "enableCacheAutoClean": false,
        "forceDisableCache": false
    });
    let path = dir.join("CustomSkinLoader.json");
    let text = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&path, text).map_err(|e| e.to_string())?;
    Ok(s(&path))
}

#[tauri::command]
fn open_folder(kind: String, instance: String) -> Result<(), String> {
    let dir = match kind.as_str() {
        "mods" => instance_dir(&instance).join("mods"),
        "instance" => instance_dir(&instance),
        _ => root_dir(),
    };
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let program = if cfg!(target_os = "windows") {
        "explorer"
    } else if cfg!(target_os = "macos") {
        "open"
    } else {
        "xdg-open"
    };
    std::process::Command::new(program)
        .arg(&dir)
        .spawn()
        .map_err(|e| format!("تعذّر فتح المجلد: {e}"))?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_root_path,
            offline_uuid,
            list_versions,
            detect_java,
            launch_game,
            api_get,
            download_mod,
            list_mods,
            delete_mod,
            setup_skin_loader,
            open_folder
        ])
        .run(tauri::generate_context!())
        .expect("حدث خطأ أثناء تشغيل Prime Launcher");
}
