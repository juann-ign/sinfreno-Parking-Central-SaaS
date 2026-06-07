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
    <div className="h-screen w-full flex flex-col bg-slate-50 overflow-hidden font-sans">
      {/* HEADER: Sin cambios, pero aseguramos ancho total */}
      <nav className="h-16 w-full bg-white border-b border-slate-200 px-8 flex justify-between items-center shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100">
            <Car size={20} />
          </div>
          <h1 className="text-xl font-black text-slate-800 tracking-tighter uppercase">
            Sinfreno <span className="text-indigo-600 text-xs">SaaS</span>
          </h1>
        </div>
        <div className="flex gap-8">
          <button
            onClick={() => navigate("/history")}
            className="text-[11px] font-black text-slate-400 hover:text-indigo-600 flex items-center gap-2 tracking-[0.1em] transition-all"
          >
            <HistoryIcon size={16} /> HISTORIAL
          </button>
          <button
            onClick={onLogout}
            className="text-[11px] font-black text-red-400 hover:text-red-600 flex items-center gap-2 tracking-[0.1em] transition-all border-l pl-8"
          >
            <LogOut size={16} /> SALIR
          </button>
        </div>
      </nav>

      {/* CONTENEDOR GLOBAL CON PADDING: 
          Aquí añadimos p-6 para que nada toque los bordes de la pantalla.
      */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* COLUMNA IZQUIERDA (OPERATIVA) */}
        <section className="flex-[7] flex flex-col gap-6 min-w-0">
          {/* Formulario de ingreso: Ahora más integrado */}
          <div className="shrink-0">
            <EntryForm onEntrySuccess={fetchData} />
          </div>

          {/* Barra de Búsqueda de Alto Impacto */}
          <div className="shrink-0 relative group">
            <Search
              className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
              size={24}
            />
            <input
              type="text"
              placeholder="BUSCAR PATENTE EN PLANTA..."
              className="w-full pl-16 pr-6 py-6 rounded-[2rem] bg-white border-2 border-transparent shadow-sm focus:border-indigo-500 outline-none font-black text-2xl transition-all tracking-tight"
              value={filterTerm}
              onChange={(e) => setFilterTerm(e.target.value.toUpperCase())}
            />
            {filterTerm && (
              <button
                onClick={() => setFilterTerm("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Tabla de Activos: flex-1 para que use todo el alto sobrante */}
          <div className="flex-1 min-h-0 bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
            <ActiveTable
              vehicles={filteredVehicles}
              onCheckout={handleCheckout}
              isLoading={loading}
            />
          </div>
        </section>

        {/* COLUMNA DERECHA (ESTRATEGIA): 
            Eliminamos el gráfico de barras para que todo entre perfecto.
        */}
        <aside className="flex-[3] flex flex-col gap-6 min-w-[320px]">
          {/* Card de Dinero: Rediseñada para ser más limpia */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-slate-200 shrink-0">
            <div className="flex justify-between items-start mb-4">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">
                Caja del Día
              </p>
              <Activity size={20} className="text-indigo-400" />
            </div>
            <h3 className="text-5xl font-black mb-6 tracking-tighter">
              ${stats?.recaudacion_hoy || 0}
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between text-xs font-bold border-t border-white/10 pt-4">
                <span className="opacity-50">OCUPACIÓN</span>
                <span>{stats?.porcentaje_ocupacion}%</span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span className="opacity-50">DISPONIBLES</span>
                <span className="text-emerald-400">
                  {stats?.capacidad_disponible}
                </span>
              </div>
            </div>
          </div>

          {/* Gráfico de Torta: Lo dejamos como el elemento visual central del aside */}
          <div className="flex-1 min-h-0">
            <OccupancyPieChart
              occupied={stats?.autos_adentro || 0}
              available={stats?.capacidad_disponible || 0}
            />
          </div>

          {/* Acción Secundaria: PDF - Ahora es un link elegante, no un botón gigante */}
          <button className="shrink-0 flex items-center justify-center gap-3 py-5 rounded-[1.5rem] border-2 border-slate-200 text-slate-500 font-black text-[10px] tracking-widest uppercase hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300 transition-all">
            <HistoryIcon size={16} />
            Descargar Reporte del Día
          </button>
        </aside>
      </div>
    </div>
  );
};

export default Dashboard;

{
  /* BOTÓN REPORTE (Siempre visible fuera de los ternarios) */
}
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
</button>;
