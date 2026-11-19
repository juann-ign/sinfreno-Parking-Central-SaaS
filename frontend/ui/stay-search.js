import { normalizePlate } from "./plate.js";

export function searchActiveStays(stays, term) {
  const query = term.trim().toUpperCase();
  if (!query) return { matches: stays, exact: null };
  const ticket = /^(?:SF-|#)([0-9]+)$/.exec(query);
  if (ticket) {
    const exact = stays.find((stay) => String(stay.id) === ticket[1]) || null;
    return { matches: exact ? [exact] : [], exact };
  }
  const plate = normalizePlate(query);
  const matches = plate ? stays.filter((stay) => stay.patente.includes(plate)) : [];
  return { matches, exact: matches.find((stay) => stay.patente === plate) || null };
}
