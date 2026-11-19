import { useCallback, useMemo, useRef, useState } from "react";
import api from "./axios.js";
import {
  createAttemptStore,
  keepAttemptAfterFailure,
} from "./attempt-store.js";
import { errorMessage } from "../ui/format.js";

export function useOperations(scope, onSuccess) {
  const store = useMemo(() => createAttemptStore(localStorage, scope), [scope]);
  const [pending, setPending] = useState(() => store.list());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rejection, setRejection] = useState(null);
  const lock = useRef(false);
  const perform = useCallback(
    async (attempt, mode = "initial") => {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setError("");
      setRejection(null);
      const token = localStorage.getItem("token");
      const recover = mode === "recover";
      try {
        const { data } = recover
          ? await api.get(
              `/parking/operaciones/${attempt.type}/${encodeURIComponent(attempt.key)}`,
              { timeout: 15000 },
            )
          : await api.post(attempt.request.url, attempt.request.body, {
              headers: { "Idempotency-Key": attempt.key },
              timeout: 15000,
            });
        store.complete(attempt);
        setPending(store.list());
        if (localStorage.getItem("token") === token)
          onSuccess(attempt.type, data, mode);
        return data;
      } catch (failure) {
        if (keepAttemptAfterFailure(failure, mode)) {
          setError(
            mode !== "initial" && [401, 403].includes(failure.response?.status)
              ? `${errorMessage(failure, "No se autorizó esta solicitud.")} El intento original se conservó; el rechazo del reintento no prueba que el primero haya fallado.`
              : recover && failure.response?.status === 404
                ? "El servidor aún no tiene un resultado registrado. Podés reenviar el mismo intento; se conservarán su clave y sus IDs."
                : "No sabemos si la operación se confirmó. Recuperá el resultado o reenviá el mismo intento. No crees otra operación.",
          );
        } else {
          store.complete(attempt);
          setPending(store.list());
          setError(
            mode === "initial" &&
              failure.response?.status === 422 &&
              Array.isArray(failure.response?.data?.detail)
              ? `${errorMessage(failure)} La estructura fue rechazada antes de procesar este primer envío. Corregí los campos y confirmá de nuevo.`
              : errorMessage(
                  failure,
                  "La operación fue rechazada y no se confirmó.",
                ),
          );
          setRejection({
            type: attempt.type,
            code: failure.response?.data?.detail?.code,
          });
        }
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [store, onSuccess],
  );
  const run = useCallback(
    (type, request) => {
      if (lock.current) return;
      try {
        const attempt = store.begin(type, request);
        setPending(store.list());
        return perform(attempt);
      } catch (failure) {
        setError(failure.message);
      }
    },
    [store, perform],
  );
  return {
    pending,
    busy,
    error,
    rejection,
    run,
    retry: (attempt) => perform(attempt, "retry"),
    recover: (attempt) => perform(attempt, "recover"),
    clearError: () => {
      setError("");
      setRejection(null);
    },
  };
}
