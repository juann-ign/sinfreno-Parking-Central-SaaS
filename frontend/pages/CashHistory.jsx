import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Wallet,
  Calendar,
  User,
  AlertCircle,
  CheckCircle2,
  FileStack,
} from "lucide-react";

const CashHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get("/cash/history");
        setHistory(res.data);
      } catch (err) {
        console.error("Error al cargar historial de cajas");
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
            Control de <span className="text-indigo-600">Cajas</span>
          </h1>
        </div>
      </nav>

      <main className="p-4 lg:p-10 max-w-6xl mx-auto">
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-5">Fecha / Turno</th>
                <th className="px-8 py-5">Responsable</th>
                <th className="px-8 py-5">Esperado</th>
                <th className="px-8 py-5">Real</th>
                <th className="px-8 py-5">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {history.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-700 text-sm">
                        {new Date(c.fecha_apertura).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {new Date(c.fecha_apertura).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        -
                        {c.fecha_cierre
                          ? new Date(c.fecha_cierre).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "ACTIVA"}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-slate-600 font-bold text-xs uppercase">
                      <User size={14} className="text-slate-300" />
                      ID: {c.usuario_id}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="font-black text-slate-500 text-sm">
                      ${c.monto_esperado.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="font-black text-slate-900 text-base">
                      ${c.monto_real?.toLocaleString() || "---"}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    {c.estado === "CERRADA" ? (
                      <div className="flex items-center gap-2">
                        {/* Cálculo de diferencia visual */}
                        {c.monto_real === c.monto_esperado ? (
                          <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-3 py-1 rounded-lg border border-emerald-200">
                            OK
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-700 text-[9px] font-black px-3 py-1 rounded-lg border border-rose-200">
                            DIFF: $
                            {(c.monto_real - c.monto_esperado).toFixed(2)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="animate-pulse bg-indigo-100 text-indigo-700 text-[9px] font-black px-3 py-1 rounded-lg border border-indigo-200">
                        ABIERTA
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length === 0 && !loading && (
            <div className="p-20 text-center text-slate-300 font-black uppercase text-xs tracking-widest">
              No hay registros de cajas cerradas
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CashHistory;
