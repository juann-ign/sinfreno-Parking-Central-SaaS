import React, { useState, useEffect, useMemo } from "react";
import { TableRowSkeleton } from "./Skeletons";
import { motion, AnimatePresence } from "framer-motion";
import { differenceInMinutes } from "date-fns";
import { useAuth } from "../src/context/AuthContext";
import { Clock } from "lucide-react";

const TimeBadge = ({ entryDate }) => {
  const { user } = useAuth();
  const courtesyMin = Number(user?.sucursal?.tiempo_cortesia_min) || 10;

  const getMinutes = () => {
    const now = new Date();
    // FORZAMOS UTC: Si la fecha no termina en Z, se la agregamos
    const utcDate = entryDate.endsWith("Z") ? entryDate : `${entryDate}Z`;
    const entry = new Date(utcDate);

    const diff = differenceInMinutes(now, entry);
    // Si diff es negativo (por segundos de diferencia entre server/client), es 0
    return diff < 0 ? 0 : diff;
  };

  const [minutes, setMinutes] = useState(getMinutes());

  useEffect(() => {
    setMinutes(getMinutes());
    const interval = setInterval(() => {
      const m = getMinutes();
      console.log(
        `DEBUG: Patente: ${m} min transcurridos | Cortesía: ${courtesyMin}`,
      );
      setMinutes(m);
    }, 15000);
    return () => clearInterval(interval);
  }, [entryDate, courtesyMin]);

  let colorClass = "";
  let label = "";

  if (minutes < courtesyMin) {
    colorClass = "bg-emerald-100 text-emerald-700 border-emerald-200";
    label = "RECIÉN INGRESADO";
  } else if (minutes < 60) {
    colorClass = "bg-indigo-50 text-indigo-600 border-indigo-100";
    label = `${minutes} MINUTOS`;
  } else {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const remMinutes = minutes % 60;

    colorClass =
      days >= 1
        ? "bg-rose-600 text-white border-rose-700 shadow-sm"
        : "bg-rose-50 text-rose-600 border-rose-200";

    label = days >= 1 ? `${days}D ${hours}H` : `${hours}H ${remMinutes}M`;
  }

  return (
    <div
      className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider transition-all duration-500 ${colorClass}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full bg-current mr-2 ${minutes < courtesyMin ? "animate-pulse" : ""}`}
      />
      {label}
    </div>
  );
};

const ActiveTable = ({ vehicles, onCheckout, isLoading }) => {
  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header adaptable */}
      <div className="p-5 lg:p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
        <h3 className="font-arvo text-base lg:text-lg font-bold text-slate-800 uppercase">
          Vehículos en Planta
        </h3>
        <span className="bg-white border border-slate-200 text-slate-400 text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-widest shadow-sm">
          {vehicles.length} Activos
        </span>
      </div>

      <div className="overflow-y-auto flex-1 custom-scroll">
        <table className="w-full text-left border-collapse">
          {/* OCULTAR THEAD EN MOBILE */}
          <thead className="hidden lg:table-header-group bg-white sticky top-0 z-20">
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
              <th className="px-8 py-5">Vehículo</th>
              <th className="px-8 py-5">Ubicación</th>
              <th className="px-8 py-5">Tiempo</th>
              <th className="px-8 py-5 text-right">Acción</th>
            </tr>
          </thead>

          <motion.tbody layout className="flex flex-col lg:table-row-group">
            <AnimatePresence mode="popLayout">
              {vehicles.map((v) => (
                <motion.tr
                  key={v.id}
                  layout
                  className="flex flex-col lg:table-row border-b border-slate-100 p-4 lg:p-0 hover:bg-slate-50 transition-colors"
                >
                  {/* Vehículo */}
                  <td className="px-4 lg:px-8 py-2 lg:py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-slate-100 flex items-center justify-center text-xl lg:text-2xl">
                        {v.tipo_vehiculo === "MOTO"
                          ? "🏍️"
                          : v.tipo_vehiculo === "CAMIONETA"
                            ? "🚐"
                            : "🚗"}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-base lg:text-lg leading-none uppercase">
                          {v.patente}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest lg:hidden">
                          {v.tipo_vehiculo} • Torre {v.torre_id}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Ubicación - OCULTA EN MOBILE (se integra arriba) */}
                  <td className="hidden lg:table-cell px-8 py-6">
                    <span className="text-sm font-black text-slate-600 uppercase italic">
                      Torre {v.torre_id}
                    </span>
                  </td>

                  {/* Tiempo */}
                  <td className="px-4 lg:px-8 py-2 lg:py-6">
                    <TimeBadge entryDate={v.fecha_entrada} />
                  </td>

                  {/* Acción - Botón grande en mobile */}
                  <td className="px-4 lg:px-8 py-4 lg:py-6 lg:text-right">
                    <button
                      onClick={() => onCheckout(v.patente)}
                      className="w-full lg:w-auto bg-slate-900 text-white px-6 py-3 lg:py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 active:scale-95 transition-all shadow-lg"
                    >
                      Cobrar
                    </button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </motion.tbody>
        </table>
      </div>
    </div>
  );
};

export default ActiveTable;
