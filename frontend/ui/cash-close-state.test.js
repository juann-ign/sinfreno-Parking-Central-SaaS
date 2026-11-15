import test from "node:test";
import assert from "node:assert/strict";
import { createAttemptStore } from "../api/attempt-store.js";
import {
  acknowledgeCashCloseState,
  cashCloseConfirmation,
  cashCloseNeedsReview,
  cashCloseStateCheck,
  cashFinancialFingerprint,
  checkCashClose,
  createCashCloseState,
  setCashCloseIntent,
  syncCashCloseState,
} from "./cash-close-state.js";

const original = {
  id: 7,
  estado: "ABIERTA",
  origen_datos: "UTC_POR_TURNO",
  revision_cierre: "a".repeat(64),
  fondo_inicial: "0.00",
  recaudacion_total: "1000.00",
  monto_esperado: "1000.00",
  totales_por_medio: { EFECTIVO: "1000.00", QR: "0.00" },
};
const open = (value) => ({ status: "open", value, error: "" });
const counting = () => setCashCloseIntent(createCashCloseState(original), {
  amount: "1000,00",
  notes: "Billetes contados por Ana",
});
const charged = {
  ...original,
  revision_cierre: "b".repeat(64),
  recaudacion_total: "1500.00",
  monto_esperado: "1500.00",
  totales_por_medio: { EFECTIVO: "1500.00", QR: "0.00" },
};

test("an external charge updates the selected turn and retains the count until explicit review", () => {
  const before = counting();
  const state = syncCashCloseState(before, open(charged));
  assert.equal(state.cash.monto_esperado, "1500.00");
  assert.equal(state.amount, "1000,00");
  assert.equal(state.notes, "Billetes contados por Ana");
  assert.equal(cashCloseNeedsReview(state), true);
  assert.equal(cashCloseConfirmation(state), null);
  const confirmed = cashCloseConfirmation(acknowledgeCashCloseState(state));
  assert.deepEqual(confirmed, {
    cashId: 7,
    fingerprint: cashFinancialFingerprint(charged),
    amount: "1000.00",
    notes: "Billetes contados por Ana",
  });
  assert.equal(before.cash, original);
});

test("each further financial change requires another acknowledgement, even when totals return", () => {
  let state = syncCashCloseState(counting(), open(charged));
  state = acknowledgeCashCloseState(state);
  state = syncCashCloseState(state, open(original));
  assert.equal(cashCloseNeedsReview(state), true);
  assert.equal(cashCloseConfirmation(state), null);
  state = syncCashCloseState(state, open(charged));
  assert.equal(cashCloseNeedsReview(state), true);
  assert.equal(cashCloseConfirmation(state), null);
  assert.equal(cashCloseNeedsReview(acknowledgeCashCloseState(state)), false);
});

test("noncash income also requires review when expected cash stays the same", () => {
  const qrCharge = {
    ...original,
    revision_cierre: "c".repeat(64),
    recaudacion_total: "2000.00",
    totales_por_medio: { EFECTIVO: "1000.00", QR: "1000.00" },
  };
  const state = syncCashCloseState(counting(), open(qrCharge));
  assert.equal(state.cash.monto_esperado, original.monto_esperado);
  assert.equal(cashCloseNeedsReview(state), true);
  assert.equal(cashCloseConfirmation(state), null);
});

test("external closure or another open turn blocks closing and never replaces the chosen ID", () => {
  for (const cashState of [
    { status: "closed", value: null },
    open({ ...original, estado: "CERRADA" }),
    open({ ...charged, id: 8 }),
  ]) {
    const state = syncCashCloseState(counting(), cashState);
    assert.equal(state.selectedId, 7);
    assert.equal(state.cash.id, 7);
    assert.equal(state.amount, "1000,00");
    assert.equal(state.notes, "Billetes contados por Ana");
    assert.equal(cashCloseStateCheck(state).allowed, false);
    assert.equal(cashCloseConfirmation(state), null);
    assert.equal(acknowledgeCashCloseState(state), state);
  }
  const replaced = syncCashCloseState(counting(), open({ ...charged, id: 8 }));
  assert.equal(replaced.cash, original);
  assert.equal(cashCloseStateCheck(replaced).code, "replaced");
});

