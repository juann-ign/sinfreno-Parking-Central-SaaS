const UPDATE_EVENTS = new Set([
  "NUEVO_INGRESO",
  "NUEVA_SALIDA",
  "CONFIG_UPDATED",
]);
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 15000];

// The browser supplies Origin. Credentials only travel in the first frame.
export function connectAuthenticatedSocket(
  {
    url,
    token,
    onEvent,
    onReady = () => {},
    onStatus = () => {},
    onUnauthorized,
    onForbidden,
    onUnavailable,
  },
  runtime = globalThis,
) {
  let socket;
  let stopped = false;
  let retries = 0;
  let authTimer;
  let retryTimer;

  const stop = () => {
    stopped = true;
    runtime.clearTimeout(authTimer);
    runtime.clearTimeout(retryTimer);
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      if (socket.readyState < 2) socket.close(1000, "Session ended");
    }
  };

  const connect = () => {
    if (stopped) return;
    onStatus(retries ? "reconnecting" : "connecting");
    let authenticated = false;
    try {
      socket = new runtime.WebSocket(url);
    } catch {
      stop();
      onUnavailable();
      return;
    }
    authTimer = runtime.setTimeout(() => {
      stop();
      onUnavailable();
    }, 7000);

    socket.onopen = () => {
      if (!stopped)
        socket.send(JSON.stringify({ type: "authenticate", token }));
    };
    socket.onmessage = ({ data }) => {
      let message;
      try {
        message = JSON.parse(data);
      } catch {
        return;
      }
      if (!message || typeof message !== "object") return;
      if (!authenticated) {
        if (message.type === "authenticated") {
          authenticated = true;
          onStatus("connected");
          runtime.clearTimeout(authTimer);
          onReady();
        }
        return;
      }
      if (UPDATE_EVENTS.has(message.event))
        onEvent({ event: message.event, id: message.id });
    };
    socket.onclose = ({ code }) => {
      runtime.clearTimeout(authTimer);
      if (stopped) return;
      if (code === 4401) {
        stop();
        onUnauthorized();
      } else if (code === 4403 || code === 1008) {
        stop();
        onForbidden();
      } else if (code === 1000 || retries === RETRY_DELAYS.length) {
        stop();
        onUnavailable();
      } else {
        onStatus("reconnecting");
        retryTimer = runtime.setTimeout(connect, RETRY_DELAYS[retries++]);
      }
    };
  };

  if (!token) {
    stopped = true;
    onUnauthorized();
  } else {
    connect();
  }
  return stop;
}
