export const paymentLabels = {
  EFECTIVO: "Efectivo",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  QR: "QR",
  TRANSFERENCIA: "Transferencia",
};
export function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(Number(value));
}
export function apiDate(value) {
  if (!value || !/(?:Z|[+-]\d\d:\d\d)$/i.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
export function dateTime(value, { showSeconds = false } = {}) {
  if (!value) return "—";
  const date = apiDate(value);
  return date
    ? new Intl.DateTimeFormat("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        dateStyle: "short",
        timeStyle: showSeconds ? "medium" : "short",
        hourCycle: "h23",
      }).format(date)
    : `${String(value).replace("T", " ")} · fecha histórica sin zona confirmada`;
}
export function elapsedInfo(value, now, courtesy) {
  const date = apiDate(value);
  if (!date) return null;
  const elapsed = Math.max(0, now - date.getTime());
  return {
    minutes: Math.floor(elapsed / 60000),
    inCourtesy:
      Number.isSafeInteger(courtesy) && courtesy >= 0
        ? elapsed <= courtesy * 60000
        : null,
  };
}
export function stayElapsedInfo(stay, now) {
  const knownOrigin = ["INGRESO", "HEREDADO_CONFIG_ACTUAL"].includes(
    stay.origen_cortesia,
  );
  const courtesy = knownOrigin ? stay.cortesia_minutos : null;
  const elapsed = elapsedInfo(stay.fecha_entrada, now, courtesy);
  if (!elapsed) return null;
  return {
    ...elapsed,
    courtesyOrigin:
      elapsed.inCourtesy === null ? "DESCONOCIDO" : stay.origen_cortesia,
  };
}
export function errorMessage(
  error,
  fallback = "No pudimos completar la solicitud.",
) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return (
      detail
        .map((item) => item.msg)
        .filter(Boolean)
        .join("; ") || fallback
    );
  return detail?.message || fallback;
}
