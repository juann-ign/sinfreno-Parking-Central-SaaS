import React, { useEffect, useState } from "react";
import api from "../api/axios";
import {
  ShieldCheck,
  Plus,
  Building2,
  Users,
  Database,
  DollarSign,
  X,
} from "lucide-react";
import { toast } from "sonner";

const SuperAdmin = () => {
  const [stats, setStats] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    nombre_empresa: "",
    cuit: "",
    email_admin: "",
    password_admin: "",
  });

  const loadStats = () =>
    api.get("/superadmin/global-stats").then((res) => setStats(res.data));

  useEffect(() => {
    loadStats();
  }, []);

  const handleProvision = async (e) => {
    e.preventDefault();
    const loadingToast = toast.loading("Provisionando infraestructura...");
    try {
      await api.post("/superadmin/provision", form);
      toast.success("TENANT ACTIVADO CORRECTAMENTE", { id: loadingToast });
      setShowModal(false);
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error en provisión", {
        id: loadingToast,
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans p-6 lg:p-12">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-600 rounded-[1.5rem] shadow-2xl shadow-indigo-500/20">
            <ShieldCheck size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">
              Sinfreno <span className="text-indigo-500">Core</span>
            </h1>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
              Central Management Console
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3 shadow-xl shadow-indigo-500/10 active:scale-95"
        >
          <Plus size={18} /> Nuevo Tenant
        </button>
      </header>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[
          {
            label: "Empresas",
            value: stats?.total_tenants,
            icon: Building2,
            color: "text-blue-400",
          },
          {
            label: "Sedes",
            value: stats?.total_sucursales,
            icon: Database,
            color: "text-emerald-400",
          },
          {
            label: "Operaciones",
            value: stats?.total_estadias,
            icon: Users,
            color: "text-amber-400",
          },
          {
            label: "Volumen Global",
            value: `$${stats?.recaudacion_total?.toLocaleString()}`,
            icon: DollarSign,
            color: "text-indigo-400",
          },
        ].map((s, i) => (
          <div
            key={i}
            className="bg-slate-800/50 border border-slate-700/50 p-8 rounded-[2.5rem] backdrop-blur-sm"
          >
            <s.icon className={`${s.color} mb-4`} size={24} />
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">
              {s.label}
            </p>
            <p className="text-4xl font-black tracking-tighter">
              {s.value || 0}
            </p>
          </div>
        ))}
      </div>

      {/* MODAL DE PROVISIÓN */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 w-full max-w-lg rounded-[3rem] border border-slate-800 p-10 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-8 right-8 text-slate-500 hover:text-white"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-black uppercase tracking-tight mb-8">
              Provisionar Cliente
            </h2>

            <form onSubmit={handleProvision} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">
                    Nombre Comercial
                  </label>
                  <input
                    required
                    className="w-full p-4 bg-slate-800 rounded-2xl border border-slate-700 focus:border-indigo-500 outline-none font-bold"
                    onChange={(e) =>
                      setForm({ ...form, nombre_empresa: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">
                    CUIT / Tax ID
                  </label>
                  <input
                    required
                    className="w-full p-4 bg-slate-800 rounded-2xl border border-slate-700 focus:border-indigo-500 outline-none font-bold"
                    onChange={(e) => setForm({ ...form, cuit: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1">
                  Email del Dueño (Admin)
                </label>
                <input
                  type="email"
                  required
                  className="w-full p-4 bg-slate-800 rounded-2xl border border-slate-700 focus:border-indigo-500 outline-none font-bold text-indigo-400"
                  onChange={(e) =>
                    setForm({ ...form, email_admin: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1">
                  Contraseña Inicial
                </label>
                <input
                  type="password"
                  required
                  className="w-full p-4 bg-slate-800 rounded-2xl border border-slate-700 focus:border-indigo-500 outline-none font-bold"
                  onChange={(e) =>
                    setForm({ ...form, password_admin: e.target.value })
                  }
                />
              </div>

              <button
                type="submit"
                className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-500/20 hover:bg-indigo-500 transition-all pt-6"
              >
                Activar Infraestructura
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdmin;
