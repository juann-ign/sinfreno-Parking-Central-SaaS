// Standard Argentine plates: DNRPA Dispositions 411/2015 and 40/2016.
// https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-40-2016-258787/texto
const carFormats = {
  pattern: "(?:[A-Z]{3}[0-9]{3}|[A-Z]{2}[0-9]{3}[A-Z]{2})",
  examples: "ABC123 o AB123CD",
  placeholder: "AB123CD",
};
const motorcycleFormats = {
  pattern: "(?:[0-9]{3}[A-Z]{3}|[A-Z][0-9]{3}[A-Z]{3})",
  examples: "123ABC o A123BCD",
  placeholder: "A123BCD",
};

export function plateFormat(category) {
  if (category === "AUTO" || category === "CAMIONETA") return carFormats;
  if (category === "MOTO") return motorcycleFormats;
  return undefined;
}

export function normalizePlate(value) {
  // Accept separators when pasting a plate, but keep invalid characters visible.
  return value.replace(/[a-z]/g, (letter) => letter.toUpperCase()).replace(/[\s-]/g, "");
}

export function isValidPlate(plate, category) {
  const format = plateFormat(category);
  return Boolean(format && new RegExp(`^${format.pattern}$`).test(plate));
}
