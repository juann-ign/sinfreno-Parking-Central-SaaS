import React, { useState, useEffect } from "react";
import api from "../api/axios";
import { useAuth } from "../src/context/AuthContext";
import {
  Save,
  Settings as SettingsIcon,
  Palette,
  Clock,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  const { user, login } = useAuth(); // 'login' sirve para actualizar la memoria del usuario con los nuevos colores
  const [formData, setFormData] = useState({
    nombre: "",
    tarifa_hora: 0,
    tiempo_cortesia_min: 0,
    color_primario: "#4f46e5",
    logo_url: "",
  });

  useEffect(() => {
    // Al cargar, llenamos el formulario con lo que ya tiene el usuario logueado
    if (user?.sucursal) {
      setFormData({
        nombre: user.sucursal.nombre,
        tarifa_hora: user.sucursal.tarifa,
        tiempo_cortesia_min: 5, // Valor por defecto inicial
        color_primario: user.sucursal.color || "#4f46e5",
        logo_url: user.sucursal.logo || "",
      });
    }
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const response = await api.patch("/parking/config", formData);

      // ACTUALIZACIÓN CRÍTICA:
      // Para que el White-label se vea reflejado sin recargar la página,
      // actualizamos el AuthContext con los nuevos datos.
      const updatedUser = {
        ...user,
        sucursal: {
          ...user.sucursal,
          nombre: response.data.nombre,
          tarifa: response.data.tarifa_hora,
          color: formData.color_primario, // Viene de la empresa
          logo: formData.logo_url,
        },
      };
      login(updatedUser); // Actualiza localStorage y memoria global
      toast.success("Configuración actualizada con éxito");
    } catch (error) {
      toast.error("Error al guardar configuración");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200">
            <SettingsIcon className="text-slate-600" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">
              Configuración del Sistema
            </h1>
            <p className="text-slate-500 text-sm font-bold">
              Ajusta las reglas de negocio y apariencia de tu sede.
            </p>
          </div>
        </header>

        <form onSubmit={handleSave} className="space-y-6">
          {/* SECCIÓN: NEGOCIO */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
            <h3 className="flex items-center gap-2 text-xs font-black text-indigo-500 uppercase tracking-widest mb-6">
              <DollarSign size={14} /> Reglas de Facturación
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                  Tarifa por Hora ($)
                </label>
                <input
                  type="number"
                  className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 outline-none font-bold"
                  value={formData.tarifa_hora}
                  onChange={(e) =>
                    setFormData({ ...formData, tarifa_hora: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                  Minutos de Cortesía
                </label>
                <input
                  type="number"
                  className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 outline-none font-bold"
                  value={formData.tiempo_cortesia_min}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tiempo_cortesia_min: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN: WHITE LABEL */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
            <h3 className="flex items-center gap-2 text-xs font-black text-indigo-500 uppercase tracking-widest mb-6">
              <Palette size={14} /> Identidad Visual
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                  Color de Marca
                </label>
                <div className="flex gap-4 items-center">
                  <input
                    type="color"
                    className="w-20 h-12 rounded-lg cursor-pointer bg-transparent border-none"
                    value={formData.color_primario}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        color_primario: e.target.value,
                      })
                    }
                  />
                  <span className="font-mono text-sm font-bold text-slate-500 uppercase">
                    {formData.color_primario}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl"
          >
            <Save size={18} /> Guardar cambios
          </button>
        </form>
      </div>
    </div>
  );
};

export default Settings;
