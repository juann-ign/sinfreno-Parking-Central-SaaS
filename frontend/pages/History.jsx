import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import api from "../api/axios.js";
import { dateTime, errorMessage, money } from "../ui/format.js";
import { PaymentLabel, VehicleLabel } from "../ui/presentation.jsx";
import PageHeader from "../components/PageHeader.jsx";
import TicketModal from "../components/TicketModal.jsx";

export default function History() {
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [receipt, setReceipt] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState((previous) => ({ ...previous, loading: true }));
      api
        .get("/parking/historial", {
          params: { page, size: 20, patente: term.trim() || undefined },
          signal: controller.signal,
          timeout: 12000,
        })
        .then(({ data }) => setState({ data, loading: false, error: "" }))
        .catch((failure) => {
          if (!controller.signal.aborted)
            setState({
              data: null,
              loading: false,
              error: errorMessage(
                failure,
                "No pudimos cargar el historial de esta sucursal.",
              ),
            });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [page, term, retry]);
  const data = state.data;
  return (
    <div className="sf-app">
      <PageHeader
        title="Historial de estadías"
        subtitle="Registros individuales de esta sucursal y sus comprobantes autorizados."
      />
      <main className="sf-workspace">
        <section className="sf-card">
          <header className="sf-section-heading">
            <h2>Buscar una estadía</h2>
            <span className="sf-hint">{data?.total ?? "—"} registros</span>
          </header>
          <label className="sf-search">
            <Search size={20} />
            <span className="sr-only">Buscar patente en el historial</span>
            <input
              placeholder="Buscar patente…"
              value={term}
              onChange={(event) => {
                setTerm(event.target.value.toUpperCase());
                setPage(1);
              }}
            />
          </label>
          {state.error && (
            <p role="alert" className="sf-notice sf-error">
              {state.error}{" "}
              <button
                className="sf-button"
                onClick={() => setRetry((value) => value + 1)}
              >
                Reintentar
              </button>
            </p>
          )}
          <div className="sf-table-wrap">
            <table className="sf-table">
              <caption className="sr-only">Historial paginado</caption>
              <thead>
                <tr>
                  <th>Patente</th>
                  <th>Ingreso</th>
                  <th>Salida</th>
                  <th>Medio</th>
                  <th>Importe</th>
                  <th>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {state.loading ? (
                  <tr>
                    <td colSpan={6} role="status">
                      Cargando historial…
                    </td>
                  </tr>
                ) : !data?.items.length ? (
                  <tr>
                    <td colSpan={6} className="sf-empty">
                      No hay registros que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  data.items.map((stay) => (
                    <tr key={stay.id}>
                      <td>
                        <strong className="sf-plate">{stay.patente}</strong>
                        <small>
                          <VehicleLabel category={stay.tipo_vehiculo} /> · #{stay.id}
                        </small>
                      </td>
                      <td>{dateTime(stay.fecha_entrada)}</td>
                      <td>{dateTime(stay.fecha_salida)}</td>
                      <td>
                        <PaymentLabel method={stay.metodo_pago} />
                      </td>
                      <td>{money(stay.monto)}</td>
                      <td>
                        <button
                          className="sf-button"
                          onClick={() => setReceipt(stay)}
                        >
                          Ver comprobante
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {data && (
            <nav className="sf-pagination" aria-label="Páginas del historial">
              <button
                className="sf-button"
                disabled={state.loading || page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </button>
              <span>
                Página {data.page} de {Math.max(1, data.pages)} · {data.total}{" "}
                registros
              </span>
              <button
                className="sf-button"
                disabled={state.loading || page >= data.pages}
                onClick={() => setPage((value) => value + 1)}
              >
                Siguiente
              </button>
            </nav>
          )}
        </section>
      </main>
      {receipt && (
        <TicketModal
          key={receipt.id}
          isOpen
          ticketData={receipt}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}
