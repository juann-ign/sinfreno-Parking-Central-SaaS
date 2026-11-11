import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Printer, Download, CheckCircle2 } from "lucide-react";
import { getTicketUrl } from "../config/connections.js";
import api from "../api/axios.js";
import { toast } from "sonner";

const TicketModal = ({ isOpen, ticketData, onClose }) => {
  const [downloading, setDownloading] = useState(false);
  const downloadController = useRef(null);
  useEffect(() => () => downloadController.current?.abort(), [isOpen, ticketData?.id]);
  if (!isOpen || !ticketData) return null;
  const isIngreso = !ticketData.fecha_salida;

  const handlePrint = () => {
    window.print(); // El CSS ocultará todo excepto el ticket
  };

  const handleDownload = async () => {
    if (downloading) return;
    const controller = new AbortController();
    downloadController.current = controller;
    setDownloading(true);
    try {
      const { data } = await api.get(getTicketUrl(ticketData.id), {
        responseType: "blob",
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ticket_${ticketData.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      if (!controller.signal.aborted) {
        toast.error(error.response?.status === 403
          ? "No tenés permiso para descargar este comprobante."
          : error.response?.status === 404
            ? "No se encontró el comprobante en tu sucursal."
            : "No se pudo descargar el comprobante.");
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Ticket Card */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden print:shadow-none print:m-0"
        >
          {/* Header decorativo */}
          <div className="bg-indigo-600 p-6 text-center text-white print:hidden">
            <div className="flex justify-center mb-2">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight">
              {isIngreso ? "Ingreso registrado" : "Pago Exitoso"}
            </h2>
            <p className="text-indigo-100 text-xs font-bold opacity-80">
              {isIngreso ? "Comprobante de Ingreso" : "Comprobante de Salida"}
            </p>
          </div>

          {/* Cuerpo del Ticket (Lo que se imprime) */}
          <div className="p-8 font-mono text-slate-800 print:p-0">
            <div className="text-center mb-6 border-b-2 border-dashed border-slate-200 pb-6">
              <h3 className="text-2xl font-black tracking-tighter">
                SINFRENO PARKING
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                Cuit: 30-11111111-9
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 uppercase font-bold">
                  Patente:
                </span>
                <span className="font-black text-sm">{ticketData.patente}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 uppercase font-bold">
                  Entrada:
                </span>
                <span>
                  {new Date(ticketData.fecha_entrada).toLocaleString()}
                </span>
              </div>
              {!isIngreso && <div className="flex justify-between text-xs">
                <span className="text-slate-400 uppercase font-bold">
                  Salida:
                </span>
                <span>
                  {new Date(ticketData.fecha_salida).toLocaleString()}
                </span>
              </div>}
              <div className="flex justify-between text-xs border-t border-slate-100 pt-3">
                <span className="text-slate-400 uppercase font-bold">
                  Tipo:
                </span>
                <span className="font-bold">{ticketData.tipo_vehiculo}</span>
              </div>
            </div>

            {/* Total */}
            {!isIngreso && <div className="bg-slate-50 p-4 rounded-2xl text-center mb-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Total Cobrado
              </p>
              <p className="text-3xl font-black text-indigo-600">
                ${ticketData.monto}
              </p>
            </div>}

            {/* QR Placeholder (Demuestra nivel técnico) */}
            <div className="flex justify-center mb-6 opacity-20">
              <div className="w-24 h-24 bg-slate-900 rounded-lg"></div>
            </div>

            <p className="text-[9px] text-center text-slate-400 font-bold uppercase leading-relaxed">
              Gracias por su visita.
              <br />
              Conserve este ticket para salir.
            </p>
          </div>

          {/* Botones de Acción */}
          <div className="p-4 bg-slate-50 flex gap-3 print:hidden">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
            >
              <Printer size={14} /> Imprimir
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex-1 py-3 px-4 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all"
            >
              <Download size={14} /> {downloading ? "Descargando…" : "PDF"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TicketModal;
