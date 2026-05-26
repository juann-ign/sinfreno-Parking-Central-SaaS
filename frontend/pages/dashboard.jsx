import React, { useEffect, useState, useRef } from "react";
import api from "../api/axios";
import ActiveTable from "../components/ActiveTable";
import EntryForm from "../components/EntryForm";
import { SkeletonCard } from "../components/Skeletons";
import RevenueChart from "../components/RevenueChart";
import OccupancyPieChart from "../components/OccupancyPieChart";
import {
  Car,
  PieChart,
  LogOut,
  History as HistoryIcon,
  Activity,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Dashboard = ({ onLogout }) => {
  const [stats, setStats] = useState(null);
  const [activeVehicles, setActiveVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Guardaremos aquí el array de {hora: X, monto: Y}
  const [hourlyData, setHourlyData] = useState([]);

  // --- ESTADOS DE BÚSQUEDA Y FOCO ---
  const [filterTerm, setFilterTerm] = useState("");
  const [isFocusMode, setIsFocusMode] = useState(false);

  // --- REFERENCIAS (MEMORIA TÉCNICA) ---
  const socketRef = useRef(null);
  const lastEventRef = useRef(null); // <--- Referencia para evitar duplicados
  const timerRef = useRef(null);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [statsRes, activeRes, hourlyRes] = await Promise.all([
        api.get("/stats/summary"),
        api.get("/parking/activas"),
        api.get("/stats/revenue-hourly"),
      ]);
      setStats(statsRes.data);
      setActiveVehicles(activeRes.data);
      setHourlyData(hourlyRes.data);
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
    setIsFocusMode(true);

    // A los 5 segundos, limpiamos el buscador automáticamente
    timerRef.current = setTimeout(() => {
      setFilterTerm("");
      setIsFocusMode(false);
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

      socket.onclose = () => setTimeout(connect, 5000);
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
      // Notificación de cobro exitoso
      toast.success(`Vehículo ${patente} egresó correctamente.`, {
        description: `Cobrado: $${response.data.monto}`,
        duration: 5000,
      });

      fetchData();
    } catch (error) {
      console.error("Error en salida:", error);
      toast.error(
        error.response?.data?.detail || "Error al procesar la salida",
      );
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

          {/* BARRA DE BÚSQUEDA DE ALTO IMPACTO */}
          <div className="bg-white p-4 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400">
                <Search size={22} />
              </div>
              <input
                type="text"
                placeholder="BUSCAR VEHÍCULO POR PATENTE..."
                className={`w-full pl-14 pr-4 py-5 rounded-[1.5rem] border-2 transition-all font-black text-xl outline-none ${
                  isFocusMode
                    ? "border-amber-400 bg-amber-50 text-amber-900 shadow-[0_0_15px_rgba(251,191,36,0.2)]"
                    : "border-slate-100 bg-slate-50 focus:border-indigo-500 focus:bg-white"
                }`}
                value={filterTerm}
                onChange={(e) => {
                  setFilterTerm(e.target.value.toUpperCase());
                  setIsFocusMode(false); // Si el usuario escribe, quitamos el modo automático
                }}
              />
            </div>

            {(filterTerm !== "" || isFocusMode) && (
              <button
                onClick={() => {
                  setFilterTerm("");
                  setIsFocusMode(false);
                }}
                className="w-full md:w-auto px-8 py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.15em] hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <X size={18} /> MOSTRAR TODOS
              </button>
            )}
          </div>

          <ActiveTable
            vehicles={filteredVehicles}
            onCheckout={handleCheckout}
            isLoading={loading}
          />
          {/* --- SECCIÓN DE GRÁFICO DE RECAUDACIÓN --- */}
          {/* Solo lo mostramos si no está cargando */}
          {!loading && (
            <div className="mt-8">
              <RevenueChart data={hourlyData} />
            </div>
          )}
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
            <div className="h-[300px] bg-white rounded-[2rem] animate-pulse"></div>
          ) : (
            <OccupancyPieChart
              occupied={stats?.autos_adentro || 0}
              available={stats?.capacidad_disponible || 0}
            />
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
