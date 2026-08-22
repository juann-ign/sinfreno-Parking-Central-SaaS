import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { ShieldCheck, Activity, Building2, Plus } from "lucide-react";

const SuperAdmin = () => {
  const [stats, setStats] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    empresa: "",
    cuit: "",
    email: "",
    pass: "",
  });

  useEffect(() => {
    api.get("/superadmin/stats-globales").then((res) => setStats(res.data));
  }, []);

  const handleProvision = async (e) => {
    e.preventDefault();
    try {
      await api.post(
        `/superadmin/provision?nombre_empresa=${form.empresa}&cuit=${form.cuit}&email_admin=${form.email}&password_admin=${form.pass}`,
      );
      alert("NUEVO CLIENTE ACTIVADO");
      setShowModal(false);
    } catch (err) {
      alert("Error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-10">
      <header className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/20">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">
              Sinfreno <span className="text-indigo-400">Control Center</span>
            </h1>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
              Global Platform Overview
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3"
        >
          <Plus size={18} /> Provisionar Nuevo Cliente
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* KPI CARD */}
        <div className="bg-slate-800 p-8 rounded-[2rem] border border-slate-700/50">
          <Activity className="text-indigo-400 mb-4" />
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
            Clientes Totales
          </p>
          <p className="text-5xl font-black">{stats?.tenants_activos || 0}</p>
        </div>
        {/* Agrega más KPIs como Recaudación Global aquí */}
      </div>

      {/* Aquí podrías listar las empresas y tener un botón de "Suspender" */}
    </div>
  );
};

export default SuperAdmin;
