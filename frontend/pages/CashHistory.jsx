import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { dateTime, errorMessage, money } from "../ui/format.js";
import { PaymentLabel } from "../ui/presentation.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Dialog from "../components/Dialog.jsx";

export default function CashHistory() {
  const [state, setState] = useState({ data: [], loading: true, error: "" });
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    api
      .get("/cash/history", { signal: controller.signal, timeout: 12000 })
      .then(({ data }) => setState({ data, loading: false, error: "" }))
      .catch((failure) => {
        if (!controller.signal.aborted)
          setState({
            data: [],
            loading: false,
            error: errorMessage(
              failure,
              "No se pudieron consultar los turnos.",
            ),
          });
      });
    return () => controller.abort();
  }, [retry]);
  return (
    <div className="sf-app">
      <PageHeader
        title="Turnos de caja"
        subtitle="Recaudación por turno y conciliación del efectivo físico, sin sumar otros medios como faltante."
      />
      <main className="sf-workspace">
        {state.error && (
          <p className="sf-notice sf-error" role="alert">
            {state.error}{" "}
            <button
              className="sf-button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Reintentar
            </button>
          </p>
        )}
        <section className="sf-card sf-table-wrap">
          <table className="sf-table">
            <caption className="sr-only">
              Turnos de caja de esta sucursal
            </caption>
            <thead>
              <tr>
                <th>Turno / apertura</th>
                <th>Cierre</th>
                <th>Recaudación</th>
                <th>Efectivo esperado</th>
                <th>Efectivo contado</th>
                <th>Diferencia de efectivo</th>
                <th>Estado</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {state.loading ? (
                <tr>
                  <td colSpan={8} role="status">
                    Cargando turnos…
                  </td>
                </tr>
              ) : !state.data.length ? (
                <tr>
                  <td className="sf-empty" colSpan={8}>
                    Todavía no hay turnos de caja.
                  </td>
                </tr>
              ) : (
                state.data.map((cash) => (
                  <tr key={cash.id}>
                    <td>
                      <strong>Turno #{cash.id}</strong>
                      <small>{dateTime(cash.fecha_apertura)}</small>
                    </td>
                    <td>{dateTime(cash.fecha_cierre)}</td>
                    {cash.origen_datos === "UTC_POR_TURNO" ? (
                      <>
                        <td>{money(cash.recaudacion_total)}</td>
                        <td>{money(cash.monto_esperado)}</td>
                        <td>{money(cash.monto_real)}</td>
                        <td>{money(cash.diferencia)}</td>
                      </>
                    ) : (
                      <td colSpan={4}>
                        <span className="sf-badge sf-badge-warning">
                          Sin conciliación histórica
                        </span>
                        <small>
                          Importes originales conservados en el detalle, sin
                          reinterpretar como efectivo.
                        </small>
                      </td>
                    )}
                    <td>
                      <span
                        className={`sf-badge ${cash.estado === "ABIERTA" ? "sf-badge-success" : ""}`}
                      >
                        {cash.estado === "ABIERTA" ? "Abierto" : "Cerrado"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="sf-button"
                        onClick={() => setSelected(cash)}
                      >
                        Ver turno
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </main>
      {selected && (
        <Dialog
          open
          title={`Turno #${selected.id}`}
          onClose={() => setSelected(null)}
        >
          <dl className="sf-cash-totals">
            <div>
              <dt>Apertura</dt>
              <dd>{dateTime(selected.fecha_apertura)}</dd>
            </div>
            <div>
              <dt>Cierre</dt>
              <dd>{dateTime(selected.fecha_cierre)}</dd>
            </div>
            <div>
              <dt>Responsable de apertura</dt>
              <dd>Usuario #{selected.usuario_id}</dd>
            </div>
            {selected.origen_datos === "UTC_POR_TURNO" ? (
              <>
                {Object.entries(selected.totales_por_medio || {}).map(
                  ([method, amount]) => (
                    <div key={method}>
                      <dt><PaymentLabel method={method} /></dt>
                      <dd>{money(amount)}</dd>
                    </div>
                  ),
                )}
                <div>
                  <dt>Recaudación total</dt>
                  <dd>{money(selected.recaudacion_total)}</dd>
                </div>
                <div>
                  <dt>Fondo inicial</dt>
                  <dd>{money(selected.fondo_inicial)}</dd>
                </div>
                <div>
                  <dt>Efectivo esperado</dt>
                  <dd>{money(selected.monto_esperado)}</dd>
                </div>
                <div>
                  <dt>Efectivo contado</dt>
                  <dd>{money(selected.monto_real)}</dd>
                </div>
                <div className="sf-total">
                  <dt>Diferencia de efectivo</dt>
                  <dd>{money(selected.diferencia)}</dd>
                </div>
              </>
            ) : (
              <>
                <div>
                  <dt>Recaudación y desglose por medio</dt>
                  <dd>Sin conciliación histórica</dd>
                </div>
                <div>
                  <dt>Fondo inicial</dt>
                  <dd>Sin constancia histórica</dd>
                </div>
                <div>
                  <dt>Importe esperado heredado, sin reinterpretar</dt>
                  <dd>{money(selected.monto_esperado)}</dd>
                </div>
                <div>
                  <dt>Importe declarado heredado, sin reinterpretar</dt>
                  <dd>{money(selected.monto_real)}</dd>
                </div>
                <div>
                  <dt>Diferencia heredada, sin reinterpretar</dt>
                  <dd>{money(selected.diferencia)}</dd>
                </div>
              </>
            )}
          </dl>
          {selected.origen_datos !== "UTC_POR_TURNO" && (
            <p className="sf-notice sf-warning">
              Estos importes pertenecen al esquema anterior. No constituyen un
              arqueo de efectivo ni permiten reconstruir la recaudación o el
              fondo inicial del turno.
            </p>
          )}
          <h3>Notas conservadas</h3>
          <p className="sf-help sf-preserve-whitespace">
            {selected.notas || "Sin notas registradas."}
          </p>
        </Dialog>
      )}
    </div>
  );
}
