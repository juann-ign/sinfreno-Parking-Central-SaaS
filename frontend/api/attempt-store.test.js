import test from "node:test";
import assert from "node:assert/strict";
import {
  createAttemptStore,
  keepAttemptAfterFailure,
} from "./attempt-store.js";

function storage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}
test("uncertain checkout survives reload with exactly the same key, quote, stay and cash", () => {
  const data = storage();
  const first = createAttemptStore(
    data,
    "operator@demo/branch1",
    () => "one-key",
  );
  const request = {
    url: "/parking/25/salida",
    body: { cotizacion_id: "quote-A", caja_id: 7, metodo_pago: "EFECTIVO" },
  };
  first.begin("SALIDA", request);
  const reloaded = createAttemptStore(
    data,
    "operator@demo/branch1",
    () => "another-key",
  );
  assert.deepEqual(reloaded.read("SALIDA").request, request);
  assert.equal(reloaded.read("SALIDA").key, "one-key");
  assert.throws(
    () =>
      reloaded.begin("SALIDA", {
        url: "/parking/26/salida",
        body: { caja_id: 8 },
      }),
    /pendiente/,
  );
  assert.equal(
    createAttemptStore(data, "another@demo/branch1").list().length,
    0,
  );
  assert.equal(
    createAttemptStore(data, "operator@demo/branch2").list().length,
    0,
  );
});
test("failed persistence never yields an attempt that could be sent", () => {
  const broken = {
    getItem: () => null,
    setItem: () => {
      throw new Error("Storage full");
    },
  };
  assert.throws(
    () => createAttemptStore(broken, "scope").begin("INGRESO", {}),
    /Storage full/,
  );
});
test("completion cannot remove a newer attempt; old close keeps its explicit cash ID", () => {
  const data = storage();
  let id = 0;
  const store = createAttemptStore(data, "scope", () => String(++id));
  const old = store.begin("CAJA_CERRAR", {
    url: "/cash/7/cerrar",
    body: { monto_real: "1000.00" },
  });
  store.complete(old);
  const next = store.begin("CAJA_CERRAR", {
    url: "/cash/8/cerrar",
    body: { monto_real: "0.00" },
  });
  store.complete(old);
  assert.equal(store.read("CAJA_CERRAR").key, next.key);
  assert.equal(old.request.url, "/cash/7/cerrar");
});
test("network failures and unmarked denials preserve the original attempt", () => {
  for (const status of [
    undefined,
    400,
    401,
    403,
    404,
    408,
    409,
    422,
    429,
    500,
    503,
  ]) {
    assert.equal(
      keepAttemptAfterFailure({ response: status ? { status } : undefined }),
      true,
    );
  }
});
test("a persisted domain rejection settles the attempt, including GET recovery", () => {
  for (const status of [400, 403, 404, 409, 422]) {
    assert.equal(
      keepAttemptAfterFailure({
        response: { status, headers: { "idempotency-resolved": "true" } },
      }),
      false,
    );
  }
  assert.equal(
    keepAttemptAfterFailure({
      response: {
        status: 409,
        headers: new Headers({ "Idempotency-Resolved": "true" }),
      },
    }),
    false,
  );
  assert.equal(
    keepAttemptAfterFailure({
      response: { status: 500, headers: { "idempotency-resolved": "true" } },
    }),
    true,
  );
});
test("error codes alone never authorize forgetting an uncertain command", () => {
  for (const code of [
    "COTIZACION_VENCIDA",
    "CAJA_CERRADA",
    "ESTADIA_FINALIZADA",
    "SECTOR_LLENO",
    "CAJA_YA_ABIERTA",
    "CLAVE_REUTILIZADA",
  ]) {
    assert.equal(
      keepAttemptAfterFailure({
        response: { status: 409, data: { detail: { code } } },
      }),
      true,
    );
  }
});
test("a first structural validation rejection permits correction, a retry's 422 cannot settle uncertainty", () => {
  const failure = {
    response: {
      status: 422,
      data: {
        detail: [{ loc: ["body", "monto_real"], msg: "Invalid amount" }],
      },
    },
  };
  assert.equal(keepAttemptAfterFailure(failure, "initial"), false);
  assert.equal(keepAttemptAfterFailure(failure, "retry"), true);
  assert.equal(keepAttemptAfterFailure(failure, "recover"), true);
  assert.equal(
    keepAttemptAfterFailure(
      { response: { status: 422, data: { detail: { code: "UNKNOWN" } } } },
      "initial",
    ),
    true,
  );
});
