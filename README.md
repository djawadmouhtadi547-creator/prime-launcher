# Prime Launcher

لانشر ماينكرافت عربي: Tauri (Rust) + React + Tailwind، مع موقع Node.js لسكنات الأوفلاين.

## المتطلبات
- Node.js 18 أو أحدث
- Rust (من rustup.rs) ومتطلبات Tauri لنظامك: https://tauri.app/start/prerequisites/
- Java على جهاز اللاعب (8 / 17 / 21 حسب إصدار ماينكرافت). اللانشر يختار المناسب تلقائياً.

## التشغيل
```bash
npm install
npm run tauri:dev      # وضع التطوير
npm run tauri:build    # إنشاء ملف التثبيت
```
الأيقونات جاهزة في `src-tauri/icons`. لتوليد `icon.icns` لماك: `npm run icon` ثم أضف `icons/icon.icns` إلى `bundle.icon` في `tauri.conf.json`.

## الموقع وسيرفر السكنات
```bash
cd website && npm install && npm start     # http://localhost:3000
```
- `GET /skins/{الاسم}.png` يجلب السكن. هذا هو الرابط الذي يقرأه CustomSkinLoader.
- `PUT /api/skins/{الاسم}` يرفع PNG بمقاس 64×64 أو 64×32 مع ترويسة `X-Skin-Token`.
- ضع ملفات التثبيت داخل `website/downloads` فتظهر تلقائياً في الصفحة.
- في اللانشر: الإعدادات ← عنوان سيرفر السكنات، ثم الحسابات ← «تجهيز السكنات في اللعبة» (يتطلب Fabric).
- استخدم HTTPS في الإنتاج.

## أين تُحفظ البيانات
`%APPDATA%/PrimeLauncher` (ويندوز)، `~/Library/Application Support/PrimeLauncher` (ماك)، `~/.local/share/PrimeLauncher` (لينكس). لكل إصدار ومحرّك مجلد لعب مستقل داخل `instances/`.

## ما هو غير مشمول
- تسجيل الدخول بحساب Microsoft الأصلي (يحتاج تسجيل تطبيق في Azure)؛ الدخول الحالي أوفلاين فقط.
- محرّكات Forge وNeoForge (المدعوم Fabric).
- تنزيل Java تلقائياً.
