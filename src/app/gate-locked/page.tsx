// Заглушка для запросов без site-gate: middleware подменяет ею любую страницу,
// а форму пароля рисует SiteGate из корневого layout.
export default function GateLockedPage() {
  return null;
}
