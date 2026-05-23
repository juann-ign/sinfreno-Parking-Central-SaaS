import React, { useEffect, useState } from "react";
import api from "../api/axios";
import ActiveTable from "../components/ActiveTable";
import EntryForm from "../components/EntryForm";
import { SkeletonCard } from "../components/Skeletons"; // Cambiado a SkeletonCard
import {
  Car,
  PieChart,
  LogOut,
  History as HistoryIcon,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Dashboard = ({ onLogout }) => {
  const [stats, setStats] = useState(null);
  const [activeVehicles, setActiveVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [statsRes, activeRes] = await Promise.all([
        api.get("/stats/summary"),
        api.get("/parking/activas"),
      ]);
      setStats(statsRes.data);
      setActiveVehicles(activeRes.data);
    } catch (error) {
      console.error("Error cargando datos", error);
    } finally {
      // Mantenemos el pequeño delay para suavizar la transición del skeleton
      setTimeout(() => setLoading(false), 800);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleCheckout = async (patente) => {
    if (!patente) {
      toast.error("No se pudo leer la patente");
      return;
    }
    try {
      const response = await api.post(
        `/parking/salida?patente=${encodeURIComponent(patente)}`,
      );
      toast.success(`Cobrado: $${response.data.monto}`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error en salida");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* HEADER */}
      <nav className="bg-white border-b border-slate-200 px-8 py-3 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white">
            <Car size={20} />
          </div>
          <h1 className="text-xl font-black text-slate-800 tracking-tighter">
            SINFRENO <span className="text-indigo-600 text-xs">PRO</span>
          </h1>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => navigate("/history")}
            className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-2 transition-colors"
          >
            <HistoryIcon size={16} /> HISTORIAL
          </button>
          <button
            onClick={onLogout}
            className="text-xs font-bold text-red-400 hover:text-red-600 flex items-center gap-2 transition-colors border-l pl-4"
          >
            <LogOut size={16} /> SALIR
          </button>
        </div>
      </nav>

      {/* GRID PRINCIPAL */}
      <main className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-[1600px] mx-auto w-full">
        {/* COLUMNA IZQUIERDA (OPERATIVA) */}
        <div className="lg:col-span-8 space-y-8">
          <EntryForm onEntrySuccess={fetchData} />

          {/* Dejamos que ActiveTable maneje su propio loading interno para que el diseño no salte */}
          <ActiveTable
            vehicles={activeVehicles}
            onCheckout={handleCheckout}
            isLoading={loading}
          />
        </div>

        {/* COLUMNA DERECHA (ESTRATEGIA) */}
        <aside className="lg:col-span-4 space-y-6">
          {/* CARD DE RECAUDACIÓN */}
          {loading ? (
            <SkeletonCard />
          ) : (
            <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-200 overflow-hidden relative">
              <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-2">
                Recaudación Hoy
              </p>
              <h3 className="text-5xl font-black mb-6 tracking-tighter">
                ${stats?.recaudacion_hoy || 0}
              </h3>
              <div className="flex justify-between items-center bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                <div>
                  <p className="text-[9px] font-bold opacity-60 uppercase">
                    Ocupación
                  </p>
                  <p className="text-xl font-black">
                    {stats?.porcentaje_ocupacion}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold opacity-60 uppercase">
                    Disponibles
                  </p>
                  <p className="text-xl font-black text-emerald-300">
                    {stats?.capacidad_disponible}
                  </p>
                </div>
              </div>
              <Activity
                className="absolute -right-4 -top-4 text-white/5"
                size={160}
              />
            </div>
          )}

          {/* CARD DE CAPACIDAD */}
          {loading ? (
            <div className="bg-white rounded-[2rem] p-8 border border-slate-200 animate-pulse">
              <div className="h-4 w-32 bg-slate-100 rounded mb-8"></div>
              <div className="space-y-4">
                <div className="h-2 w-full bg-slate-100 rounded"></div>
                <div className="h-2 w-full bg-slate-100 rounded"></div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <PieChart size={14} /> Capacidad de Bahías
              </h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-slate-500 uppercase">
                      Lugares Disponibles
                    </span>
                    <span className="text-emerald-500">
                      {stats?.capacidad_disponible}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${(stats?.capacidad_disponible / (stats?.autos_adentro + stats?.capacidad_disponible)) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BOTÓN REPORTE (Siempre visible fuera de los ternarios) */}
          <button
            onClick={() => toast.info("Generando reporte...")}
            className="w-full bg-slate-900 hover:bg-black text-white rounded-[2rem] p-6 transition-all group flex flex-col items-center justify-center border-2 border-slate-800"
          >
            <div className="bg-white/10 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
              <Activity className="text-indigo-400" size={24} />
            </div>
            <p className="text-[10px] font-black opacity-50 uppercase tracking-[0.2em] mb-1">
              Business Intelligence
            </p>
            <p className="text-base font-extrabold">GENERAR REPORTE PDF</p>
          </button>
        </aside>
      </main>
    </div>
  );
};

export default Dashboard;
