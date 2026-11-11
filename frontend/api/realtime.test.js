import assert from "node:assert/strict";
import test from "node:test";
import { connectAuthenticatedSocket } from "./realtime.js";

// Unit tests of browser connection lifecycle; integration uses the real backend.
function harness(token = "unit-test-credential") {
  const sockets = [];
  const timers = new Map();
  const calls = { events: [], ready: 0, unauthorized: 0, forbidden: 0, unavailable: 0 };
  let timerId = 0;
  class FakeSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.sent = [];
      sockets.push(this);
    }
    send(data) { this.sent.push(JSON.parse(data)); }
    close(code) { this.readyState = 3; this.closedWith = code; }
    open() { this.readyState = 1; this.onopen?.(); }
    message(data) { this.onmessage?.({ data: JSON.stringify(data) }); }
    disconnect(code) { this.readyState = 3; this.onclose?.({ code }); }
  }
  const runtime = {
    WebSocket: FakeSocket,
    setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  };
  const stop = connectAuthenticatedSocket({
    url: "wss://parking.example/prefix/ws/4",
    token,
    onReady: () => calls.ready++,
    onEvent: (event) => calls.events.push(event),
    onUnauthorized: () => calls.unauthorized++,
    onForbidden: () => calls.forbidden++,
    onUnavailable: () => calls.unavailable++,
  }, runtime);
  return {
    sockets, timers, calls, stop,
    nextTimer() {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      timer.callback();
      return timer.delay;
    },
  };
}

test("authenticates in a frame, gates business events until ACK, and exposes only invalidations", () => {
  const h = harness();
  const socket = h.sockets[0];
  assert.equal(socket.url, "wss://parking.example/prefix/ws/4");
  socket.open();
  assert.deepEqual(socket.sent, [{ type: "authenticate", token: "unit-test-credential" }]);
  socket.message({ event: "NUEVA_SALIDA", id: 9, monto: 5000 });
  assert.deepEqual(h.calls.events, []);
  socket.message({ type: "authenticated" });
  assert.equal(h.calls.ready, 1);
  assert.equal(h.timers.size, 0);
  socket.message({ event: "NUEVA_SALIDA", id: 9, monto: 5000, metodo_pago: "DEBITO" });
  socket.message({ event: "UNKNOWN", monto: 5000 });
  socket.message(null);
  assert.deepEqual(h.calls.events, [{ event: "NUEVA_SALIDA", id: 9 }]);
  h.stop();
});

test("expired credentials end the session without reconnecting", () => {
  const h = harness();
  h.sockets[0].open();
  h.sockets[0].message({ type: "authenticated" });
  h.sockets[0].disconnect(4401);
  assert.equal(h.calls.unauthorized, 1);
  assert.equal(h.timers.size, 0);
  assert.equal(h.sockets.length, 1);
});

test("scope and protocol denials are terminal", () => {
  for (const code of [4403, 1008]) {
    const h = harness();
    h.sockets[0].disconnect(code);
    assert.equal(h.calls.forbidden, 1);
    assert.equal(h.timers.size, 0);
  }
});

test("transient failures have five bounded backoff retries even after successful authentication", () => {
  const h = harness();
  for (const delay of [1000, 2000, 4000, 8000, 15000]) {
    const socket = h.sockets.at(-1);
    socket.open();
    socket.message({ type: "authenticated" });
    socket.disconnect(1006);
    assert.equal(h.nextTimer(), delay);
  }
  h.sockets.at(-1).disconnect(1011);
  assert.equal(h.sockets.length, 6);
  assert.equal(h.calls.unavailable, 1);
  assert.equal(h.timers.size, 0);
});

test("logout cleanup closes a connecting socket and cancels queued reconnects", () => {
  const connecting = harness();
  connecting.stop();
  assert.equal(connecting.sockets[0].closedWith, 1000);
  assert.equal(connecting.sockets[0].onopen, null);
  assert.equal(connecting.timers.size, 0);
  const pending = harness();
  pending.sockets[0].disconnect(1006);
  assert.equal(pending.timers.size, 1);
  pending.stop();
  assert.equal(pending.timers.size, 0);
  assert.equal(pending.sockets.length, 1);
});

test("missing credentials never open a socket and missing ACK times out", () => {
  const anonymous = harness(null);
  assert.equal(anonymous.sockets.length, 0);
  assert.equal(anonymous.calls.unauthorized, 1);
  const pending = harness();
  assert.equal(pending.nextTimer(), 7000);
  assert.equal(pending.calls.unavailable, 1);
  assert.equal(pending.sockets[0].closedWith, 1000);
  assert.equal(pending.timers.size, 0);
});
