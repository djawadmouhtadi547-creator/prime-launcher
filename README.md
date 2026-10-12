<div align="center">

<img src="assets/banner.svg" alt="Prime Launcher" width="100%" />

<br />

![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?style=flat-square&logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-engine-b7410e?style=flat-square&logo=rust&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Platform](https://img.shields.io/badge/Windows-10%20%7C%2011-0078D6?style=flat-square&logo=windows&logoColor=white)

### [⬇ تحميل آخر إصدار](../../releases/latest)

</div>

<div dir="rtl">

## ما هو Prime Launcher؟

لانشر ماينكرافت **عربي بالكامل**، خفيف وسريع. واجهته من اليمين لليسار وتصميمه مستوحى من خانات المخزون داخل اللعبة، بألوان هادئة بدون إضاءات مزعجة.

## المميزات

- 🎮 **تشغيل بنقرة واحدة:** يحمّل اللعبة والمكتبات ويختار نسخة Java المناسبة تلقائياً
- 🧩 **مودات جاهزة:** بحث وتثبيت من Modrinth وCurseForge مع الاعتمادات المطلوبة (مثل Fabric API)
- 👤 **دخول أوفلاين:** اكتب اسمك فقط وابدأ اللعب
- 🧍 **سكنات خاصة:** عرض ثلاثي الأبعاد ورفع سكنك ليراه اللاعبون على سيرفرك
- 🎚️ **تحكم بالذاكرة:** شريط RAM من 1 إلى 16 GB
- 🎨 **تخصيص المظهر:** ألوان هوية وخلفيات جاهزة أو بلون تختاره
- 📁 **مجلد مستقل لكل إصدار:** المودات والإعدادات لا تتداخل بين الإصدارات
- 🪶 **حجم صغير:** مبني على Tauri بدل Electron

## التثبيت

1. افتح صفحة [**Releases**](../../releases/latest)
2. نزّل ملف `Prime Launcher_..._setup.exe`
3. شغّله وأكمل التثبيت
4. ثبّت [Java](https://adoptium.net) إذا لم تكن عندك (يُفضّل 17 أو 21)

## كيف أستخدمه؟

1. من **الحسابات** أضف اسم لاعبك
2. من **الرئيسية** اختر إصدار ماينكرافت والذاكرة
3. اضغط **PLAY**

لتشغيل المودات: اختر المحرّك **Fabric** ثم افتح صفحة **المودات** وثبّت ما تريد.

## الأسئلة الشائعة

<details>
<summary>هل يعمل مع السيرفرات الرسمية؟</summary>

الدخول حالياً أوفلاين فقط، فيعمل مع السيرفرات التي تسمح بالأوفلاين وفي اللعب الفردي. للسيرفرات الرسمية تحتاج نسخة أصلية، وتسجيل حساب Microsoft غير مدعوم بعد.
</details>

<details>
<summary>يقول «تعذّر تشغيل Java»</summary>

ثبّت Java 17 أو 21، أو حدّد مساره من **الإعدادات**. الإصدار 1.20.5 وما بعده يحتاج Java 21، و1.17 إلى 1.20.4 يحتاج Java 17.
</details>

<details>
<summary>هل يدعم Forge؟</summary>

لا، المدعوم حالياً المحرّك العادي وFabric.
</details>

<details>
<summary>أين تُحفظ ملفات اللعبة؟</summary>

في `%APPDATA%\PrimeLauncher`، ومودات كل إصدار داخل `instances`.
</details>

## للمطورين

<details>
<summary>بناء المشروع وتشغيله</summary>

**المتطلبات:** Node.js 18+ و[Rust](https://rustup.rs) وعلى ويندوز [C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

```bash
npm install
npm run tauri:dev      # تطوير
npm run tauri:build    # إنشاء ملف التثبيت
```

**سيرفر السكنات والموقع:**

```bash
cd website && npm install && npm start
```

ثم اضبط عنوانه في اللانشر من **الإعدادات ← عنوان سيرفر السكنات**.

**الهيكل:** واجهة React في `src/`، ومحرّك Rust في `src-tauri/src/main.rs`، والموقع في `website/`.
</details>

## ملاحظة

Minecraft علامة تجارية لشركة Mojang Studios. هذا المشروع غير تابع لها ولا مدعوم منها.

</div>
