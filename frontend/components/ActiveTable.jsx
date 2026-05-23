import React from "react";
import { TableRowSkeleton } from "./Skeletons";
import { LogOut, Clock, MapPin } from "lucide-react";

const ActiveTable = ({ vehicles, onCheckout, isLoading }) => {
  return (
    <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden border border-slate-200 flex flex-col h-full">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h3 className="font-black text-slate-700 uppercase tracking-tighter text-lg">
          Vehículos en Planta
        </h3>
        {isLoading ? (
          <div className="h-6 w-20 bg-slate-200 rounded-full animate-pulse"></div>
        ) : (
          <span className="bg-indigo-100 text-indigo-600 text-[10px] font-black px-3 py-1 rounded-full uppercase">
            {vehicles.length} Activos
          </span>
        )}
      </div>

      <div className="overflow-y-auto flex-1 custom-scroll max-h-[500px]">
        <table className="w-full text-left">
          <thead className="bg-white sticky top-0 z-10">
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <th className="px-6 py-4">Vehículo</th>
              <th className="px-6 py-4">Ubicación</th>
              <th className="px-6 py-4 text-center">Ingreso</th>
              <th className="px-6 py-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading
              ? // Si está cargando, muestra 5 filas de skeleton
                [...Array(5)].map((_, i) => <TableRowSkeleton key={i} />)
              : // Si no, muestra los vehículos reales
                vehicles.map((v) => (
                  <tr
                    key={v.id}
                    className="hover:bg-indigo-50/30 transition-colors group border-b border-slate-50"
                  >
                    <td className="px-6 py-4">
                      <span className="text-xl">
                        {v.tipo_vehiculo === "MOTO"
                          ? "🏍️"
                          : v.tipo_vehiculo === "CAMIONETA"
                            ? "🚐"
                            : v.tipo_vehiculo === "AUTO"
                              ? "🚗"
                              : "🚗"}
                      </span>
                      <p className="font-black text-slate-800 text-lg leading-none">
                        {v.patente}
                      </p>
                      <p className="text-[10px] font-bold text-indigo-500 uppercase mt-1">
                        {v.tipo_vehiculo}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-600 italic">
                      Torre {v.torre_id}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg text-xs">
                        {new Date(v.fecha_entrada).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => onCheckout(v.patente)}
                        className="text-red-500 hover:text-red-700 text-xs uppercase tracking-widest underline decoration-2 underline-offset-4 font-black"
                      >
                        Cobrar Salida
                      </button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActiveTable;
