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
      onEntrySuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error en ingreso");
    } finally {
      setLoading(false);
    }
  };

  return (
    /* MODIFICACIÓN: Reduje el padding general (p-5 lg:p-6) y el redondeado para ganar espacio */
    <section className="bg-white p-5 lg:px-8 lg:py-5 rounded-3xl lg:rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100">
      {/* MODIFICACIÓN: Título más pequeño y menos margen (mb-4) */}
      <h2 className="text-sm lg:text-base font-black text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-tight">
        <div className="w-1.5 h-4 bg-indigo-600 rounded-full"></div>
        Ingreso
      </h2>

      <form
        onSubmit={handleSubmit}
        /* MODIFICACIÓN: En Desktop (lg) usamos 4 columnas para que sea una sola fila. Gaps reducidos. */
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6 lg:gap-y-0 items-end"
      >
        <div className="relative">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
            Patente
          </label>
          {/* MODIFICACIÓN: Altura reducida en desktop (lg:h-[48px]) para no empujar la tabla */}
          <div className="relative h-[54px] lg:h-[48px]">
            <input
              type="text"
              placeholder="ABC123"
              className={`w-full h-full pl-4 pr-10 py-2 rounded-xl lg:rounded-2xl bg-slate-50 border-2 transition-all font-black text-lg lg:text-xl uppercase outline-none ${
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
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {status === "valid-arg" && (
                <CheckCircle2 className="text-emerald-500" size={18} />
              )}
              {status === "special" && (
                <Globe className="text-amber-500" size={18} />
              )}
              {status === "invalid" && (
                <AlertCircle className="text-red-500" size={18} />
              )}
            </div>
          </div>
          {/* MODIFICACIÓN: Mensaje de validación más sutil */}
          <div className="absolute -bottom-5 left-1">
            {status !== "empty" && (
              <p
                className={`text-[9px] font-black uppercase ${
                  status === "invalid"
                    ? "text-red-500"
                    : status === "special"
                      ? "text-amber-600"
                      : "text-emerald-600"
                }`}
              >
                {status === "valid-arg"
                  ? "Estándar"
                  : status === "special"
                    ? "Especial"
                    : "Inválido"}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
            Tipo
          </label>
          <select
            className="w-full h-[54px] lg:h-[48px] px-4 rounded-xl lg:rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none font-bold text-slate-700 text-sm"
            onChange={(e) => setTipo(e.target.value)}
          >
            <option value="AUTO">🚗 Auto</option>
            <option value="MOTO">🏍️ Moto</option>
            <option value="CAMIONETA">🚐 Camioneta</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
            Torre
          </label>
          <select
            className="w-full h-[54px] lg:h-[48px] px-4 border-2 border-transparent bg-slate-50 rounded-xl lg:rounded-2xl focus:border-indigo-500 font-bold outline-none text-slate-700 text-sm"
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
          /* MODIFICACIÓN: h-[48px] en desktop para alinear con el resto */
          className={`w-full h-[54px] lg:h-[48px] rounded-xl lg:rounded-2xl font-black text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 ${
            loading || status === "invalid" || status === "empty"
              ? "bg-slate-200 shadow-none cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700 active:scale-95"
          }`}
        >
          <span className="text-xs uppercase tracking-widest">
            {loading ? "..." : "INGRESAR"}
          </span>
          <ChevronRight size={16} />
        </button>
      </form>
    </section>
  );
};

export default EntryForm;
