import React, { useEffect, useState, useRef } from "react";
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

  const [filterTerm, setFilterTerm] = useState(""); // <--- Nuevo: Para buscar en la tabla
  const socketRef = useRef(null);
  const lastEventRef = useRef(null); // <--- Referencia para evitar duplicados
  const timerRef = useRef(null);

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

  // 2. Función para manejar el Modo Foco (Filtrar y limpiar solo)
  const activateFocusMode = (patente) => {
    // Si ya había un cronómetro corriendo, lo frenamos
    if (timerRef.current) clearTimeout(timerRef.current);

    setFilterTerm(patente);

    // A los 5 segundos, limpiamos el buscador automáticamente
    timerRef.current = setTimeout(() => {
      setFilterTerm("");
      timerRef.current = null;
    }, 5000);
  };

  // 3. El useEffect blindado
  useEffect(() => {
    if (!localStorage.getItem("token")) return;

    fetchData();
    const interval = setInterval(fetchData, 60000);

    const connect = () => {
      // ESCUDO 1: Si ya hay un socket conectando o abierto, no creamos otro
      if (
        socketRef.current &&
        (socketRef.current.readyState === WebSocket.OPEN ||
          socketRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      const socket = new WebSocket("ws://localhost:8000/ws");

      socket.onopen = () => console.log("✅ WS Conectado");

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // ESCUDO 2: Anti-Duplicados por Contenido
        // Creamos una "llave" única para este evento (ej: NUEVO_INGRESO-ABC123)
        const eventKey = `${data.event}-${data.patente}`;

        // Si recibimos la misma llave en menos de 2 segundos, la ignoramos
        if (lastEventRef.current === eventKey) return;

        lastEventRef.current = eventKey;
        setTimeout(() => {
          lastEventRef.current = null;
        }, 2000);

        // LANZAR NOTIFICACIÓN (Una sola vez)
        toast.info(`Movimiento: ${data.patente}`, {
          description:
            data.event === "NUEVO_INGRESO"
              ? "Ingresó ahora"
              : "Salió del predio",
          action: {
            label: "VER",
            onClick: () => activateFocusMode(data.patente), // <--- Activa filtro con autolimpieza
          },
        });

        fetchData();
      };

      socket.onclose = (e) => {
        if (!e.wasClean) {
          console.log("WS Reintentando...");
          setTimeout(connect, 5000);
        }
      };

      socket.onerror = () => socket.close();
      socketRef.current = socket; // Guardamos el socket en la referencia
    };

    connect();

    return () => {
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  // Filtramos los vehículos según lo que el usuario busque o clickee en la noti
  const filteredVehicles = activeVehicles.filter((v) =>
    v.patente.toLowerCase().includes(filterTerm.toLowerCase()),
  );

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

          <div className="space-y-4">
            {/* Buscador para la tabla de activos */}
            <div className="flex justify-end">
              <input
                type="text"
                placeholder="Filtrar activos..."
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 w-48 transition-all"
                value={filterTerm}
                onChange={(e) => setFilterTerm(e.target.value.toUpperCase())}
              />
              {filterTerm && (
                <button
                  onClick={() => setFilterTerm("")}
                  className="ml-2 text-[10px] font-black text-slate-400 hover:text-red-500 uppercase"
                >
                  Limpiar
                </button>
              )}
            </div>

            <ActiveTable
              vehicles={filteredVehicles} // <--- Pasamos la lista filtrada
              onCheckout={handleCheckout}
              isLoading={loading}
            />
          </div>
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
