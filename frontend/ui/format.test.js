import test from "node:test";
import assert from "node:assert/strict";
import { apiDate, dateTime, elapsedInfo, money } from "./format.js";

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
test("zero and fractional monetary strings remain visible with two decimal places", () => {
  assert.match(money("0.00"), /0,00/);
  assert.match(money("1000.50"), /1\.000,50/);
  assert.equal(money(null), "—");
});
