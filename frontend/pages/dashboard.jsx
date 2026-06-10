import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../src/context/AuthContext";
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
  const { hasPermission, user } = useAuth();

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
      ]);
      setStats(statsRes.data);
      setActiveVehicles(activeRes.data);
      // Pedido que SOLO el admin puede hacer (Evitamos el error 403)
      if (hasPermission("ver_stats")) {
        const hourlyRes = await api.get("/stats/revenue-hourly");
        setHourlyData(hourlyRes.data);
      }
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
    <div className="h-screen w-full flex flex-col bg-slate-50 overflow-hidden">
      {/* HEADER */}
      <nav className="h-20 w-full bg-white border-b border-slate-100 px-10 flex justify-between items-center shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div
            className="p-2.5 rounded-2xl text-white shadow-lg"
            style={{ backgroundColor: user?.sucursal?.color || "#4f46e5" }}
          >
            <Car size={22} strokeWidth={2.5} />
          </div>
          <h1 className="font-arvo text-2xl font-bold text-slate-900 tracking-tight">
            {user?.sucursal?.nombre || "Sinfreno"}
            <span className="text-indigo-600">.</span>
          </h1>
        </div>

        <div className="flex items-center gap-8">
          {/* BOTÓN HISTORIAL: Solo Admin */}
          {hasPermission("ver_historial") && (
            <button
              onClick={() => navigate("/history")}
              className="font-sans text-xs font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-2 tracking-[0.15em] transition-all"
            >
              <HistoryIcon size={16} /> HISTORIAL
            </button>
          )}
          <button
            onClick={onLogout}
            className="font-sans text-xs font-bold text-rose-400 hover:text-rose-500 flex items-center gap-2 tracking-[0.15em] transition-all border-l pl-8 ml-2"
          >
            <LogOut size={16} /> SALIR
          </button>
        </div>
      </nav>

      {/* CONTENEDOR GLOBAL */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* COLUMNA IZQUIERDA: OPERATIVA (70%) */}
        <section className="flex-[7] flex flex-col gap-6 min-w-0">
          <div className="shrink-0">
            <EntryForm onEntrySuccess={fetchData} />
          </div>

          <div className="shrink-0 relative">
            <Search
              className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400"
              size={24}
            />
            <input
              type="text"
              placeholder="BUSCAR PATENTE EN PLANTA..."
              className="w-full pl-16 pr-8 py-5 rounded-[2rem] bg-white border-2 border-transparent shadow-sm focus:border-indigo-500 outline-none font-sans font-semibold text-xl transition-all"
              value={filterTerm}
              onChange={(e) => setFilterTerm(e.target.value.toUpperCase())}
            />
          </div>

          <div className="flex-1 min-h-0 bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
            <ActiveTable
              vehicles={filteredVehicles}
              onCheckout={handleCheckout}
              isLoading={loading}
            />
          </div>
        </section>

        {/* COLUMNA DERECHA: ESTRATÉGICA (30%) */}
        <aside className="flex-[3] flex flex-col gap-4 min-w-[340px]">
          {/* 1. CAJA HOY: Solo Admin */}
          {hasPermission("ver_stats") && (
            <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl shrink-0">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                Caja Hoy
              </p>
              <h3 className="text-4xl font-black mb-4 tracking-tighter">
                ${stats?.recaudacion_hoy || 0}
              </h3>
              <div className="flex justify-between text-[10px] font-black border-t border-white/10 pt-3">
                <span className="opacity-50 uppercase">Disponibles</span>
                <span className="text-emerald-400">
                  {stats?.capacidad_disponible} LUGARES
                </span>
              </div>
            </div>
          )}

          {/* 2. OCUPACIÓN: Admin y Operador */}
          {hasPermission("ver_ocupacion") && (
            <div className="flex-1 flex flex-col min-h-0">
              <OccupancyPieChart
                occupied={stats?.autos_adentro || 0}
                available={stats?.capacidad_disponible || 0}
              />
            </div>
          )}

          {/* 3. GRÁFICO HORARIO: Solo Admin */}
          {hasPermission("ver_stats") && (
            <div className="h-60 shrink-0">
              <RevenueChart data={hourlyData} />
            </div>
          )}

          {/* 4. BOTÓN REPORTE: Solo Admin */}
          {hasPermission("ver_stats") && (
            <button className="shrink-0 w-full bg-white border-2 border-slate-200 text-slate-400 py-4 rounded-[1.5rem] font-black text-[10px] tracking-[0.2em] uppercase hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all flex items-center justify-center gap-2">
              <HistoryIcon size={14} />
              Reporte Completo
            </button>
          )}

          {/* MODO OPERADOR: Mensaje visual si no es admin */}
          {!hasPermission("ver_stats") && (
            <div className="p-6 bg-indigo-50 rounded-[2rem] border border-indigo-100 text-center">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">
                Terminal Operativa
              </p>
              <p className="text-xs font-bold text-indigo-900">
                Sede: {user?.sucursal?.nombre}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default Dashboard;
