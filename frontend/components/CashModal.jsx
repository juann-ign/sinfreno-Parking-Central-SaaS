import { useState } from "react";
import Dialog from "./Dialog.jsx";
import PendingOperations from "./PendingOperations.jsx";
import { money } from "../ui/format.js";
import { PaymentLabel } from "../ui/presentation.jsx";
import {
  acknowledgeCashCloseState,
  cashCloseConfirmation,
  cashCloseNeedsReview,
  cashCloseStateCheck,
  createCashCloseState,
  setCashCloseIntent,
  syncCashCloseState,
} from "../ui/cash-close-state.js";

export default function CashModal({
  mode,
  cash,
  cashState,
  checking = false,
  operations,
  onConfirm,
  onClose,
  onRefresh,
}) {
  const [state, setState] = useState(() => createCashCloseState(cash));
  const closeState = mode === "close"
    ? syncCashCloseState(state, cashState)
    : state;
  // Reconcile the selected turn before rendering or handling confirmation, while
  // keeping the same form instance and the operator's entered count and notes.
  if (closeState !== state) setState(closeState);
  const displayedCash = closeState.cash;
  const closeCheck = cashCloseStateCheck(closeState);
  const needsReview = cashCloseNeedsReview(closeState);
  const busy = operations.busy || checking;
  const type = mode === "open" ? "CAJA_ABRIR" : "CAJA_CERRAR";
  const pending = operations.pending.some((item) => item.type === type);
  const submit = (event) => {
    event.preventDefault();
    if (busy || pending) return;
    const confirmation = mode === "close"
      ? cashCloseConfirmation(closeState)
      : { amount: "", notes: closeState.notes };
    if (confirmation) onConfirm(confirmation);
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
            : `Cerrar turno #${closeState.selectedId}`
      }
      onClose={onClose}
      busy={busy}
    >
      {pending ? (
        <PendingOperations operations={operations} type={type} />
      ) : mode === "close" && displayedCash?.origen_datos !== "UTC_POR_TURNO" ? (
        <p className="sf-notice sf-warning">
          Este turno heredado requiere conciliación histórica. No hay un
          desglose de efectivo confiable y no se admite un cierre automático.
          Sus importes originales se conservan en Turnos, sin reinterpretar.
        </p>
      ) : (
        <form onSubmit={submit}>
          {mode === "open" ? (
            <p className="sf-help">
              Fondo inicial de efectivo: {money("0.00")}.
            </p>
          ) : (
            <>
              <p className="sf-help">
                Este cierre corresponde únicamente al turno #{closeState.selectedId}. Contá el
                efectivo físico; los otros medios no son faltante de efectivo.
              </p>
              {!closeCheck.allowed && (
                <div className="sf-notice sf-warning" role="alert">
                  <p>{closeCheck.reason}</p>
                  <p>Los importes mostrados son la última consulta del turno seleccionado.</p>
                  {onRefresh && (
                    <button
                      type="button"
                      className="sf-button"
                      disabled={busy}
                      onClick={onRefresh}
                    >
                      Actualizar caja
                    </button>
                  )}
                </div>
              )}
              <dl className="sf-cash-totals">
                <div>
                  <dt>Recaudación del turno</dt>
                  <dd>{money(displayedCash.recaudacion_total)}</dd>
                </div>
                {Object.entries(displayedCash.totales_por_medio || {}).map(
                  ([method, value]) => (
                    <div key={method}>
                      <dt><PaymentLabel method={method} /></dt>
                      <dd>{money(value)}</dd>
                    </div>
                  ),
                )}
                <div>
                  <dt>Fondo inicial</dt>
                  <dd>{money(displayedCash.fondo_inicial ?? "0.00")}</dd>
                </div>
                <div className="sf-total">
                  <dt>Efectivo esperado</dt>
                  <dd>{money(displayedCash.monto_esperado)}</dd>
                </div>
              </dl>
              {needsReview && (
                <div className="sf-notice sf-warning" role="status" aria-live="polite">
                  <p>
                    Los importes del turno cambiaron mientras contabas. Conservamos
                    tu efectivo contado y tus notas. Revisá los totales actualizados
                    y volvé a contar el efectivo antes de confirmar.
                  </p>
                  <button
                    type="button"
                    className="sf-button"
                    disabled={busy || !closeCheck.allowed}
                    onClick={() => setState(acknowledgeCashCloseState(closeState))}
                  >
                    Revisé los nuevos totales y el efectivo contado
                  </button>
                </div>
              )}
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
                  value={closeState.amount}
                  onChange={(event) => setState(setCashCloseIntent(closeState, {
                    amount: event.target.value,
                  }))}
                  disabled={busy}
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
              value={closeState.notes}
              onChange={(event) => setState(setCashCloseIntent(closeState, {
                notes: event.target.value,
              }))}
              disabled={busy}
            />
          </label>
          <div className="sf-dialog-actions">
            <button
              type="button"
              className="sf-button"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              className="sf-button sf-primary"
              disabled={busy || (mode === "close" && (!closeCheck.allowed || needsReview))}
            >
              {checking
                ? "Verificando turno…"
                : operations.busy
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
