import { useState } from "react";
import Dialog from "./Dialog.jsx";
import PendingOperations from "./PendingOperations.jsx";
import { money, paymentLabels } from "../ui/format.js";

export default function CashModal({
  mode,
  cash,
  operations,
  onConfirm,
  onClose,
}) {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const type = mode === "open" ? "CAJA_ABRIR" : "CAJA_CERRAR";
  const pending = operations.pending.some((item) => item.type === type);
  const submit = (event) => {
    event.preventDefault();
    onConfirm({ amount: amount.replace(",", "."), notes });
  };
  return (
    <Dialog
      open
      title={
        pending
          ? mode === "open"
            ? "Recuperar apertura pendiente"
            : "Recuperar cierre pendiente"
          : mode === "open"
            ? "Abrir caja"
            : `Cerrar turno #${cash.id}`
      }
      onClose={onClose}
      busy={operations.busy}
    >
      {pending ? (
        <PendingOperations operations={operations} type={type} />
      ) : mode === "close" && cash.origen_datos !== "UTC_POR_TURNO" ? (
        <p className="sf-notice sf-warning">
          Este turno heredado requiere conciliación histórica. No hay un
          desglose de efectivo confiable y no se admite un cierre automático.
          Sus importes originales se conservan en Turnos, sin reinterpretar.
        </p>
      ) : (
        <form onSubmit={submit}>
          {mode === "open" ? (
            <p className="sf-help">
              La demo inicia cada turno con fondo de efectivo cero. Los ingresos
              y cobros nuevos quedarán asociados a la caja correspondiente.
            </p>
          ) : (
            <>
              <p className="sf-help">
                Este cierre corresponde únicamente al turno #{cash.id}. Contá el
                efectivo físico; los otros medios no son faltante de efectivo.
              </p>
              <dl className="sf-cash-totals">
                <div>
                  <dt>Recaudación del turno</dt>
                  <dd>{money(cash.recaudacion_total)}</dd>
                </div>
                {Object.entries(cash.totales_por_medio || {}).map(
                  ([method, value]) => (
                    <div key={method}>
                      <dt>{paymentLabels[method] || method}</dt>
                      <dd>{money(value)}</dd>
                    </div>
                  ),
                )}
                <div>
                  <dt>Fondo inicial</dt>
                  <dd>{money(cash.fondo_inicial ?? "0.00")}</dd>
                </div>
                <div className="sf-total">
                  <dt>Efectivo esperado</dt>
                  <dd>{money(cash.monto_esperado)}</dd>
                </div>
              </dl>
              <label className="sf-field" htmlFor="cash-counted">
                Efectivo contado (ARS)
                <input
                  id="cash-counted"
                  data-autofocus
                  inputMode="decimal"
                  required
                  maxLength={15}
                  pattern="[0-9]{1,12}([.,][0-9]{1,2})?"
                  placeholder="0,00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  disabled={operations.busy}
                />
              </label>
            </>
          )}
          <label className="sf-field" htmlFor="cash-notes">
            Notas del turno
            <textarea
              id="cash-notes"
              rows={3}
              maxLength={1000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={operations.busy}
            />
          </label>
          <div className="sf-dialog-actions">
            <button
              type="button"
              className="sf-button"
              disabled={operations.busy}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className="sf-button sf-primary" disabled={operations.busy}>
              {operations.busy
                ? "Registrando…"
                : mode === "open"
                  ? "Abrir caja con fondo cero"
                  : "Confirmar cierre de este turno"}
            </button>
          </div>
        </form>
      )}
      {operations.error && (
        <p className="sf-notice sf-error" role="alert">
          {operations.error}
        </p>
      )}
    </Dialog>
  );
}
