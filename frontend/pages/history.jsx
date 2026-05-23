import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Calendar, Search, FileStack } from "lucide-react";

const History = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  // --- SUB-COMPONENTE DE SKELETON (Solo visual) ---
  const SkeletonRow = () => (
    <tr className="animate-pulse">
      <td className="px-6 py-4">
        <div className="h-8 w-24 bg-slate-200 rounded-xl"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-32 bg-slate-100 rounded"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-20 bg-slate-100 rounded"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-16 bg-emerald-50 rounded"></div>
      </td>
    </tr>
  );

  const fetchHistory = async (term) => {
    try {
      setLoading(true);
      const response = await api.get(
        `/parking/historial?size=50&patente=${term}`,
      );
      setRecords(response.data.items);
    } catch (error) {
      console.error("Error al cargar historial");
    } finally {
      // Agregamos un pequeño delay artificial de 500ms
      // para que el usuario llegue a ver la transición suave
      setTimeout(() => setLoading(false), 500);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchHistory(searchTerm);
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
            Auditoría de <span className="text-indigo-600">Movimientos</span>
          </h1>
        </div>
      </nav>

      <main className="p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden border border-slate-200">
          <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="BUSCAR PATENTE (EJ: ABC123)..."
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-6 py-4">Vehículo</th>
                  <th className="px-6 py-4">Ingreso</th>
                  <th className="px-6 py-4">Salida</th>
                  <th className="px-6 py-4">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  // MOSTRAR 8 FILAS DE SKELETON MIENTRAS CARGA
                  [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="bg-slate-100 p-4 rounded-full">
                          <FileStack size={40} className="text-slate-300" />
                        </div>
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">
                          No se encontraron registros
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-indigo-50/30 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <span className="font-mono font-black bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 shadow-sm group-hover:border-indigo-200">
                          {r.patente}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
                          <Calendar size={14} className="text-slate-300" />
                          {new Date(r.fecha_entrada).toLocaleDateString()}
                          <Clock size={14} className="text-slate-300 ml-1" />
                          {new Date(r.fecha_entrada).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
                          <Clock size={14} className="text-slate-300" />
                          {new Date(r.fecha_salida).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-emerald-600 font-black text-sm">
                          ${r.monto.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default History;
