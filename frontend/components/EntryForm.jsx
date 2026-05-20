import React, { useState } from "react";
import {
  Car,
  ChevronRight,
  Globe,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import api from "../api/axios";
import { toast } from "sonner";

const EntryForm = ({ onEntrySuccess }) => {
  const [patente, setPatente] = useState("");
  const [torreId, setTorreId] = useState("1");
  const [tipo, setTipo] = useState("AUTO");
  const [status, setStatus] = useState("empty");
  const [loading, setLoading] = useState(false);

  const analizarPatente = (valor) => {
    const limpio = valor.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (limpio.length > 8) return;
    setPatente(limpio);

    const patronArgViejo = /^[A-Z]{3}\d{3}$/;
    const patronArgNuevo = /^[A-Z]{2}\d{3}[A-Z]{2}$/;
    const esAlfanumerico = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{6,8}$/;

    if (limpio === "") setStatus("empty");
    else if (patronArgViejo.test(limpio) || patronArgNuevo.test(limpio))
      setStatus("valid-arg");
    else if (esAlfanumerico.test(limpio)) setStatus("special");
    else setStatus("invalid");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === "invalid" || status === "empty") return;
    setLoading(true);
    try {
      await api.post("/parking/ingreso", {
        patente: patente.toUpperCase(),
        torre_id: parseInt(torreId),
        tipo: tipo,
      });
      setPatente("");
      setStatus("empty");
      toast.success(`Ingreso exitoso: ${patente}`);
      onEntrySuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error en ingreso");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100">
      <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tighter">
        <div className="w-2 h-6 bg-indigo-600 rounded-full"></div>
        Registrar ingreso de vehículo
      </h2>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-10 items-end pb-4"
      >
        <div className="relative">
          <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">
            Patente
          </label>
          <div className="relative h-[60px]">
            <input
              type="text"
              placeholder="ABC123"
              className={`w-full pl-5 pr-12 py-4 rounded-2xl bg-slate-50 border-2 transition-all font-black text-xl uppercase outline-none ${
                status === "valid-arg"
                  ? "border-emerald-500 bg-emerald-50"
                  : status === "special"
                    ? "border-amber-400 bg-amber-50"
                    : status === "invalid"
                      ? "border-red-400 bg-red-50"
                      : "border-transparent focus:border-indigo-500"
              }`}
              value={patente}
              onChange={(e) => analizarPatente(e.target.value)}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {status === "valid-arg" && (
                <CheckCircle2 className="text-emerald-500" size={22} />
              )}
              {status === "special" && (
                <Globe className="text-amber-500" size={22} />
              )}
              {status === "invalid" && (
                <AlertCircle className="text-red-500" size={22} />
              )}
            </div>
          </div>
          {/* MENSAJE FLOTANTE (ABSOLUTO): No empuja el diseño */}
          <div className="absolute -bottom-6 left-1 w-full">
            {status === "valid-arg" && (
              <p className="text-[10px] font-black text-emerald-600 uppercase">
                Estándar Detectado
              </p>
            )}
            {status === "special" && (
              <p className="text-[10px] font-black text-amber-600 uppercase">
                Formato Especial
              </p>
            )}
            {status === "invalid" && (
              <p className="text-[10px] font-black text-red-500 uppercase">
                Formato Inválido
              </p>
            )}
          </div>
        </div>

        {/* ICONO DE ESTADO A LA DERECHA DEL INPUT */}
        <div>
          <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">
            Tipo de vehículo
          </label>
          <select
            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none focus:bg-white font-bold text-slate-700 h-[60px]"
            onChange={(e) => setTipo(e.target.value)}
          >
            <option value="AUTO">🚗 Automóvil</option>
            <option value="MOTO">🏍️ Motocicleta</option>
            <option value="CAMIONETA">🚐 Camioneta</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">
            Ubicación/Torre
          </label>
          <select
            className="w-full p-5 py-4 border-2 border-transparent bg-slate-50 rounded-2xl focus:border-indigo-500 font-bold outline-none text-slate-700 h-[60px]"
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
          disabled={loading || status === "invalid" || status === "empty"}
          className={`w-full h-[60px] rounded-2xl font-black text-white transition-all flex items-center justify-center gap-2 shadow-lg ${
            loading || status === "invalid" || status === "empty"
              ? "bg-slate-200 shadow-nonecursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-indigo-200"
          }`}
        >
          {loading ? "..." : "INGRESAR"}
          <ChevronRight size={20} />
        </button>
      </form>
    </section>
  );
};

export default EntryForm;
