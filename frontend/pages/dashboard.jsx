import React, { useEffect, useState } from "react";
import api from "../api/axios";
import StatCard from "../components/statCard";
import ActiveTable from "../components/activeTable";
import EntryForm from "../components/EntryForm";
import {
  History as HistoryIcon,
  Car,
  Unlock,
  Percent,
  DollarSign,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Dashboard = ({ onLogout }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeVehicles, setActiveVehicles] = useState([]);

  const navigate = useNavigate();

  // Función para pedir datos al backend
  const fetchData = async () => {
    try {
      // Pedimos stats y activos en paralelo (más rápido)
      const [statsRes, activeRes] = await Promise.all([
        api.get("/stats/summary"),
        api.get("/parking/activas"),
      ]);
      setStats(statsRes.data);
      setActiveVehicles(activeRes.data);
    } catch (error) {
      console.error("Error cargando datos", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (patente) => {
    console.log("Intentando cobrar patente:", patente); // Verifica que aquí no salga undefined
    if (!patente) {
      alert("Error: No se detectó la patente");
      return;
    }

    try {
      // Llamamos al endpoint de salida que ya tienes en el backend

      const reponse = await api.post(`/parking/salida?patente=${patente}`);
      const estadiaFinalizada = response.data;
      const monto = estadiaFinalizada.monto ?? 0; // Si no hay monto, ponemos 0 para que no rompa

      toast.success(
        <div className="flex flex-col">
          <span className="font-bold text-lg">Salida exitosa: {patente}</span>
          <span className="text-lg">
            Cobrar: <b className="text-blue-700">${monto}</b>
          </span>
        </div>,
        { duration: 6000 }, // Le dejamos 6 segundos para que el operario anote el monto
      );

      fetchData(); // Refrescamos todo automáticamente
    } catch (error) {
      console.error("Error al registrar salida", error);
      // Leemos el error real que viene del backend (ej: "No hay registros activos")
      const mensajeError =
        error.response?.data?.detail || "Error al registrar salida";
      toast.error(mensajeError);
    }
  };
  // useEffect: Se ejecuta apenas carga el componente
  useEffect(() => {
    fetchData();
    // Opcional: Actualizar cada 30 segundos automáticamente
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading)
    return (
      <div className="p-10 text-center">Cargando datos del sistema...</div>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header / Navbar */}
      <nav className="bg-white shadow-sm px-8 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
          <Car /> Sinfreno | Panel de Control
        </h1>

        {/* Navbar  */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/history")}
            className="flex items-center gap-2 text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <HistoryIcon size={18} /> Ver Historial
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-2 text-gray-600 hover:text-red-600 font-medium transition-colors"
          >
            <LogOut size={18} /> Cerrar Sesión
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="p-8 max-w-7xl mx-auto">
        <header className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800">
            Estado de la Sucursal
          </h2>
          <p className="text-gray-500">
            Monitoreo en tiempo real de flujos vehiculares.
          </p>
        </header>

        {/* Grid de Tarjetas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Autos Adentro"
            value={stats?.autos_adentro || 0}
            icon={Car}
            colorClass="bg-blue-500"
          />
          <StatCard
            title="Espacios Libres"
            value={stats?.capacidad_disponible || 0}
            icon={Unlock}
            colorClass="bg-green-500"
          />
          <StatCard
            title="Ocupación"
            value={`${stats?.porcentaje_ocupacion || 0}%`}
            icon={Percent}
            colorClass="bg-orange-500"
          />
          <StatCard
            title="Recaudación Hoy"
            value={`$${stats?.recaudacion_hoy || 0}`}
            icon={DollarSign}
            colorClass="bg-emerald-600"
          />
        </div>

        {/* Formulario de Ingreso */}
        <EntryForm onEntrySuccess={fetchData} />

        {/* Tabla de Vehículos Activos */}
        <div className="mt-10">
          <ActiveTable
            vehicles={activeVehicles}
            onCheckout={handleCheckout}
          ></ActiveTable>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
