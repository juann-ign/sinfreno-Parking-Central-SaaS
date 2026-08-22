import React, { useState, useEffect } from "react";
import {
  Car,
  ChevronRight,
  Globe,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import api from "../api/axios";
import { toast } from "sonner";
import "../src/Button3D.css";

const EntryForm = ({ onEntrySuccess, disabled }) => {
  const [patente, setPatente] = useState("");
  const [tipo, setTipo] = useState("AUTO");
  const [status, setStatus] = useState("empty");
  const [loading, setLoading] = useState(false);
  const [towers, setTowers] = useState([]); // Nuevo estado para torres
  const [torreId, setTorreId] = useState("");

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
      const errorMsg = error.response?.data?.detail;
      // Si detail es un objeto o lista (error 422), lo convertimos a string legible
      toast.error(
        typeof errorMsg === "object"
          ? JSON.stringify(errorMsg)
          : errorMsg || "Error en ingreso",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await api.get("/parking/config"); // Recordá que este endpoint devuelve la sucursal con sus torres
        setTowers(res.data.torres);
        if (res.data.torres.length > 0 && !torreId) {
          setTorreId(res.data.torres[0].id.toString()); // Seleccionamos la primera por defecto
        }
      } catch (err) {
        console.error("Error cargando torres", err);
      }
    };
    loadConfig();
  }, []);

  return (
    <section
      className={`bg-white rounded-3xl lg:rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden, ${disabled ? "opacity-30 pointer-events-none" : ""}`}
    >
      <div className="p-5 lg:px-8 lg:py-6 border-b border-slate-100 bg-slate-50/50">
        <h2 className="font-arvo text-base lg:text-lg font-bold text-slate-800 uppercase tracking-tight">
          Ingreso de Vehículos
        </h2>
      </div>

      <div className="p-5 lg:p-8">
        <form
          onSubmit={handleSubmit}
          /* MODIFICACIÓN: En Desktop (lg) usamos 4 columnas para que sea una sola fila. Gaps reducidos. */
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6 lg:gap-y-0 items-end"
        >
          {/* Campo: Patente */}
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
          </div>

          {/* Campo: Tipo */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
              Tipo de Vehículo
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

          {/* Campo: Torre */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
              Torre
            </label>
            <select
              className="w-full h-[54px] lg:h-[48px] px-4 border-2 border-transparent bg-slate-50 rounded-xl lg:rounded-2xl focus:border-indigo-500 font-bold outline-none text-slate-700 text-sm"
              value={torreId}
              onChange={(e) => setTorreId(e.target.value)}
            >
              {towers.map((t) => (
                <option key={t.id} value={t.id}>
                  Torre {t.numero}
                </option>
              ))}
            </select>
          </div>

          {/* Botón de Acción */}
          <button
            type="submit"
            disabled={
              loading ||
              status === "invalid" ||
              status === "empty" ||
              towers.length === 0
            }
            className={`btn-3d ${
              loading ||
              status === "invalid" ||
              status === "empty" ||
              towers.length === 0
                ? "opacity-50 grayscale cursor-not-allowed"
                : ""
            }`}
          >
            <div className="button-outer">
              <div className="button-inner">
                <span>
                  {towers.length === 0
                    ? "Sin Torres"
                    : loading
                      ? "..."
                      : "Ingresar"}
                </span>{" "}
              </div>
            </div>
          </button>
        </form>
      </div>
    </section>
  );
};

export default EntryForm;
