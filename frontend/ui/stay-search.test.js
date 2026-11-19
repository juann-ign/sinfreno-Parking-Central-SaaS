import test from "node:test";
import assert from "node:assert/strict";
import { searchActiveStays } from "./stay-search.js";

const stays = [{ id: 23, patente: "SF123CD" }, { id: 230, patente: "DEMO123" }];

test("printed codes and ticket numbers match the entire active stay ID", () => {
  for (const term of ["sf-23", " #23 "]) {
    assert.deepEqual(searchActiveStays(stays, term), { matches: [stays[0]], exact: stays[0] });
  }
  assert.deepEqual(searchActiveStays(stays, "SF-2"), { matches: [], exact: null });
  assert.deepEqual(searchActiveStays([], "#23"), { matches: [], exact: null });
});

test("partial plates filter without selecting a vehicle for checkout", () => {
  for (const term of ["", "123"]) {
    assert.deepEqual(searchActiveStays(stays, term), { matches: stays, exact: null });
  }
  assert.deepEqual(searchActiveStays(stays, "demo"), { matches: [stays[1]], exact: null });
  assert.equal(searchActiveStays(stays, "sf-123-cd").exact, stays[0]);
  assert.equal(searchActiveStays(stays, "demo123").exact, stays[1]);
});
