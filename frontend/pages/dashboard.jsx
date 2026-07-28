import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../src/context/AuthContext";
import api from "../api/axios";
import ActiveTable from "../components/ActiveTable";
import EntryForm from "../components/EntryForm";
import RevenueChart from "../components/RevenueChart";
import OccupancyPieChart from "../components/OccupancyPieChart";
import {
  Car,
  LogOut,
  History as HistoryIcon,
  Search,
  DollarSign,
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

  // 1. Carga inicial de datos
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

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
      // No llamamos a fetchData aquí porque el WebSocket lo hará por nosotros
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al procesar salida");
    }
  };

  const filteredVehicles = activeVehicles.filter((v) =>
    v.patente.toLowerCase().includes(filterTerm.toLowerCase()),
  );

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 overflow-hidden font-sans">
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

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        <section className="flex-[7] flex flex-col gap-6 min-w-0">
          <div className="shrink-0">
            <EntryForm onEntrySuccess={() => fetchData()} />
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

        <aside className="flex-[3] flex flex-col gap-4 min-w-[340px]">
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

          {hasPermission("ver_ocupacion") && (
            <div className="flex-1 flex flex-col min-h-0">
              <OccupancyPieChart
                occupied={stats?.autos_adentro || 0}
                available={stats?.capacidad_disponible || 0}
              />
            </div>
          )}

          {hasPermission("ver_stats") && (
            <div className="h-60 shrink-0">
              <RevenueChart data={hourlyData} />
            </div>
          )}

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
