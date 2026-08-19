import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, X, Calculator, AlertTriangle } from "lucide-react";

const CashModal = ({ isOpen, mode, expectedAmount, onConfirm, onClose }) => {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
              <Wallet size={24} />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">
              {mode === "open" ? "Abrir Turno" : "Cerrar Caja"}
            </h2>
          </div>

          {mode === "close" && (
            <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Recaudación según sistema
              </p>
              <p className="text-2xl font-black text-slate-800">
                ${expectedAmount}
              </p>
            </div>
          )}

          <div className="space-y-4">
            {mode === "close" && (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                  Efectivo en Caja (Monto Real)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    className="w-full pl-8 pr-4 py-4 bg-slate-50 rounded-2xl font-black text-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                Notas / Observaciones
              </label>
              <textarea
                className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all h-24"
                placeholder="Ej: El turno empezó sin cambio..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={onClose}
              className="flex-1 py-4 px-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm({ amount: parseFloat(amount), notes })}
              className="flex-1 py-4 px-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-indigo-600 transition-all"
            >
              {mode === "open" ? "Iniciar Operación" : "Finalizar Turno"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CashModal;
