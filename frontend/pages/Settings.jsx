import React, { useState, useEffect } from "react";
import api from "../api/axios";
import { useAuth } from "../src/context/AuthContext";
import {
  Save,
  Settings as SettingsIcon,
  Palette,
  Clock,
  Car,
  Bike,
  Truck,
  DollarSign,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Settings = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    tarifa_auto: 0,
    tarifa_moto: 0,
    tarifa_camioneta: 0,
    tiempo_cortesia_min: 0,
    fraccion_minutos: 15,
    color_primario: "#4f46e5",
    logo_url: "",
  });

  useEffect(() => {
    if (user?.sucursal) {
      setFormData({
        nombre: user.sucursal.nombre,
        tarifa_auto: user.sucursal.tarifa_auto || 1000,
        tarifa_moto: user.sucursal.tarifa_moto || 500,
        tarifa_camioneta: user.sucursal.tarifa_camioneta || 1500,
        tiempo_cortesia_min: user.sucursal.tiempo_cortesia_min || 10,
        fraccion_minutos: user.sucursal.fraccion_minutos || 15,
        color_primario: user.sucursal.color || "#4f46e5",
        logo_url: user.sucursal.logo || "",
      });
    }
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.patch("/parking/config", formData);

      // Actualizamos el contexto global para que el dashboard refleje cambios
      login({
        ...user,
        sucursal: {
          ...user.sucursal,
          ...response.data, // Mezclamos todos los campos nuevos de la DB
          color: formData.color_primario,
          logo: formData.logo_url,
        },
      });
      toast.success("Configuración actualizada");
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center gap-4 mb-8">
          {/* BOTÓN VOLVER */}
          <button
            onClick={() => navigate("/dashboard")}
            className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all group"
          >
            <ArrowLeft
              size={24}
              className="group-hover:-translate-x-1 transition-transform"
            />
          </button>

          <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200">
            <SettingsIcon className="text-indigo-600" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">
              Panel de Control
            </h1>
            <p className="text-slate-500 text-sm font-bold">
              Configuración de Negocio y Marca
            </p>
          </div>
        </header>

        <form onSubmit={handleSave} className="space-y-6 pb-20">
          {/* SECCIÓN: TARIFAS POR CATEGORÍA */}
          <div className="bg-white p-6 lg:p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <ChevronRight size={14} className="text-indigo-500" /> Tarifas por
              Vehículo
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-transparent focus-within:border-indigo-500 transition-all">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase mb-3">
                  <Car size={14} /> Autos
                </label>
                <input
                  type="number"
                  className="w-full bg-transparent text-xl font-black outline-none"
                  value={formData.tarifa_auto}
                  onChange={(e) =>
                    setFormData({ ...formData, tarifa_auto: e.target.value })
                  }
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-transparent focus-within:border-indigo-500 transition-all">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase mb-3">
                  <Bike size={14} /> Motos
                </label>
                <input
                  type="number"
                  className="w-full bg-transparent text-xl font-black outline-none"
                  value={formData.tarifa_moto}
                  onChange={(e) =>
                    setFormData({ ...formData, tarifa_moto: e.target.value })
                  }
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-transparent focus-within:border-indigo-500 transition-all">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase mb-3">
                  <Truck size={14} /> Camionetas
                </label>
                <input
                  type="number"
                  className="w-full bg-transparent text-xl font-black outline-none"
                  value={formData.tarifa_camioneta}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tarifa_camioneta: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN: REGLAS DE TIEMPO */}
          <div className="bg-white p-6 lg:p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Clock size={14} className="text-indigo-500" /> Reglas de
              Fraccionamiento
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                  Minutos de Cortesía (Gracia)
                </label>
                <input
                  type="number"
                  className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={formData.tiempo_cortesia_min}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tiempo_cortesia_min: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                  Fracción después de la hora (minutos)
                </label>
                <select
                  className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                  value={formData.fraccion_minutos}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      fraccion_minutos: e.target.value,
                    })
                  }
                >
                  <option value="15">Cada 15 minutos</option>
                  <option value="30">Cada 30 minutos</option>
                  <option value="60">Hora completa</option>
                </select>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50"
          >
            {loading ? (
              "Guardando..."
            ) : (
              <>
                <Save size={18} /> Guardar Cambios
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Settings;
