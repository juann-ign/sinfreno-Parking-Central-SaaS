import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, DollarSign, Calendar, Search } from "lucide-react";

const History = ({ onLogout }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

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
      setLoading(false);
    }
  };

  useEffect(() => {
    // Creo un temporizador para evitar hacer una petición en cada pulsación
    const delayDebounceFn = setTimeout(() => {
      fetchHistory(searchTerm);
    }, 400); // 400ms de retraso después de la última pulsación

    // Limpio el temporizador si el componente se desmonta o si searchTerm cambia antes de los 400ms
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header simple */}
      <nav className="bg-white shadow-sm px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-800">
            Historial de Estadías
          </h1>
        </div>
      </nav>

      <main className="p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-gray-500 text-sm">
                Mostrando los últimos registros de salida y cobros realizados.
              </p>
            </div>

            <div className="relative w-full md:w-64">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="Buscar por patente..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())} // Esto actualiza el estado
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Patente</th>
                  <th className="px-6 py-4 font-semibold">Ingreso</th>
                  <th className="px-6 py-4 font-semibold">Salida</th>
                  <th className="px-6 py-4 font-semibold">Total Cobrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.length === 0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-6 py-10 text-center text-gray-400"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Search size={40} className="opacity-20" />
                        <p>
                          {" "}
                          No se encontraron estadías con la patente{" "}
                          {searchTerm.toUpperCase()}.{" "}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-black bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700">
                            {r.patente}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                              {r.tipo_vehiculo === "MOTO"
                                ? "🏍️ Moto"
                                : r.tipo_vehiculo === "CAMIONETA"
                                  ? "🚐 Camioneta"
                                  : "🚗 Auto"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />{" "}
                          {new Date(r.fecha_entrada).toLocaleDateString()}
                          <Clock size={14} className="ml-2" />{" "}
                          {new Date(r.fecha_entrada).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm">
                        <div className="flex items-center gap-1">
                          <Clock size={14} />{" "}
                          {new Date(r.fecha_salida).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <DollarSign size={16} /> {r.monto}
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
