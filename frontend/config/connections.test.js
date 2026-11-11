import assert from "node:assert/strict";
import test from "node:test";
import { createConnectionConfig } from "./connections.js";

test("development defaults connect API, websocket and receipts to the same backend", () => {
  const config = createConnectionConfig();
  assert.equal(config.apiBaseUrl, "http://localhost:8000/api/v1");
  assert.equal(config.getWebSocketUrl(3), "ws://localhost:8000/ws/3");
  assert.equal(config.getTicketUrl(12), "http://localhost:8000/api/v1/parking/12/pdf");
});

test("HTTPS and proxy prefixes survive URL construction", () => {
  const config = createConnectionConfig({ VITE_BACKEND_URL: "https://parking.example/sinfreno///" });
  assert.equal(config.apiBaseUrl, "https://parking.example/sinfreno/api/v1");
  assert.equal(config.getWebSocketUrl(3), "wss://parking.example/sinfreno/ws/3");
  assert.equal(config.getTicketUrl(12), "https://parking.example/sinfreno/api/v1/parking/12/pdf");
});

test("API and websocket routes can use independent public gateways", () => {
  const config = createConnectionConfig({
    VITE_API_BASE_URL: "https://api.example/gateway/v2/",
    VITE_WS_BASE_URL: "wss://events.example/parking/",
  });
  assert.equal(config.getTicketUrl(12), "https://api.example/gateway/v2/parking/12/pdf");
  assert.equal(config.getWebSocketUrl(3), "wss://events.example/parking/3");
});

test("origin-relative routes inherit HTTPS, including the websocket override", () => {
  const config = createConnectionConfig({
    VITE_BACKEND_URL: "/sinfreno/",
    VITE_API_BASE_URL: "/gateway/api/",
    VITE_WS_BASE_URL: "/gateway/events/",
  }, "https://demo.example");
  assert.equal(config.apiBaseUrl, "https://demo.example/gateway/api");
  assert.equal(config.getWebSocketUrl(3), "wss://demo.example/gateway/events/3");
});

test("identifiers cannot inject path separators, query parameters or fragments", () => {
  const config = createConnectionConfig();
  assert.equal(config.getTicketUrl("a/b?x=1#y"), "http://localhost:8000/api/v1/parking/a%2Fb%3Fx%3D1%23y/pdf");
  assert.equal(config.getWebSocketUrl("3/4"), "ws://localhost:8000/ws/3%2F4");
  assert.throws(() => config.getTicketUrl(undefined), /identifier/);
  assert.throws(() => config.getTicketUrl(".."), /identifier/);
});

test("invalid public configuration fails before making a request", () => {
  for (const VITE_BACKEND_URL of ["not a URL", "ftp://example.com", "https://user:pass@example.com", "https://example.com?secret=value", "https://example.com#route"]) {
    assert.throws(() => createConnectionConfig({ VITE_BACKEND_URL }), /VITE_BACKEND_URL/);
  }
  assert.throws(() => createConnectionConfig({ VITE_API_BASE_URL: "ws://example.com" }), /VITE_API_BASE_URL/);
  assert.throws(() => createConnectionConfig({ VITE_BACKEND_URL: "not a URL" }, "https://demo.example"), /VITE_BACKEND_URL/);
});