test("loading, failed and incomplete refreshes block a new close while preserving the last selected totals", () => {
  const known = acknowledgeCashCloseState(syncCashCloseState(counting(), open(charged)));
  for (const cashState of [
    { status: "loading", value: charged },
    { status: "error", value: null, error: "Sin conexión" },
    { status: "open", value: null },
    undefined,
  ]) {
    const state = syncCashCloseState(known, cashState);
    assert.equal(state.cash, charged);
    assert.equal(state.amount, known.amount);
    assert.equal(state.notes, known.notes);
    assert.equal(cashCloseConfirmation(state), null);
    assert.equal(acknowledgeCashCloseState(state), state);
    // Repeated unavailable renders must settle instead of causing a render loop.
    assert.equal(syncCashCloseState(state, cashState), state);
    const recovered = syncCashCloseState(state, open(charged));
    assert.equal(cashCloseNeedsReview(recovered), false);
    assert.equal(cashCloseConfirmation(recovered).cashId, 7);
  }
});

test("fresh confirmation check detects charges, replacement, closure and missing revision before creating an attempt", () => {
  const confirmation = cashCloseConfirmation(counting());
  assert.equal(checkCashClose(confirmation, open(original)).allowed, true);
  for (const [cashState, code] of [
    [open(charged), "changed"],
    [open({ ...original, id: 8 }), "replaced"],
    [open({ ...original, estado: "CERRADA" }), "closed"],
    [{ status: "closed", value: null }, "closed"],
    [{ status: "error", value: null }, "unavailable"],
    [{ status: "loading", value: original }, "loading"],
    [open({ ...original, revision_cierre: undefined }), "unavailable"],
    [open({ ...original, origen_datos: "LEGACY" }), "legacy"],
  ]) {
    const check = checkCashClose(confirmation, cashState);
    assert.equal(check.allowed, false);
    assert.equal(check.code, code);
    assert.ok(check.reason.length);
  }
});

test("financial fingerprint ignores formatting and notes but includes every payment total and server revision", () => {
  const reformatted = {
    ...original,
    notas: "Una nota distinta",
    fondo_inicial: 0,
    monto_esperado: "01000.000",
    totales_por_medio: { QR: 0, EFECTIVO: "1000.0" },
  };
  assert.equal(cashFinancialFingerprint(original), cashFinancialFingerprint(reformatted));
  assert.notEqual(cashFinancialFingerprint(original), cashFinancialFingerprint({
    ...original,
    totales_por_medio: { ...original.totales_por_medio, TRANSFERENCIA: "10.00" },
  }));
  assert.notEqual(cashFinancialFingerprint(original), cashFinancialFingerprint({
    ...original,
    revision_cierre: "d".repeat(64),
  }));
});

test("an uncertain close keeps its immutable key, ID, count, notes and revision after another turn opens", () => {
  const entries = new Map();
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
  const store = createAttemptStore(storage, "admin/branch1", () => "original-close-key");
  const confirmation = cashCloseConfirmation(counting());
  const request = {
    url: `/cash/${confirmation.cashId}/cerrar`,
    body: {
      monto_real: confirmation.amount,
      notas: confirmation.notes,
      revision_cierre: original.revision_cierre,
    },
  };
  store.begin("CAJA_CERRAR", request);
  const blocked = syncCashCloseState(counting(), open({ ...charged, id: 8 }));
  assert.equal(cashCloseConfirmation(blocked), null);
  const reloaded = createAttemptStore(storage, "admin/branch1", () => "new-key");
  const pending = reloaded.read("CAJA_CERRAR");
  assert.equal(pending.key, "original-close-key");
  assert.deepEqual(pending.request, request);
  assert.throws(() => reloaded.begin("CAJA_CERRAR", {
    url: "/cash/8/cerrar",
    body: { monto_real: "0.00" },
  }), /pendiente/);
  assert.deepEqual(reloaded.read("CAJA_CERRAR"), pending);
});
