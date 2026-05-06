import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import StatCard from '../components/statCard';
import ActiveTable from '../components/activeTable';
import { Car, Unlock, Percent, DollarSign, LogOut } from 'lucide-react';

const Dashboard = ({ onLogout }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeVehicles, setActiveVehicles ] = useState([]);

    // Función para pedir datos al backend
    const fetchData = async () => {
        try {
        // Pedimos stats y activos en paralelo (más rápido)
            const [statsRes, activeRes] = await Promise.all([
                api.get('/stats/summary'),
                api.get('/parking/activas')
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
        if (!window.confirm(`¿Confirmar salida del vehículo ${patente}?`)) return;
        try {
        // Llamamos al endpoint de salida que ya tienes en el backend
            await api.post(`/parking/salida?patente=${patente}`);
            alert(`Salida registrada para ${patente}`);
            fetchData(); // Refrescamos todo automáticamente
        } catch (error) {
            alert("Error al registrar salida: " + error.response?.data?.detail || "Error desconocido");
        }
    };
    // useEffect: Se ejecuta apenas carga el componente
    useEffect(() => {
        fetchData();
        // Opcional: Actualizar cada 30 segundos automáticamente
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="p-10 text-center">Cargando datos del sistema...</div>;

    return (
        <div className="min-h-screen bg-gray-50">
        {/* Header / Navbar */}
        <nav className="bg-white shadow-sm px-8 py-4 flex justify-between items-center">
            <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
            <Car /> Sinfreno | Panel de Control
            </h1>
            <button 
            onClick={onLogout}
            className="flex items-center gap-2 text-gray-600 hover:text-red-600 font-medium transition-colors"
            >
            <LogOut size={18} /> Cerrar Sesión
            </button>
        </nav>

        {/* Main Content */}
        <main className="p-8 max-w-7xl mx-auto">
            <header className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800">Estado de la Sucursal</h2>
            <p className="text-gray-500">Monitoreo en tiempo real de flujos vehiculares.</p>
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