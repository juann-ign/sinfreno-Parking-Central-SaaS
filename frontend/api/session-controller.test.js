import test from "node:test";
import assert from "node:assert/strict";
import { createSessionController, isCurrentSessionFailure } from "./session-controller.js";

function setup() {
  const values = new Map([["token", "credential-A"], ["user_info", "saved-profile"]]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const requests = [];
  let invalidations = 0;
  const controller = createSessionController({
    storage,
    requestProfile: (token, signal) => new Promise((resolve, reject) => requests.push({ token, signal, resolve, reject })),
    onInvalid: () => { invalidations++; values.delete("token"); values.delete("user_info"); },
  });
  return { values, requests, controller, invalidations: () => invalidations };
}

test("503 and network failure retain credentials, close protected UI and allow a verified retry", async () => {
  for (const failure of [{ response: { status: 503 } }, new TypeError("Network unavailable")]) {
    const h = setup();
    const first = h.controller.restore();
    h.requests[0].reject(failure);
    await first;
    assert.equal(h.values.get("token"), "credential-A");
    assert.equal(h.values.get("user_info"), "saved-profile");
    assert.equal(h.controller.getSnapshot().status, "unavailable");
    assert.equal(h.controller.getSnapshot().user, null);
    assert.equal(h.invalidations(), 0);
    const retry = h.controller.restore();
    h.requests[1].resolve({ email: "a@example.com", permisos: ["ingreso"] });
    await retry;
    assert.equal(h.controller.getSnapshot().status, "verified");
    assert.equal(h.controller.getSnapshot().user.email, "a@example.com");
  }
});

test("401 invalidates the current session", async () => {
  const h = setup();
  const pending = h.controller.restore();
  h.requests[0].reject({ response: { status: 401 } });
  await pending;
  assert.equal(h.invalidations(), 1);
  assert.equal(h.values.has("token"), false);
  assert.equal(h.controller.getSnapshot().status, "anonymous");
});

test("late success after logout cannot restore the profile", async () => {
  const h = setup();
  const pending = h.controller.restore();
  h.controller.end();
  h.values.delete("token");
  h.requests[0].resolve({ email: "a@example.com" });
  await pending;
  assert.equal(h.requests[0].signal.aborted, true);
  assert.equal(h.controller.getSnapshot().status, "anonymous");
});

test("late success or rejection cannot replace or invalidate a newer identity", async () => {
  for (const reject of [false, true]) {
    const h = setup();
    const pending = h.controller.restore();
    h.values.set("token", "credential-B");
    h.controller.login({ email: "b@example.com" });
    if (reject) h.requests[0].reject({ response: { status: 401 } });
    else h.requests[0].resolve({ email: "a@example.com" });
    await pending;
    assert.equal(h.controller.getSnapshot().user.email, "b@example.com");
    assert.equal(h.values.get("token"), "credential-B");
    assert.equal(h.invalidations(), 0);
  }
});

test("an obsolete retry response cannot supersede the latest verification", async () => {
  const h = setup();
  const old = h.controller.restore();
  const latest = h.controller.restore();
  h.requests[1].resolve({ email: "current@example.com" });
  await latest;
  h.requests[0].resolve({ email: "stale@example.com" });
  await old;
  assert.equal(h.controller.getSnapshot().user.email, "current@example.com");
});

test("Axios invalidation is scoped to the credential that actually failed", () => {
  const error = { response: { status: 401 }, config: { sessionToken: "credential-A" } };
  assert.equal(isCurrentSessionFailure(error, "credential-A"), true);
  assert.equal(isCurrentSessionFailure(error, "credential-B"), false);
  assert.equal(isCurrentSessionFailure(error, null), false);
  assert.equal(isCurrentSessionFailure({ ...error, response: { status: 503 } }, "credential-A"), false);
});
