import { useEffect, useRef, useState } from "react";
import { Clock, RefreshCw, X } from "lucide-react";
import { apiDate, dateTime, money, paymentLabels } from "../ui/format.js";
import PendingOperations from "./PendingOperations.jsx";

export default function QuotePanel({
  stay,
  quote,
  loading,
  error,
  cash,
  operations,
  onRefresh,
  onConfirm,
  onClose,
  canReview,
  onReview,
}) {
  const [method, setMethod] = useState("EFECTIVO");
  const [now, setNow] = useState(Date.now);
  const headingRef = useRef(null);
  useEffect(() => {
    if (quote?.id) headingRef.current?.focus();
  }, [quote?.id]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const expires = apiDate(quote?.vence_en)?.getTime() || 0;
  const expired =
    !expires ||
    now >= expires ||
    (operations.rejection?.type === "SALIDA" &&
      operations.rejection.code === "COTIZACION_VENCIDA");
  const pending = operations.pending.some((item) => item.type === "SALIDA");
  const finalized =
    operations.rejection?.type === "SALIDA" &&
    operations.rejection.code === "ESTADIA_FINALIZADA";
  const explanation = quote?.explicacion;
  return (
    <section
      className="sf-card sf-quote"
      aria-labelledby="quote-title"
      aria-live="polite"
    >
      <header className="sf-section-heading">
        <div>
          <span className="sf-eyebrow">Salida · estadía #{stay.id}</span>
          <h2 id="quote-title" ref={headingRef} tabIndex={-1}>
            Cotización para <span className="sf-plate">{stay.patente}</span>
          </h2>
        </div>
        <button
          className="sf-icon-button"
          aria-label="Cerrar cotización"
          disabled={operations.busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      {loading && <p role="status">Calculando importe en el servidor…</p>}
      {error && (
        <div className="sf-notice sf-error" role="alert">
          <p>{error.message}</p>
          {error.code === "LEGACY_FECHA_REQUIERE_REVISION" && (
            <p>
              {canReview ? (
                <button className="sf-button" onClick={onReview}>
                  Revisar fecha histórica
                </button>
              ) : (
                "Solicitá a un administrador que revise la fecha histórica antes de cotizar."
              )}
            </p>
          )}
          <button className="sf-button" onClick={onRefresh}>
            Reintentar cotización
          </button>
        </div>
      )}
      {quote && (
        <>
          <div className="sf-quote-amount">
            <div>
              <span>Importe a registrar</span>
              <strong>{money(quote.monto)}</strong>
              <small>ARS · importe calculado por el servidor</small>
            </div>
            <div
              className={`sf-badge ${expired ? "sf-badge-warning" : "sf-badge-success"}`}
            >
              <Clock size={16} />
              {expired
                ? "Cotización vencida"
                : `Vigente por ${Math.max(0, Math.ceil((expires - now) / 1000))} s`}
            </div>
          </div>
          {quote.origen_reglas !== "INGRESO" && (
            <p className="sf-notice sf-warning">
              Estadía heredada: se aplicó la configuración vigente al cotizar.
              No representa una tarifa histórica recuperada.
            </p>
          )}
          {explanation && (
            <dl className="sf-quote-detail">
              <div>
                <dt>Tiempo calculado</dt>
                <dd>{explanation.minutos_totales} min</dd>
              </div>
              <div>
                <dt>Tarifa por hora</dt>
                <dd>{money(explanation.tarifa_hora)}</dd>
              </div>
              <div>
                <dt>Cortesía</dt>
                <dd>{explanation.cortesia_minutos} min, inclusiva</dd>
              </div>
              <div>
                <dt>Fracción posterior a la hora</dt>
                <dd>{explanation.fraccion_minutos} min</dd>
              </div>
              <div>
                <dt>Fracciones adicionales</dt>
                <dd>{explanation.fracciones_adicionales}</dd>
              </div>
              <div>
                <dt>Descuento aplicado</dt>
                <dd>{money(explanation.descuento_importe)}</dd>
              </div>
            </dl>
          )}
          <p className="sf-help">
            Calculada {dateTime(quote.calculada_en)}. Después de la cortesía se
            cobra la primera hora completa y luego las fracciones configuradas.
            Redondeo a dos decimales.
          </p>
          <PendingOperations operations={operations} type="SALIDA" />
          {operations.error && (
            <p className="sf-notice sf-error" role="alert">
              {operations.error}
            </p>
          )}
          {finalized && (
            <p className="sf-notice sf-warning">
              Esta estadía ya fue finalizada. Actualizá la lista y recuperá el
              comprobante autorizado, sin registrar otro cobro.{" "}
              <button className="sf-button" onClick={onClose}>
                Volver a la lista
              </button>
            </p>
          )}
          {!pending && !finalized && (
            <>
              <fieldset
                className="sf-payment-methods"
                disabled={operations.busy || expired}
              >
                <legend>Medio de pago registrado</legend>
                {Object.entries(paymentLabels).map(([value, label]) => (
                  <label
                    key={value}
                    className={method === value ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value={value}
                      checked={method === value}
                      onChange={() => setMethod(value)}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <div className="sf-quote-confirm">
                {expired ? (
                  <button className="sf-button sf-primary" onClick={onRefresh}>
                    <RefreshCw size={18} /> Actualizar cotización
                  </button>
                ) : (
                  <button
                    className="sf-button sf-primary"
                    disabled={operations.busy || !cash}
                    onClick={() => onConfirm(method)}
                  >
                    {operations.busy
                      ? "Registrando…"
                      : `Registrar cobro de ${money(quote.monto)}`}
                  </button>
                )}
                <span>
                  {cash
                    ? `Se registrará en el turno #${cash.id}.`
                    : "Se necesita una caja abierta para confirmar."}{" "}
                  Registrar el medio no confirma una transacción bancaria.
                </span>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
