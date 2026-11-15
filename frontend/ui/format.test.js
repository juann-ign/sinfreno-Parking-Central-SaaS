import test from "node:test";
import assert from "node:assert/strict";
import { apiDate, dateTime, elapsedInfo, money, stayElapsedInfo } from "./format.js";

test("legacy dates are labelled instead of silently acquiring UTC", () => {
  assert.equal(apiDate("2026-11-11T12:00:00"), null);
  assert.match(dateTime("2026-11-11T12:00:00"), /sin zona confirmada/);
  assert.equal(
    apiDate("2026-11-11T09:00:00-03:00").toISOString(),
    "2026-11-11T12:00:00.000Z",
  );
});
test("the operative courtesy badge preserves zero and exact inclusive boundary", () => {
  const value = "2026-11-11T12:00:00Z";
  const start = Date.parse(value);
  assert.equal(elapsedInfo(value, start + 1, 0).inCourtesy, false);
  assert.equal(elapsedInfo(value, start + 600000, 10).inCourtesy, true);
  assert.equal(elapsedInfo(value, start + 600001, 10).inCourtesy, false);
  assert.equal(elapsedInfo("2026-11-11T12:00:00", start, 10), null);
});
test("the active stay indicator uses its entry courtesy after branch configuration changes", () => {
  const stay = {
    fecha_entrada: "2026-11-11T12:00:00Z",
    cortesia_minutos: 10,
    origen_cortesia: "INGRESO",
  };
  const cutoff = Date.parse(stay.fecha_entrada) + 15 * 60000;
  // La configuración actual no participa del indicador de esta estadía.
  const configuredCourtesy = 20;
  assert.equal(elapsedInfo(stay.fecha_entrada, cutoff, configuredCourtesy).inCourtesy, true);
  assert.deepEqual(stayElapsedInfo(stay, cutoff), {
    minutes: 15,
    inCourtesy: false,
    courtesyOrigin: "INGRESO",
  });
  assert.equal(stayElapsedInfo({ ...stay, cortesia_minutos: 0 }, cutoff).inCourtesy, false);
  assert.equal(stayElapsedInfo({ ...stay, cortesia_minutos: 0 }, Date.parse(stay.fecha_entrada)).inCourtesy, true);
});
test("legacy courtesy remains explicitly current while unavailable or invalid metadata stays unknown", () => {
  const stay = {
    fecha_entrada: "2026-11-11T12:00:00Z",
    cortesia_minutos: 20,
    origen_cortesia: "HEREDADO_CONFIG_ACTUAL",
  };
  const cutoff = Date.parse(stay.fecha_entrada) + 15 * 60000;
  assert.deepEqual(stayElapsedInfo(stay, cutoff), {
    minutes: 15,
    inCourtesy: true,
    courtesyOrigin: "HEREDADO_CONFIG_ACTUAL",
  });
  for (const invalid of [
    { cortesia_minutos: null },
    { cortesia_minutos: undefined },
    { cortesia_minutos: -1 },
    { cortesia_minutos: "20" },
    { cortesia_minutos: true },
    { origen_cortesia: undefined },
    { origen_cortesia: "DESCONOCIDO" },
    { origen_cortesia: "INGRESO_INVALIDO" },
  ]) {
    assert.deepEqual(stayElapsedInfo({ ...stay, ...invalid }, cutoff), {
      minutes: 15,
      inCourtesy: null,
      courtesyOrigin: "DESCONOCIDO",
    });
  }
  assert.equal(stayElapsedInfo({ ...stay, fecha_entrada: "2026-11-11T12:00:00" }, cutoff), null);
});
test("zero and fractional monetary strings remain visible with two decimal places", () => {
  assert.match(money("0.00"), /0,00/);
  assert.match(money("1000.50"), /1\.000,50/);
  assert.equal(money(null), "—");
});
