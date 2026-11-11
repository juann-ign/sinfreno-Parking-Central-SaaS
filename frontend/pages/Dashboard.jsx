import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../src/context/useAuth";
import api from "../api/axios";
import { getWebSocketUrl } from "../config/connections.js";
import { connectAuthenticatedSocket } from "../api/realtime.js";
import { SESSION_ENDED_EVENT } from "../api/session.js";
import ActiveTable from "../components/ActiveTable";
import EntryForm from "../components/EntryForm";
import RevenueChart from "../components/RevenueChart";
import OccupancyPieChart from "../components/OccupancyPieChart";
import TicketModal from "../components/TicketModal";
import CashModal from "../components/CashModal";
import {
  Car,
  LogOut,
  History as HistoryIcon,
  Search,
  Settings as SettingsIcon,
  Wallet,
  AlertTriangle,
  Users,
  FileStack,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Dashboard = ({ onLogout }) => {
  const { user, hasPermission, login, logout } = useAuth();
  const isAdmin = user?.rol === "ADMIN";
  const [stats, setStats] = useState(null);
  const [activeVehicles, setActiveVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hourlyData, setHourlyData] = useState([]);
  const [filterTerm, setFilterTerm] = useState("");

  const navigate = useNavigate();

  const [showTicket, setShowTicket] = useState(false);
  const [lastTicketData, setLastTicketData] = useState(null);

  const [isCashLoading, setIsCashLoading] = useState(true);
  const [cashSession, setCashSession] = useState(null); // Guardará la caja abierta
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashMode, setCashMode] = useState("open");

  // Función de carga de datos (Memorizada para evitar re-renders)
  const fetchData = useCallback(
    () => Promise.all([
      api.get("/stats/summary"),
      api.get("/parking/activas"),
    ])
      .then(async ([statsRes, activeRes]) => {
        setStats(statsRes.data);
        setActiveVehicles(activeRes.data);

        if (hasPermission("ver_stats")) {
          const hourlyRes = await api.get("/stats/revenue-hourly");
          setHourlyData(hourlyRes.data);
        }
      })
      .catch((error) => {
        toast.error(error.response?.status === 403 ? "No tenés permiso para consultar estos datos." : "No se pudieron cargar los datos del dashboard.", { id: "dashboard-load" });
      })
      .finally(() => {
        setLoading(false);
      }),
    [hasPermission],
  );

  // Función para verificar si hay caja abierta
  const checkCashStatus = useCallback(() =>
    api.get("/cash/status")
      .then((res) => {
        setCashSession(res.data);
      })
      .catch((error) => {
        if (error.response?.status !== 404) toast.error("No se pudo consultar el estado de caja.", { id: "cash-status" });
        setCashSession(null); // 404 significa que no hay caja abierta
      })
      .finally(() => {
        setIsCashLoading(false);
      }), []);

  // 1. Carga inicial de datos
  useEffect(() => {
    fetchData();
    checkCashStatus();
  }, [fetchData, checkCashStatus]);

  // Socket messages only invalidate authorized HTTP reads.
  useEffect(() => {
    const sucursalId = user?.sucursal?.id;
    if (!sucursalId) return;
    const refresh = () => {
      fetchData();
      checkCashStatus();
    };
    const stop = connectAuthenticatedSocket({
      url: getWebSocketUrl(sucursalId),
      token: localStorage.getItem("token"),
      onReady: refresh,
      onEvent: ({ event }) => {
        if (event === "CONFIG_UPDATED") {
          api.get("/auth/me")
            .then(({ data }) => login(data))
            .catch(() => toast.error("No se pudo actualizar la configuración de la sesión."));
        } else {
          refresh();
        }
      },
      onUnauthorized: logout,
      onForbidden: () => toast.error("Sin acceso a las actualizaciones en tiempo real.", { id: "realtime-access" }),
      onUnavailable: () => toast.error("No se pudieron conectar las actualizaciones. Recargá para volver a intentar.", { id: "realtime-offline" }),
    });
    window.addEventListener(SESSION_ENDED_EVENT, stop);
    return () => {
      window.removeEventListener(SESSION_ENDED_EVENT, stop);
      stop();
    };
  }, [user?.sucursal?.id, fetchData, checkCashStatus, login, logout]);

  const showOperationResult = (data, isExit) => {
    toast.success(isExit
      ? "Salida de " + data.patente + ": $" + data.monto + " (" + data.metodo_pago + ")"
      : "Ingreso registrado: " + data.patente, {
      duration: 8000,
      action: {
        label: "Ver comprobante",
        onClick: () => {
          setLastTicketData(data);
          setShowTicket(true);
        },
      },
    });
    fetchData();
  };

  const handleCheckout = async (patente, metodo = "EFECTIVO") => {
    try {
      const { data } = await api.post("/parking/salida", null, {
        params: { patente, metodo_pago: metodo },
      });
      showOperationResult(data, true);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al procesar salida");
    }
  };

  const handleCashAction = async (data) => {
    try {
      if (cashMode === "open") {
        const res = await api.post("/cash/abrir");
        setCashSession(res.data);
        toast.success("Caja abierta. ¡Buen turno!");
      } else {
        await api.post("/cash/cerrar", {
          monto_real: data.amount,
          notas: data.notes,
        });
        setCashSession(null);
        toast.success("Caja cerrada correctamente.");
      }
      setShowCashModal(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error en operación de caja");
    }
  };

  const filteredVehicles = activeVehicles.filter((v) =>
    v.patente.toLowerCase().includes(filterTerm.toLowerCase()),
  );

  return (
    // h-screen en desktop, auto en mobile para permitir scroll
    <div className="min-h-screen lg:h-screen w-full flex flex-col bg-slate-50 overflow-x-hidden font-sans">
      {/* HEADER: Adaptable */}
      {/* HEADER: Siempre horizontal y compacto */}
      <nav className="h-16 lg:h-20 w-full bg-white border-b border-slate-100 px-4 lg:px-10 flex justify-between items-center shrink-0 z-50">
        {/* LADO IZQUIERDO: Logo y Título */}
        <div className="flex items-center gap-2 lg:gap-4 min-w-0">
          <div
            className="p-2 lg:p-2.5 rounded-xl lg:rounded-2xl text-white shadow-lg shrink-0"
            style={{ backgroundColor: user?.sucursal?.color || "#4f46e5" }}
          >
            <Car size={18} lg:size={22} strokeWidth={2.5} />
          </div>
          {/* truncate evita que el nombre largo de la empresa rompa el layout en móviles */}
          <h1 className="font-arvo text-lg lg:text-2xl font-bold text-slate-900 tracking-tight truncate">
            {user?.sucursal?.nombre || "Sinfreno"}
            <span className="text-indigo-600">.</span>
          </h1>
        </div>

        {/* LADO DERECHO: Botones de Acción */}
        <div className="flex items-center gap-1 sm:gap-3 lg:gap-8 shrink-0">
          {/* BOTÓN CAJA */}
          <button
            disabled={!isAdmin}
            title={isAdmin ? "Administrar caja" : "La caja la administra un administrador"}
            onClick={() => {
              setCashMode(cashSession ? "close" : "open");
              setShowCashModal(true);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${
              cashSession
                ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                : "bg-rose-50 border-rose-100 text-rose-600 animate-pulse"
            }`}
          >
            <Wallet size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              {cashSession ? "Caja Abierta" : "Caja Cerrada"}
            </span>
          </button>

          {isAdmin && <button
            onClick={() => navigate("/cash-history")}
            className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all shadow-sm"
            title="Historial de Cajas"
          >
            <FileStack size={18} />
          </button>}

          {/* BOTÓN HISTORIAL */}
          {hasPermission("ver_historial") && (
            <button
              onClick={() => navigate("/history")}
              className="group flex items-center gap-2 p-2 lg:p-0 rounded-lg hover:bg-slate-50 lg:hover:bg-transparent transition-all"
            >
              <div className="p-1.5 lg:p-0 bg-slate-50 lg:bg-transparent rounded-md lg:rounded-none text-slate-400 group-hover:text-indigo-600">
                <HistoryIcon size={18} lg:size={16} />
              </div>
              {/* El texto se oculta en móviles muy pequeños para no amontonar */}
              <span className="hidden sm:inline font-sans text-[10px] lg:text-xs font-bold text-slate-400 group-hover:text-indigo-600 tracking-[0.15em] transition-all">
                HISTORIAL
              </span>
            </button>
          )}

          {/*  BOTÓN CONFIGURACIÓN  */}
          {hasPermission("config_sucursal") && (
            <button
              onClick={() => navigate("/settings")}
              className="group flex items-center gap-2 p-2 lg:p-0 rounded-lg hover:bg-slate-50 lg:hover:bg-transparent transition-all"
            >
              <div className="p-1.5 lg:p-0 bg-slate-50 lg:bg-transparent rounded-md lg:rounded-none text-slate-400 group-hover:text-indigo-600">
                <SettingsIcon size={18} lg:size={16} />
              </div>
              <span className="hidden sm:inline font-sans text-[10px] lg:text-xs font-bold text-slate-400 group-hover:text-indigo-600 tracking-[0.15em] transition-all">
                AJUSTES
              </span>
            </button>
          )}
          {/* BOTÓN USUARIOS */}
          {hasPermission("config_sucursal") && (
            <button
              onClick={() => navigate("/users")}
              className="group flex items-center gap-2 p-2 lg:p-0 rounded-lg hover:bg-slate-50 lg:hover:bg-transparent transition-all"
            >
              <div className="p-1.5 lg:p-0 bg-slate-50 lg:bg-transparent rounded-md lg:rounded-none text-slate-400 group-hover:text-indigo-600">
                <Users size={18} lg:size={16} />
              </div>
              <span className="hidden sm:inline font-sans text-[10px] lg:text-xs font-bold text-slate-400 group-hover:text-indigo-600 tracking-[0.15em] transition-all">
                STAFF
              </span>
            </button>
          )}

          {/* BOTÓN SALIR */}
          <button
            onClick={onLogout}
            className="group flex items-center gap-2 p-2 lg:p-0 rounded-lg hover:bg-rose-50 lg:hover:bg-transparent transition-all"
          >
            <div className="p-1.5 lg:p-0 bg-rose-50 lg:bg-transparent rounded-md lg:rounded-none text-rose-400 group-hover:text-rose-500">
              <LogOut size={18} lg:size={16} />
            </div>
            <span className="hidden sm:inline font-sans text-[10px] lg:text-xs font-bold text-rose-400 group-hover:text-rose-500 tracking-[0.15em] transition-all">
              SALIR
            </span>
          </button>
        </div>
      </nav>

      {/* CONTENIDO PRINCIPAL: Stack en mobile, Row en Desktop */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden p-4 lg:p-6 gap-6">
        {/* COLUMNA OPERATIVA (Izquierda) */}
        <section className="flex-1 lg:flex-[7] flex flex-col gap-6 min-w-0">
          {/* Overlay de bloqueo si no hay caja */}
          {!isCashLoading && !cashSession && (hasPermission("ingreso") || hasPermission("salida")) && (
            <div className="absolute inset-0 z-40 bg-slate-50/60 backdrop-blur-[2px] flex items-center justify-center rounded-[2rem]">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center max-w-sm">
                <AlertTriangle
                  className="mx-auto text-rose-500 mb-4"
                  size={48}
                />
                <h3 className="font-black text-slate-800 uppercase mb-2">
                  Operación Bloqueada
                </h3>
                <p className="text-sm text-slate-500 font-bold mb-6">
                  {isAdmin ? "Debes abrir la caja antes de registrar ingresos o salidas." : "Solicitá a un administrador que abra la caja para operar."}
                </p>
                {isAdmin && <button
                  onClick={() => {
                    setCashMode("open");
                    setShowCashModal(true);
                  }}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest"
                >
                  Abrir Caja Ahora
                </button>}
              </div>
            </div>
          )}

          <div className="shrink-0">
            {hasPermission("ingreso") && <EntryForm
              onEntrySuccess={(data) => showOperationResult(data, false)}
              disabled={!cashSession || isCashLoading}
            />}
          </div>

          <div className="shrink-0 relative">
            <Search
              className="absolute left-4 lg:left-6 top-1/2 -translate-y-1/2 text-slate-400"
              size={20}
              lg:size={24}
            />
            <input
              type="text"
              placeholder="BUSCAR PATENTE..."
              className="w-full pl-12 lg:pl-16 pr-6 lg:pr-8 py-4 lg:py-5 rounded-2xl lg:rounded-[2rem] bg-white border-2 border-transparent shadow-sm focus:border-indigo-500 outline-none font-sans font-semibold text-lg lg:text-xl transition-all"
              value={filterTerm}
              onChange={(e) => setFilterTerm(e.target.value.toUpperCase())}
            />
          </div>

          {/* Tabla que se vuelve scrollable solo en desktop */}
          <div className="lg:flex-1 min-h-[400px] bg-white rounded-[2rem] lg:rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
            <ActiveTable
              vehicles={filteredVehicles}
              onCheckout={handleCheckout}
              canCheckout={hasPermission("salida") && Boolean(cashSession) && !isCashLoading}
              isLoading={loading}
            />
          </div>
        </section>

        {/* ASIDE (Derecha / Abajo en mobile) */}
        <aside className="lg:flex-[3] flex flex-col gap-4 min-w-0 lg:min-w-[340px]">
          {hasPermission("ver_stats") && stats?.recaudacion_hoy !== undefined && (
            <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl shrink-0">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                Caja Hoy
              </p>
              <h3 className="text-3xl lg:text-4xl font-black mb-4 tracking-tighter">
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4 flex-1">
            <div className="min-h-[350px] h-full">
              {hasPermission("ver_ocupacion") && (
                <OccupancyPieChart
                  occupied={stats?.autos_adentro || 0}
                  available={stats?.capacidad_disponible || 0}
                />
              )}
              {hasPermission("ver_stats") && (
                <div className="h-60 lg:h-auto lg:flex-1">
                  <RevenueChart data={hourlyData} />
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      <TicketModal
        isOpen={showTicket}
        ticketData={lastTicketData}
        onClose={() => setShowTicket(false)}
      />

      <CashModal
        isOpen={showCashModal}
        mode={cashMode}
        expectedAmount={stats?.recaudacion_hoy}
        onConfirm={handleCashAction}
        onClose={() => setShowCashModal(false)}
      />
    </div>
  );
};

export default Dashboard;
