export function isCurrentSessionFailure(error, token) {
  return error.response?.status === 401 && Boolean(token) && error.config?.sessionToken === token;
}

// This store owns restoration races; React only subscribes to verified state.
export function createSessionController({ storage, requestProfile, onInvalid }) {
  let snapshot = { user: null, status: storage.getItem("token") ? "checking" : "anonymous", error: null };
  let generation = 0;
  let pending;
  const listeners = new Set();
  const publish = (value) => {
    snapshot = value;
    listeners.forEach((listener) => listener());
  };
  const cancel = () => {
    generation++;
    pending?.abort();
  };
  const end = () => {
    cancel();
    publish({ user: null, status: "anonymous", error: null });
  };
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => snapshot,
    end,
    cancel,
    login(user) {
      cancel();
      if (!storage.getItem("token")) return end();
      storage.setItem("user_info", JSON.stringify(user));
      publish({ user, status: "verified", error: null });
    },
    async restore() {
      cancel();
      const token = storage.getItem("token");
      if (!token) return end();
      const requestGeneration = generation;
      pending = new AbortController();
      publish({ user: null, status: "checking", error: null });
      const isCurrent = () => requestGeneration === generation && storage.getItem("token") === token;
      try {
        const user = await requestProfile(token, pending.signal);
        if (!isCurrent()) return;
        storage.setItem("user_info", JSON.stringify(user));
        publish({ user, status: "verified", error: null });
      } catch (error) {
        if (!isCurrent()) return;
        if (error.response?.status === 401) {
          end();
          onInvalid();
        } else {
          publish({ user: null, status: "unavailable", error: "No pudimos verificar tu sesión. Tus credenciales se conservaron; reintentá cuando vuelva la conexión." });
        }
      }
    },
  };
}
