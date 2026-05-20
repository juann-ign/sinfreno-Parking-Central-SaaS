import React, { useState } from "react";
import { Car, ChevronRight } from "lucide-react";
import api from "../api/axios";
import { toast } from "sonner";

const EntryForm = ({ onEntrySuccess }) => {
  const [patente, setPatente] = useState("");
  const [torreId, setTorreId] = useState("1");
  const [tipo, setTipo] = useState("AUTO"); // Nuevo estado
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patente) return;
    setLoading(true);
    try {
      await api.post("/parking/ingreso", {
        patente: patente.toUpperCase(),
        torre_id: parseInt(torreId),
        // Nota: Tu backend actual en db_models tiene 'tipo',
        // asegúrate de que el esquema lo reciba o el service lo asigne.
      });
      setPatente("");
      toast.success(`Ingreso registrado: ${patente.toUpperCase()}`);
      onEntrySuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error en ingreso");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/60 border border-slate-100">
      <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
        <span className="w-2 h-8 bg-indigo-600 rounded-full"></span>
        Registrar ingreso de vehículo
      </h2>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end"
      >
        <div>
          <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest mb-2 ml-1">
            Patente
          </label>
          <input
            type="text"
            placeholder="ABC123"
            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none focus:bg-white outline-none transition:all font-black text-xl uppercase"
            value={patente}
            onChange={(e) => setPatente(e.target.value)}
          />
        </div>

        {/* ICONO DE ESTADO A LA DERECHA DEL INPUT */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
            Tipo
          </label>
          <select
            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none focus:bg-white font-bold text-slate-600 appearance-none cursor-pointer"
            onChange={(e) => setTipo(e.target.value)}
          >
            <option value="AUTO">🚗 Automóvil</option>
            <option value="MOTO">🏍️ Motocicleta</option>
            <option value="CAMIONETA">🚐 Camioneta</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
            Ubicación
          </label>
          <select
            className="w-full p-5 py-4 border-2 border-transparent bg-slate-50 rounded-2xl focus:border-indigo-500 text-xl font-bold outline-none text-slate-600 appearance-none cursor-pointer"
            value={torreId}
            onChange={(e) => setTorreId(e.target.value)}
          >
            <option value="1">Torre 1</option>
            <option value="2">Torre 2</option>
            <option value="3">Visitante</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-br from-indigo-600 to-blue-500 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-blue-600 tracking-tight"
        >
          {loading ? "..." : "INGRESAR"}
        </button>
      </form>
    </section>
  );
};

export default EntryForm;
