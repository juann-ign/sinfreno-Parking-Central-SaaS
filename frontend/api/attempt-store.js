export const operationTypes = [
  "INGRESO",
  "SALIDA",
  "CAJA_ABRIR",
  "CAJA_CERRAR",
];
export function keepAttemptAfterFailure(error, mode = "retry") {
  const status = error?.response?.status;
  const headers = error?.response?.headers;
  const resolved =
    headers?.get?.("Idempotency-Resolved") ??
    headers?.["idempotency-resolved"] ??
    headers?.["Idempotency-Resolved"];
  // Only an explicitly persisted 4xx result settles a rejected command.
  // A denial of a retry does not establish the outcome of its first request.
  if (
    mode === "initial" &&
    status === 422 &&
    Array.isArray(error?.response?.data?.detail)
  )
    return false;
  return !(
    status >= 400 &&
    status < 500 &&
    String(resolved).toLowerCase() === "true"
  );
}
export function createAttemptStore(
  storage,
  scope,
  createKey = () => crypto.randomUUID(),
) {
  const prefix = `sinfreno:attempt:${encodeURIComponent(scope)}:`;
  const read = (type) => {
    try {
      return JSON.parse(storage.getItem(prefix + type) || "null");
    } catch {
      return null;
    }
  };
  return {
    read,
    list: () => operationTypes.map(read).filter(Boolean),
    begin(type, request) {
      if (!operationTypes.includes(type))
        throw new Error("Operación desconocida");
      if (read(type))
        throw new Error(
          "Hay un intento pendiente. Recuperá su resultado antes de crear otro.",
        );
      const attempt = {
        type,
        key: createKey(),
        request,
        createdAt: new Date().toISOString(),
      };
      // Persistence must succeed before sending any mutation.
      storage.setItem(prefix + type, JSON.stringify(attempt));
      return attempt;
    },
    complete(attempt) {
      if (read(attempt.type)?.key === attempt.key)
        storage.removeItem(prefix + attempt.type);
    },
  };
}
