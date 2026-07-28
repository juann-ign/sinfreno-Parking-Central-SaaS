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
  const { user } = useAuth();

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0 font-sans">
        <div className="flex items-center gap-4">
          <h3 className="font-arvo text-lg font-bold text-slate-800 uppercase tracking-tight">
            Vehículos en Planta
          </h3>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <Clock size={12} className="text-indigo-500" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Cortesía:{" "}
              <span className="text-indigo-600 font-black">
                {user?.sucursal?.tiempo_cortesia_min ?? 0} min
              </span>
            </span>
          </div>
        </div>
        <span className="font-sans bg-white border border-slate-200 text-slate-400 text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-[0.2em] shadow-sm">
          {vehicles.length} Activos
        </span>
      </div>

      <div className="overflow-y-auto flex-1 custom-scroll">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white sticky top-0 z-20">
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
              <th className="px-8 py-5">Vehículo</th>
              <th className="px-8 py-5">Ubicación</th>
              <th className="px-8 py-5">Tiempo Transcurrido</th>
              <th className="px-8 py-5 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="relative">
            <AnimatePresence mode="popLayout" initial={true}>
              {!isLoading &&
                vehicles.map((v) => (
                  <motion.tr
                    key={v.id}
                    layout
                    // ANIMACIÓN DE ENTRADA CORREGIDA: Usamos opacity y y-offset
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      scale: 0.95,
                      transition: { duration: 0.2 },
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                    className="hover:bg-slate-50/80 transition-colors group border-b border-slate-50"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl group-hover:bg-white transition-all shadow-sm">
                          {v.tipo_vehiculo === "MOTO"
                            ? "🏍️"
                            : v.tipo_vehiculo === "CAMIONETA"
                              ? "🚐"
                              : "🚗"}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-lg leading-none uppercase tracking-tight">
                            {v.patente}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1.5 tracking-widest">
                            {v.tipo_vehiculo}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-black text-slate-600 tracking-tight italic uppercase">
                        Torre {v.torre_id}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <TimeBadge entryDate={v.fecha_entrada} />
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button
                        onClick={() => onCheckout(v.patente)}
                        className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all active:scale-95 shadow-lg shadow-transparent hover:shadow-indigo-100"
                      >
                        Cobrar
                      </button>
                    </td>
                  </motion.tr>
                ))}
            </AnimatePresence>
            {isLoading &&
              [...Array(5)].map((_, i) => <TableRowSkeleton key={i} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActiveTable;
