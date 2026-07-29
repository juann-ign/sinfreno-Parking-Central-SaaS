import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Printer, X, CheckCircle2 } from "lucide-react";

const TicketModal = ({ isOpen, ticketData, onClose }) => {
  if (!isOpen || !ticketData) return null;

  const handlePrint = () => {
    window.print(); // El CSS ocultará todo excepto el ticket
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
              Pago Exitoso
            </h2>
            <p className="text-indigo-100 text-xs font-bold opacity-80">
              Comprobante de Salida
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
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 uppercase font-bold">
                  Salida:
                </span>
                <span>
                  {new Date(ticketData.fecha_salida).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-xs border-t border-slate-100 pt-3">
                <span className="text-slate-400 uppercase font-bold">
                  Tipo:
                </span>
                <span className="font-bold">{ticketData.tipo_vehiculo}</span>
              </div>
            </div>

            {/* Total */}
            <div className="bg-slate-50 p-4 rounded-2xl text-center mb-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Total Cobrado
              </p>
              <p className="text-3xl font-black text-indigo-600">
                ${ticketData.monto}
              </p>
            </div>

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
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TicketModal;
