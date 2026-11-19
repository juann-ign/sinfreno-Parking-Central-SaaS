import test from "node:test";
import assert from "node:assert/strict";
import { isValidPlate, normalizePlate } from "./plate.js";

test("accepts old and Mercosur plates for the selected vehicle category", () => {
  for (const category of ["AUTO", "CAMIONETA"]) {
    for (const plate of ["ABC123", "AB123CD", "AAA000", "ZZ999ZZ"]) {
      assert.equal(isValidPlate(plate, category), true, `${category}: ${plate}`);
    }
  }
  for (const plate of ["123ABC", "A123BCD", "000AAA", "Z999ZZZ"]) {
    assert.equal(isValidPlate(plate, "MOTO"), true, plate);
  }
});

test("rejects incomplete, malformed and category-mismatched plates", () => {
  for (const category of ["AUTO", "CAMIONETA", "MOTO"]) {
    for (const plate of ["", "A", "AB123", "123456", "ABCDEFG", "AB12CDE", "ABC1234", "ABC!123", "ÁBC123", "АBC123", "AB123CDX"]) {
      assert.equal(isValidPlate(plate, category), false, `${category}: ${plate}`);
    }
  }
  assert.equal(isValidPlate("ABC123", "MOTO"), false);
  assert.equal(isValidPlate("AB123CD", "MOTO"), false);
  assert.equal(isValidPlate("123ABC", "AUTO"), false);
  assert.equal(isValidPlate("A123BCD", "CAMIONETA"), false);
  assert.equal(isValidPlate("ABC123", "UNKNOWN"), false);
  assert.equal(isValidPlate("undefined", "toString"), false);
});

test("normalizes keyboard and pasted separators without hiding invalid characters", () => {
  assert.equal(normalizePlate("ab 123 cd"), "AB123CD");
  assert.equal(normalizePlate(" abc-123 "), "ABC123");
  assert.equal(normalizePlate("a 123 bcd"), "A123BCD");
  assert.equal(normalizePlate("abc!123"), "ABC!123");
  assert.equal(isValidPlate(normalizePlate("ß123ab"), "AUTO"), false);
});
