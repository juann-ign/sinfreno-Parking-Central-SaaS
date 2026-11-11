import { useEffect, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import Dialog from "./Dialog.jsx";
import api from "../api/axios.js";
import { getTicketUrl } from "../config/connections.js";
import { dateTime, errorMessage, money, paymentLabels } from "../ui/format.js";

export default function TicketModal({ isOpen, ticketData, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const receiptRef = useRef(null);
  const downloadRef = useRef(null);
  useEffect(() => () => downloadRef.current?.abort(), []);
  if (!isOpen || !ticketData) return null;
  const exit =
    ticketData.estado === "FINALIZADO" || Boolean(ticketData.fecha_salida);
  const download = async () => {
    setBusy(true);
    setError("");
    const token = localStorage.getItem("token");
    const controller = new AbortController();
    downloadRef.current = controller;
    try {
      const { data } = await api.get(getTicketUrl(ticketData.id), {
        responseType: "blob",
        timeout: 15000,
        signal: controller.signal,
        sessionToken: token,
      });
      if (controller.signal.aborted || localStorage.getItem("token") !== token)
        return;
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sinfreno_${exit ? "salida" : "ingreso"}_${ticketData.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          errorMessage(
            failure,
            failure.response?.status === 403
              ? "No tenés permiso para descargar este comprobante."
              : "No se pudo descargar el comprobante. Verificá conexión y permisos antes de reintentar.",
          ),
        );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      title={exit ? "Cobro registrado" : "Ingreso registrado"}
      onClose={onClose}
    >
      <article
        ref={receiptRef}
        className="sf-receipt"
        id="sinfreno-print-receipt"
      >
        <div className="sf-receipt-brand">
          Sinfreno<span>.</span>
        </div>
        <p>
          Comprobante de {exit ? "salida" : "ingreso"} · #{ticketData.id}
        </p>
        <h3 className="sf-plate">{ticketData.patente}</h3>
        <dl>
          <div>
            <dt>Categoría</dt>
            <dd>{ticketData.tipo_vehiculo}</dd>
          </div>
          <div>
            <dt>Ingreso</dt>
            <dd>{dateTime(ticketData.fecha_entrada)}</dd>
          </div>
          {exit && (
            <>
              <div>
                <dt>Salida</dt>
                <dd>{dateTime(ticketData.fecha_salida)}</dd>
              </div>
              <div>
                <dt>Medio registrado</dt>
                <dd>
                  {paymentLabels[ticketData.metodo_pago] ||
                    ticketData.metodo_pago}
                </dd>
              </div>
              <div className="sf-total">
                <dt>Importe registrado</dt>
                <dd>{money(ticketData.monto)}</dd>
              </div>
            </>
          )}
        </dl>
        <p className="sf-help">
          {exit
            ? "El registro del medio de pago no acredita una transacción bancaria."
            : "Conservá el comprobante de ingreso."}{" "}
          Comprobante operativo, sin integración fiscal.
        </p>
      </article>
      {error && (
        <p className="sf-notice sf-error" role="alert">
          {error}
        </p>
      )}
      <div className="sf-dialog-actions">
        <button className="sf-button" onClick={() => window.print()}>
          <Printer size={18} /> Imprimir comprobante
        </button>
        <button
          className="sf-button sf-primary"
          disabled={busy}
          onClick={download}
        >
          <Download size={18} />
          {busy ? "Descargando…" : "Descargar PDF"}
        </button>
      </div>
    </Dialog>
  );
}
