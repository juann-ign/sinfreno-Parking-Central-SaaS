import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../src/context/AuthContext";
import api from "../api/axios";
import ActiveTable from "../components/ActiveTable";
import EntryForm from "../components/EntryForm";
import RevenueChart from "../components/RevenueChart";
import OccupancyPieChart from "../components/OccupancyPieChart";
import TicketModal from "../components/TicketModal";
import CashModal from "../components/cashModal";
import {
  Car,
  LogOut,
  History as HistoryIcon,
  Search,
  DollarSign,
  Settings as SettingsIcon,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const getHora = () =>
  new Date().toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

const Dashboard = ({ onLogout }) => {
  const { user, hasPermission } = useAuth();
  const [stats, setStats] = useState(null);
  const [activeVehicles, setActiveVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hourlyData, setHourlyData] = useState([]);
  const [filterTerm, setFilterTerm] = useState("");

  const socketRef = useRef(null);
  const lastProcessedEventRef = useRef("");
  const navigate = useNavigate();

  const [showTicket, setShowTicket] = useState(false);
  const [lastTicketData, setLastTicketData] = useState(null);

  const [isCashLoading, setIsCashLoading] = useState(true);
  const [cashSession, setCashSession] = useState(null); // Guardará la caja abierta
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashMode, setCashMode] = useState("open");

  // Función de carga de datos (Memorizada para evitar re-renders)
  const fetchData = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const [statsRes, activeRes] = await Promise.all([
          api.get("/stats/summary"),
          api.get("/parking/activas"),
        ]);
        setStats(statsRes.data);
        setActiveVehicles(activeRes.data);

        if (hasPermission("ver_stats")) {
          const hourlyRes = await api.get("/stats/revenue-hourly");
          setHourlyData(hourlyRes.data);
        }
      } catch (error) {
        console.error("Error cargando datos", error);
      } finally {
        setLoading(false);
      }
    },
    [hasPermission],
  );

  // Función para verificar si hay caja abierta
  const checkCashStatus = useCallback(async () => {
    setCashLoading(true);
    try {
      const res = await api.get("/cash/status");
      setCashSession(res.data);
    } catch (error) {
      setCashSession(null); // 404 significa que no hay caja abierta
    } finally {
      setIsCashLoading(false);
    }
  }, []);

  // 1. Carga inicial de datos
  useEffect(() => {
    fetchData(true);
    checkCashStatus();
  }, [fetchData, checkCashStatus]);

  // 2. Lógica de WebSocket
  useEffect(() => {
    const sucursalId = user?.sucursal?.id;
    if (!sucursalId) return;

    const connect = () => {
      if (socketRef.current?.readyState === WebSocket.OPEN) return;

      const socket = new WebSocket(`ws://localhost:8000/ws/${sucursalId}`);
      socketRef.current = socket;

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // Evitar duplicados (Mismo evento en menos de 2 seg)
        const eventKey = `${data.event}-${data.patente}`;
        if (lastProcessedEventRef.current === eventKey) return;
        lastProcessedEventRef.current = eventKey;
        setTimeout(() => {
          lastProcessedEventRef.current = "";
        }, 2000);

        // CORRECCIÓN: "NUV" -> "NUEVA_SALIDA"
        if (data.event === "NUEVO_INGRESO" || data.event === "NUEVA_SALIDA") {
          const isIngreso = data.event === "NUEVO_INGRESO";

          toast.custom(
            (t) => (
              <div
                style={{
                  width: 320,
                  background: "#ffffff",
                  border: `2px solid ${isIngreso ? "#10b981" : "#4f46e5"}`,
                  borderRadius: 14,
                  padding: "12px 14px",
                  position: "relative",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              >
                {/* HORA */}
                <span
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 14,
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#64748b",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {getHora()}
                </span>

                {/* TÍTULO + EMOJI TIPO */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    paddingRight: 40,
                  }}
                >
                  <span style={{ fontSize: 14 }}>
                    {isIngreso
                      ? ({ AUTO: "🚗", MOTO: "🏍️", CAMIONETA: "🚐" }[
                          data.tipo
                        ] ?? "🚗")
                      : "💸"}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: "#0f172a",
                    }}
                  >
                    {isIngreso ? "Ingreso de vehículo" : "Salida registrada"}
                  </span>
                </div>

                {/* PATENTE */}
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 22,
                    fontWeight: 900,
                    color: "#0f172a",
                    lineHeight: 1.1,
                    marginTop: 6,
                  }}
                >
                  {data.patente}
                </div>

                {/* TIPO DE VEHÍCULO (solo en ingreso) */}
                {isIngreso && (
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#475569",
                      marginTop: 3,
                    }}
                  >
                    {{
                      AUTO: "🚗 Auto",
                      MOTO: "🏍️ Motocicleta",
                      CAMIONETA: "🚐 Camioneta",
                    }[data.tipo] ?? "🚗 Auto"}
                  </div>
                )}

                {/* MONTO + TIPO (solo en salida) */}
                {!isIngreso && (
                  <>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#475569",
                        marginTop: 3,
                      }}
                    >
                      {{
                        AUTO: "🚗 Auto",
                        MOTO: "🏍️ Motocicleta",
                        CAMIONETA: "🚐 Camioneta",
                      }[data.tipo] ?? "🚗 Auto"}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 5,
                        marginTop: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          color: "#64748b",
                        }}
                      >
                        cobrado
                      </span>
                      <span
                        style={{
                          fontSize: 18,
                          fontWeight: 900,
                          color: "#4f46e5",
                        }}
                      >
                        ${Number(data.monto).toLocaleString("es-AR")}
                      </span>
                    </div>
                  </>
                )}

                {/* BOTONES */}
                <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                  <button
                    onClick={() => toast.dismiss(t)}
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "5px 10px",
                      borderRadius: 7,
                      border: "1px solid #e2e8f0",
                      background: "transparent",
                      color: "#64748b",
                      cursor: "pointer",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={() => {
                      setLastTicketData(data); // 'data' viene del mensaje del socket
                      setShowTicket(true);
                      toast.dismiss(t.id); // Cerramos el aviso al abrir el ticket
                    }}
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "5px 10px",
                      borderRadius: 7,
                      border: "none",
                      background: isIngreso ? "#10b981" : "#4f46e5",
                      color: "#ffffff",
                      cursor: "pointer",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {isIngreso ? "Ver ticket" : "Ver comprobante"}
                  </button>
                </div>
              </div>
            ),
            { duration: 5000 },
          );

          fetchData(); // Refrescar lista y stats
        }
      };

      socket.onclose = () => {
        if (socketRef.current) setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      if (socketRef.current) {
        socketRef.current.onclose = null; // Evitar reconexión al desmontar
        socketRef.current.close();
      }
    };
  }, [user?.sucursal?.id, fetchData]);

  const handleCheckout = async (patente) => {
    try {
      await api.post(`/parking/salida?patente=${encodeURIComponent(patente)}`);
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
    } catch (err) {
      toast.error("Error en operación de caja");
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
          {/* Separador sutil solo visible en desktop */}
          <div className="hidden lg:block h-6 w-px bg-slate-100 mx-2"></div>

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
          {!isCashLoading && !cashSession && (
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
                  Debes abrir la caja antes de registrar ingresos o salidas.
                </p>
                <button
                  onClick={() => {
                    setCashMode("open");
                    setShowCashModal(true);
                  }}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest"
                >
                  Abrir Caja Ahora
                </button>
              </div>
            </div>
          )}

          <div className="shrink-0">
            <EntryForm
              onEntrySuccess={() => fetchData()}
              disabled={!cashSession}
            />
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
              isLoading={loading}
            />
          </div>
        </section>

        {/* ASIDE (Derecha / Abajo en mobile) */}
        <aside className="lg:flex-[3] flex flex-col gap-4 min-w-0 lg:min-w-[340px]">
          {hasPermission("ver_stats") && (
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
