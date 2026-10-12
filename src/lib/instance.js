// كل إصدار + محرّك له مجلد لعب مستقل (مودات وإعدادات منفصلة)
// يجب أن يطابق الصيغة المستخدمة في main.rs: "{version}-{loader}"
export function instanceId(version, loader) {
  return `${version || 'default'}-${loader || 'vanilla'}`;
}
