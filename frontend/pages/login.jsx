import React, { useState } from "react";
import api from "../api/axios";
import { useAuth } from "../src/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Car, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const Login = ({ onLoginSuccess }) => {
  const [step, setStep] = useState(1); // 1: Email, 2: Password
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [branding, setBranding] = useState({
    color: "#4f46e5",
    logo: null,
    empresa: "Sinfreno",
  });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleNextStep = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post(`/auth/discovery?email=${email}`);
      setBranding(res.data);
      setStep(2);
    } catch (err) {
      toast.error("Error al verificar el correo");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);
      const response = await api.post("/auth/login", formData);
      localStorage.setItem("token", response.data.access_token);
      login(response.data.user_info);
      onLoginSuccess();
    } catch (err) {
      toast.error("Contraseña incorrecta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
      {/* LOGO DINÁMICO */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-8 flex flex-col items-center"
      >
        {branding.logo ? (
          <img
            src={branding.logo}
            alt="Logo"
            className="h-12 w-auto object-contain"
          />
        ) : (
          <div
            className="p-3 rounded-2xl text-white shadow-lg"
            style={{ backgroundColor: branding.color }}
          >
            <Car size={32} />
          </div>
        )}
        <h2 className="mt-4 font-arvo text-xl font-bold text-slate-800 uppercase tracking-tight">
          Sign in to{" "}
          <span style={{ color: branding.color }}>{branding.empresa}</span>
        </h2>
      </motion.div>

      <div className="w-full max-w-[400px] bg-white rounded-[2rem] shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.form
              key="step1"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              onSubmit={handleNextStep}
              className="space-y-6"
            >
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="tu@empresa.com"
                  className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                Continuar <ArrowRight size={16} />
              </button>

              <div className="relative py-4 flex items-center">
                <div className="flex-grow border-t border-slate-100"></div>
                <span className="flex-shrink mx-4 text-[10px] font-black text-slate-300 uppercase">
                  O
                </span>
                <div className="flex-grow border-t border-slate-100"></div>
              </div>

              <button
                type="button"
                className="w-full py-4 border-2 border-slate-100 rounded-2xl font-black text-[10px] uppercase text-slate-500 flex items-center justify-center gap-3 hover:bg-slate-50 transition-all"
              >
                <img
                  src="https://www.svgrepo.com/show/355037/google.svg"
                  className="h-4 w-4"
                />{" "}
                Continuar con Google
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="step2"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              onSubmit={handleSubmit}
              className="space-y-6"
            >
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase hover:text-slate-600 transition-colors"
              >
                <ArrowLeft size={14} /> {email}
              </button>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">
                  Contraseña
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ focusBorderColor: branding.color }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg transition-all"
                style={{ backgroundColor: branding.color }}
              >
                {loading ? "Verificando..." : "Entrar al Panel"}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
      <p className="mt-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        ¿No tienes cuenta?{" "}
        <span className="text-indigo-600 cursor-pointer">Contáctanos</span>
      </p>
    </div>
  );
};

export default Login;
