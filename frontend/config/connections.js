// These values are public: Vite embeds them in the browser bundle.
function parseBaseUrl(value, name, origin, protocols) {
  let url;
  try {
    if (typeof value !== "string" || (!value.startsWith("/") && !/^[a-z]+:\/\//i.test(value))) {
      throw new Error("Invalid base URL");
    }
    url = new URL(value, origin);
  } catch {
    throw new Error(`${name} must be an absolute URL or a path relative to the frontend origin.`);
  }

  if (!protocols.includes(url.protocol)) {
    throw new Error(`${name} uses an unsupported protocol.`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must not contain credentials, a query, or a fragment.`);
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

function appendPath(base, path) {
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/${path}`;
  return url.toString().replace(/\/$/, "");
}

function pathSegment(value) {
  if (value === undefined || value === null || String(value).trim() === "" || value === "." || value === "..") {
    throw new Error("A connection identifier is required.");
  }
  return encodeURIComponent(String(value));
}

export function createConnectionConfig(env = {}, origin) {
  const backend = parseBaseUrl(
    env.VITE_BACKEND_URL || "http://localhost:8000",
    "VITE_BACKEND_URL",
    origin,
    ["http:", "https:"],
  );
  const api = parseBaseUrl(
    env.VITE_API_BASE_URL || appendPath(backend, "api/v1"),
    "VITE_API_BASE_URL",
    origin,
    ["http:", "https:"],
  );
  const websocket = parseBaseUrl(
    env.VITE_WS_BASE_URL || appendPath(backend, "ws"),
    "VITE_WS_BASE_URL",
    origin,
    ["http:", "https:", "ws:", "wss:"],
  );
  websocket.protocol = { "http:": "ws:", "https:": "wss:" }[websocket.protocol] || websocket.protocol;

  return {
    apiBaseUrl: api.toString().replace(/\/$/, ""),
    getWebSocketUrl: (sucursalId) => appendPath(websocket, pathSegment(sucursalId)),
    getTicketUrl: (estadiaId) => appendPath(api, `parking/${pathSegment(estadiaId)}/pdf`),
  };
}

export const { apiBaseUrl, getWebSocketUrl, getTicketUrl } = createConnectionConfig(
  import.meta.env,
  globalThis.location?.origin,
);
