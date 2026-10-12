<div align="center">

# Prime Launcher

**لانشر ماينكرافت عربي، خفيف ومبني على Tauri**

واجهة عربية كاملة (RTL) · دخول أوفلاين · مودات Modrinth وCurseForge · سكنات خاصة بسيرفرك

</div>

---

## المميزات

| الميزة | التفاصيل |
|---|---|
| **تشغيل اللعبة** | تنزيل اللعبة والمكتبات والأصول تلقائياً، واختيار نسخة Java المناسبة (8 / 17 / 21) |
| **الإصدارات** | كل إصدارات ماينكرافت الرسمية والتجريبية، مع محرّك عادي أو Fabric |
| **الذاكرة** | شريط RAM من 1 إلى 16 GB مع اختيارات سريعة |
| **الحسابات** | دخول أوفلاين بالاسم فقط، مع UUID مطابق لخوارزمية ماينكرافت (MD5) |
| **المودات** | بحث وتنزيل من Modrinth وCurseForge إلى مجلد `mods`، مع تثبيت الاعتمادات الإجبارية |
| **السكنات** | عرض ثلاثي الأبعاد، رفع PNG، وتجهيز CustomSkinLoader بنقرة |
| **المظهر** | ألوان هوية وخلفيات جاهزة أو مخصصة، وخطوط عربية محلية تعمل بدون إنترنت |
| **مجلدات مستقلة** | لكل إصدار ومحرّك مجلد لعب خاص (مودات وإعدادات منفصلة) |

## هيكل المشروع

```
prime-launcher/
├── src/                    واجهة React
│   ├── App.jsx             الهيكل الرئيسي والتنقل
│   ├── components/         الصفحات والمكوّنات
│   ├── services/           modrinth.js · curseforge.js · skins.js
│   └── lib/                الجسر مع Rust، التخزين، الثيمات
├── src-tauri/              محرّك Rust
│   ├── src/main.rs         التنزيل، أمر Java، الأوفلاين، المودات
│   ├── tauri.conf.json     إعدادات التطبيق
│   └── capabilities/       صلاحيات النافذة
├── website/                موقع Node.js + سيرفر السكنات
└── tools/make_icons.py     مولّد الأيقونات
```

## التشغيل على جهازك

**المتطلبات**
- [Node.js](https://nodejs.org) 18 أو أحدث
- [Rust](https://rustup.rs)
- على ويندوز: [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (حمل العمل Desktop development with C++)
- Java على جهاز اللاعب (يختار اللانشر النسخة المناسبة تلقائياً)

```bash
npm install
npm run tauri:dev       # وضع التطوير
npm run tauri:build     # إنشاء ملف التثبيت
```

الأيقونات جاهزة في `src-tauri/icons`. لتوليد `icon.icns` لماك شغّل `npm run icon`، ثم أضف `icons/icon.icns` إلى `bundle.icon` في `tauri.conf.json`.

## البناء أونلاين بدون تثبيت Rust (GitHub Actions)

أنشئ الملف `.github/workflows/build.yml`:

```yaml
name: Build Prime Launcher
on:
  workflow_dispatch:
  push:
    branches: [main]

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri
      - run: npm install
      - run: npm run tauri:build
      - uses: actions/upload-artifact@v4
        with:
          name: prime-launcher-windows
          path: |
            src-tauri/target/release/bundle/nsis/*.exe
            src-tauri/target/release/bundle/msi/*.msi
```

ثم من تبويب **Actions** شغّل **Build Prime Launcher**، ونزّل ملف التثبيت من قسم **Artifacts** بعد انتهاء البناء.

## الموقع وسيرفر السكنات

```bash
cd website
npm install
npm start               # http://localhost:3000
```

| المسار | الوظيفة |
|---|---|
| `GET /skins/{الاسم}.png` | يجلب السكن (الرابط الذي يقرأه CustomSkinLoader) |
| `GET /capes/{الاسم}.png` | يجلب الرداء |
| `PUT /api/skins/{الاسم}` | يرفع PNG بمقاس 64×64 أو 64×32 مع ترويسة `X-Skin-Token` |
| `DELETE /api/skins/{الاسم}` | يحذف السكن بنفس الرمز |
| `GET /api/downloads` | يسرد الملفات الموجودة في `website/downloads` |

**ربط اللانشر بسيرفرك**
1. شغّل الموقع على استضافة عليها HTTPS.
2. في اللانشر: **الإعدادات** ← **عنوان سيرفر السكنات**.
3. **الحسابات** ← ارفع السكن ← **تجهيز السكنات في اللعبة** (يتطلب محرّك Fabric).

ضع ملف التثبيت داخل `website/downloads` ليظهر زر التنزيل في الصفحة تلقائياً.

> الأسماء في وضع الأوفلاين غير محمية، لذلك يولّد اللانشر رمزاً سرياً لكل اسم ويحجزه السيرفر لأول جهاز يرفع به. حذف بيانات المتصفح أو اللانشر يفقدك الرمز.

## أماكن حفظ البيانات

| النظام | المسار |
|---|---|
| ويندوز | `%APPDATA%\PrimeLauncher` |
| ماك | `~/Library/Application Support/PrimeLauncher` |
| لينكس | `~/.local/share/PrimeLauncher` |

المودات في `instances/<الإصدار>-<المحرّك>/mods`.

## مفتاح CurseForge

CurseForge يحتاج مفتاح API مجانياً من [console.curseforge.com](https://console.curseforge.com). ضعه في **الإعدادات**، ويبقى على جهازك فقط. Modrinth لا يحتاج مفتاحاً.

## حل المشاكل الشائعة

| المشكلة | الحل |
|---|---|
| `cargo metadata ... program not found` | Rust غير مثبّت أو لم يدخل PATH. ثبّته وأغلق PowerShell وافتح نافذة جديدة |
| `npm install` ينقطع بـ `ECONNRESET` | انقل المشروع خارج Downloads، وأوقف VPN، وزد `fetch-retries` |
| «تعذّر تشغيل Java» | ثبّت Java 17 أو 21، أو حدّد مساره من الإعدادات |
| «هذا الإصدار يحتاج Java N» | 1.20.5 وما بعده يحتاج Java 21، و1.17 إلى 1.20.4 يحتاج 17 |
| أُغلقت اللعبة فور التشغيل | راجع «سجل اللعبة» في الصفحة الرئيسية |
| المود لا يعمل | تأكد أن المحرّك Fabric وأن نسخة المود تطابق إصدار اللعبة |

## غير مشمول حالياً

- تسجيل الدخول بحساب Microsoft الأصلي (يحتاج تسجيل تطبيق في Azure)
- محرّكا Forge وNeoForge (المدعوم Fabric)
- تنزيل Java تلقائياً

## ملاحظة قانونية

Minecraft علامة تجارية لشركة Mojang Studios. هذا المشروع غير تابع لها ولا مدعوم منها. للعب على السيرفرات الرسمية والأونلاين تحتاج نسخة أصلية من اللعبة.
