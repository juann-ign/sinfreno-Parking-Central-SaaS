export default function PendingOperations({ operations, type }) {
  const pending = operations.pending.filter(
    (item) => !type || item.type === type,
  );
  if (!pending.length) return null;
  return (
    <section
      className="sf-notice sf-warning"
      aria-label="Operaciones con resultado pendiente"
      aria-live="polite"
    >
      <h3>
        {operations.busy
          ? "Esperando confirmación del servidor…"
          : "Resultado por confirmar"}
      </h3>
      <p>
        Conservamos cada intento. No vuelvas a crear la operación: consultá su
        resultado o reenviá exactamente el mismo pedido.
      </p>
      {pending.map((attempt) => (
        <div key={attempt.key} className="sf-recovery-row">
          <div>
            <strong>
              {
                {
                  INGRESO: "Ingreso",
                  SALIDA: "Cobro",
                  CAJA_ABRIR: "Apertura de caja",
                  CAJA_CERRAR: "Cierre de caja",
                }[attempt.type]
              }
            </strong>
            <small>
              {attempt.request.body.patente
                ? `Patente ${attempt.request.body.patente} · `
                : ""}
              {attempt.request.url.match(/parking\/(\d+)\/salida/)
                ? `Estadía #${attempt.request.url.match(/parking\/(\d+)\/salida/)[1]} · `
                : ""}
              {attempt.request.body.caja_id
                ? `Turno #${attempt.request.body.caja_id} · `
                : attempt.type === "CAJA_CERRAR"
                  ? `Turno #${attempt.request.url.match(/cash\/(\d+)/)?.[1]} · `
                  : ""}
              Referencia {attempt.key.slice(0, 8)}
            </small>
          </div>
          <button
            className="sf-button"
            disabled={operations.busy}
            onClick={() => operations.recover(attempt)}
          >
            Recuperar resultado
          </button>
          <button
            className="sf-button"
            disabled={operations.busy}
            onClick={() => operations.retry(attempt)}
          >
            Reenviar mismo intento
          </button>
        </div>
      ))}
    </section>
  );
}
