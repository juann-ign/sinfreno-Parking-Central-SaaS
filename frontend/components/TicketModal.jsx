import { useEffect, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import Dialog from "./Dialog.jsx";
import TicketBarcode from "./TicketBarcode.jsx";
import api from "../api/axios.js";
import { getTicketUrl } from "../config/connections.js";
import { dateTime, errorMessage, money } from "../ui/format.js";
import { PaymentLabel, VehicleLabel } from "../ui/presentation.jsx";
import { useAuth } from "../src/context/useAuth.js";

export default function TicketModal({
  isOpen, ticketData, onClose, autoPrint = false, onAfterAutoPrint, branchConfig,
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const downloadRef = useRef(null);
  const autoPrinted = useRef(false);
  const afterAutoPrint = useRef(onAfterAutoPrint);
  useEffect(() => {
    afterAutoPrint.current = onAfterAutoPrint;
  }, [onAfterAutoPrint]);
  useEffect(() => {
    if (!isOpen || !ticketData || !autoPrint || autoPrinted.current) return;
    const finish = () => afterAutoPrint.current?.();
    // Wait for the native dialog and its print layout to be mounted.
    const frame = requestAnimationFrame(() => {
      autoPrinted.current = true;
      window.addEventListener("afterprint", finish, { once: true });
      try {
        window.print();
      } catch {
        window.removeEventListener("afterprint", finish);
        setError("No se pudo abrir la impresión. Podés volver a intentarlo o descargar el PDF.");
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", finish);
    };
  }, [isOpen, ticketData, autoPrint]);
  useEffect(() => () => downloadRef.current?.abort(), []);
  if (!isOpen || !ticketData) return null;
  const exit =
    ticketData.estado === "FINALIZADO" || Boolean(ticketData.fecha_salida);
  const currentBranch = branchConfig?.id === ticketData.sucursal_id ? branchConfig : null;
  const branch = currentBranch?.nombre || ticketData.sucursal_nombre || (
    ticketData.sucursal_id === user.sucursal?.id ? user.sucursal.nombre : null
  );
  const address = currentBranch ? currentBranch.direccion : ticketData.sucursal_direccion;
  const phone = currentBranch ? currentBranch.telefono : ticketData.sucursal_telefono;
  const printReceipt = () => {
    try {
      window.print();
    } catch {
      setError("No se pudo abrir la impresión. Podés descargar el PDF.");
    }
  };
  const download = async () => {
    setBusy(true);
    setError("");
    const token = localStorage.getItem("token");
    const controller = new AbortController();
    downloadRef.current = controller;
    try {
      const { data } = await api.get(getTicketUrl(ticketData.id), {
        params: { tipo: exit ? "SALIDA" : "INGRESO" },
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
              : failure.response?.status === 409
              ? "La estadía cambió. Abrí el comprobante actualizado."
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
      <article className="sf-receipt" id="sinfreno-print-receipt">
        {exit && (
          <div className="sf-receipt-status">
            <strong>X</strong>
            DOCUMENTO NO VALIDO COMO FACTURA
          </div>
        )}
        <header className="sf-receipt-header">
          {branch && <p className="sf-receipt-branch">{branch}</p>}
          {address && <p>{address}</p>}
          {phone && <p>Tel. {phone}</p>}
          <p>Comprobante de {exit ? "salida" : "ingreso"} · #{ticketData.id}</p>
        </header>
        <h3 className="sf-plate">{ticketData.patente}</h3>
        <div className="sf-receipt-vehicle">
          <VehicleLabel category={ticketData.tipo_vehiculo} />
          {ticketData.torre_numero != null && <span>Sector {ticketData.torre_numero}</span>}
        </div>
        <dl>
          <div>
            <dt>Ingreso</dt>
            <dd>{dateTime(ticketData.fecha_entrada, { showSeconds: true })}</dd>
          </div>
          {exit && (
            <>
              <div>
                <dt>Salida</dt>
                <dd>{dateTime(ticketData.fecha_salida, { showSeconds: true })}</dd>
              </div>
              {ticketData.duracion_estadia && (
                <div>
                  <dt>Duración</dt>
                  <dd>{ticketData.duracion_estadia}</dd>
                </div>
              )}
              <div>
                <dt>Medio registrado</dt>
                <dd>
                  <PaymentLabel method={ticketData.metodo_pago} />
                </dd>
              </div>
              <div className="sf-total">
                <dt>Total (ARS)</dt>
                <dd>{money(ticketData.monto)}</dd>
              </div>
            </>
          )}
        </dl>
        {!exit && <TicketBarcode stayId={ticketData.id} />}
        <footer className="sf-receipt-footer">
          <p>{exit
            ? "El medio registrado no acredita una transacción bancaria."
            : "Conservá este ticket para la salida. Comprobante de ingreso sin valor fiscal."}</p>
          <p className="sf-receipt-consumer">Orientación al Consumidor<br />Provincia de Buenos Aires · 148</p>
        </footer>
      </article>
      {error && (
        <p className="sf-notice sf-error" role="alert">
          {error}
        </p>
      )}
      <div className="sf-dialog-actions">
        <button className="sf-button sf-primary" data-autofocus onClick={printReceipt}>
          <Printer size={18} aria-hidden="true" /> Imprimir comprobante
        </button>
        <button
          className="sf-button"
          disabled={busy}
          onClick={download}
        >
          <Download size={18} />
          {busy ? "Descargando…" : "Descargar PDF"}
        </button>
        <button className="sf-button" onClick={onClose}>Continuar</button>
      </div>
    </Dialog>
  );
}
