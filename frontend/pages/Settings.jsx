import React, { useState, useEffect } from "react";
import api from "../api/axios";
import { useAuth } from "../src/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Save, ArrowLeft, Palette, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";

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
      login({
        ...user,
        sucursal: {
          ...user.sucursal,
          ...response.data,
          color: formData.color_primario,
          logo: formData.logo_url,
        },
      });
      toast.success("CONFIGURACIÓN ACTUALIZADA");
    } catch (error) {
      toast.error("ERROR AL GUARDAR");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* HEADER: CLON EXACTO DE HISTORY */}
      <nav className="bg-white border-b border-slate-200 px-6 lg:px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl lg:text-xl font-black text-slate-800 uppercase tracking-tighter">
            Configuración del <span className="text-indigo-600">Sistema</span>
          </h1>
        </div>
      </nav>

      <main className="p-4 lg:p-10 max-w-6xl mx-auto">
        {/* CONTENEDOR ÚNICO GRANDE Y GEOMÉTRICO */}
        <form
          onSubmit={handleSave}
          className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden"
        >
          {/* SECCIÓN 1: TARIFAS (GRILLA INTEGRADA) */}
          <div className="p-8 lg:p-12 border-b border-slate-100">
            <h2 className="font-arvo text-xl font-black text-slate-800 mb-8 uppercase flex items-center gap-3">
              Tarifas por Vehículo
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { label: "Autos", emoji: "🚗", key: "tarifa_auto" },
                { label: "Motos", emoji: "🏍️", key: "tarifa_moto" },
                { label: "Camionetas", emoji: "🚐", key: "tarifa_camioneta" },
              ].map((item) => (
                <div
                  key={item.key}
                  className="bg-slate-50 p-6 rounded-3xl border-2 border-transparent focus-within:border-indigo-500 focus-within:bg-white transition-all"
                >
                  <label className="block text-s font-black text-slate-700 uppercase mb-3">
                    {item.emoji} {item.label}
                  </label>
                  <div className="flex items-center">
                    <span className="text-2xl font-black text-indigo-600 mr-1.5 relative top-0.5 ">
                      $
                    </span>
                    <input
                      type="number"
                      className="w-full bg-transparent text-3xl font-black text-slate-900 outline-none"
                      value={formData[item.key]}
                      onChange={(e) =>
                        setFormData({ ...formData, [item.key]: e.target.value })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECCIÓN 2: REGLAS Y MARCA (SIMETRÍA TOTAL) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
            {/* TIEMPOS */}
            <div className="p-8 lg:p-12 flex flex-col justify-between">
              <div>
                <h2 className="font-arvo text-xl font-black text-slate-800 mb-8 uppercase flex items-center gap-3">
                  Reglas de Tiempo
                </h2>
                <div className="space-y-8">
                  <div className="group">
                    <label className="block text-xs font-black text-slate-800 uppercase mb-3 tracking-widest">
                      Minutos de Cortesía
                    </label>
                    <input
                      type="number"
                      className="w-full p-5 bg-slate-50 rounded-2xl font-black text-2xl text-slate-900 outline-none border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all"
                      value={formData.tiempo_cortesia_min}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          tiempo_cortesia_min: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="group">
                    <label className="block text-xs font-black text-slate-800 uppercase mb-3 tracking-widest">
                      Fraccionamiento
                    </label>
                    <select
                      className="w-full p-5 bg-slate-50 rounded-2xl font-black text-lg text-slate-900 outline-none border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all appearance-none cursor-pointer"
                      value={formData.fraccion_minutos}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          fraccion_minutos: e.target.value,
                        })
                      }
                    >
                      <option value="15">CADA 15 MINUTOS</option>
                      <option value="30">CADA 30 MINUTOS</option>
                      <option value="60">HORA COMPLETA</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* MARCA */}
            <div className="p-8 lg:p-12 flex flex-col items-center justify-center bg-slate-50/30">
              <h2 className="font-arvo text-xl font-black text-slate-800 mb-8 uppercase text-center w-full">
                Identidad Visual
              </h2>
              <div className="flex flex-col items-center gap-6">
                <div className="relative group">
                  <input
                    type="color"
                    className="w-40 h-40 rounded-[3rem] cursor-pointer bg-white border-8 border-white shadow-2xl transition-transform hover:scale-105"
                    value={formData.color_primario}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        color_primario: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-black text-slate-800 uppercase tracking-[0.3em] mb-2">
                    Código Hexadecimal
                  </p>
                  <p className="text-3xl font-black text-indigo-600 font-mono">
                    {formData.color_primario.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER: BOTÓN DE GUARDADO INTEGRADO */}
          <div className="p-8 lg:p-10 bg-slate-50 border-t border-slate-100 flex justify-center">
            <button
              type="submit"
              disabled={loading}
              className="w-full max-w-md py-6 bg-slate-900 text-white rounded-3xl font-black text-sm uppercase tracking-[0.4em] hover:bg-indigo-600 transition-all flex items-center justify-center gap-4 shadow-xl active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                "PROCESANDO..."
              ) : (
                <>
                  <Save size={20} /> GUARDAR CAMBIOS
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default Settings;
