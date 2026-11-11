import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { dateTime, errorMessage, money } from "../ui/format.js";

export default function OwnReceipts({ version, onView }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    api
      .get("/parking/comprobantes-propios", {
        params: { page, size: 5 },
        signal: abort.signal,
      })
      .then(({ data: result }) => {
        setData(result);
        setError("");
      })
      .catch((failure) => {
        if (!abort.signal.aborted)
          setError(
            errorMessage(failure, "No pudimos recuperar tus comprobantes."),
          );
      });
    return () => abort.abort();
  }, [page, version, retry]);
  return (
    <section className="sf-card">
      <header className="sf-section-heading">
        <div>
          <span className="sf-eyebrow">Recuperación</span>
          <h2>Mis comprobantes</h2>
        </div>
        <span className="sf-hint">Sólo tus operaciones autorizadas</span>
      </header>
      {error ? (
        <p className="sf-notice sf-error" role="alert">
          {error}{" "}
          <button
            className="sf-button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Reintentar
          </button>
        </p>
      ) : !data ? (
        <p role="status">Buscando comprobantes…</p>
      ) : (
        <>
          {!data.items.length ? (
            <p className="sf-empty">
              Todavía no hay comprobantes propios disponibles.
            </p>
          ) : (
            <div className="sf-table-wrap">
              <table className="sf-table">
                <caption className="sr-only">
                  Comprobantes recuperables de tus operaciones
                </caption>
                <thead>
                  <tr>
                    <th>Patente</th>
                    <th>Operación</th>
                    <th>Fecha</th>
                    <th>Importe</th>
                    <th>
                      <span className="sr-only">Abrir</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((stay) => (
                    <tr key={stay.id}>
                      <td>
                        <strong className="sf-plate">{stay.patente}</strong>
                      </td>
                      <td>
                        {stay.estado === "FINALIZADO" ? "Salida" : "Ingreso"} ·
                        #{stay.id}
                      </td>
                      <td>
                        {dateTime(stay.fecha_salida || stay.fecha_entrada)}
                      </td>
                      <td>
                        {stay.estado === "FINALIZADO" ? money(stay.monto) : "—"}
                      </td>
                      <td>
                        <button
                          className="sf-button"
                          onClick={() => onView(stay)}
                        >
                          Ver comprobante
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav
            className="sf-pagination"
            aria-label="Páginas de comprobantes propios"
          >
            <button
              className="sf-button"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Anterior
            </button>
            <span>
              Página {data.page} de {Math.max(1, data.pages)} · {data.total}{" "}
              comprobantes
            </span>
            <button
              className="sf-button"
              disabled={page >= data.pages}
              onClick={() => setPage((value) => value + 1)}
            >
              Siguiente
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
