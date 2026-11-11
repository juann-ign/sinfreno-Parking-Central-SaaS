import { useEffect, useRef, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios.js";
import { useAuth } from "../src/context/useAuth.js";
import { errorMessage } from "../ui/format.js";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [branding, setBranding] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(null);
  const currentEmail = useRef("");
  useEffect(() => () => request.current?.abort(), []);
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const body = new URLSearchParams({ username: email.trim(), password });
      const { data } = await api.post("/auth/login", body, {
        signal: controller.signal,
        timeout: 12000,
      });
      if (controller.signal.aborted) return;
      localStorage.setItem("token", data.access_token);
      login(data.user_info);
      navigate(
        data.user_info.rol === "SUPERADMIN" ? "/superadmin" : "/dashboard",
        { replace: true },
      );
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          errorMessage(
            failure,
            "El servicio de acceso no está disponible. Verificá tu conexión y reintentá.",
          ),
        );
    } finally {
      setBusy(false);
    }
  };
  const discover = () => {
    if (!email.includes("@")) return;
    const requestedEmail = email;
    api
      .post("/auth/discovery", null, { params: { email }, timeout: 5000 })
      .then(({ data }) => {
        if (requestedEmail === currentEmail.current) setBranding(data);
      })
      .catch(() => {});
  };
  return (
    <main className="sf-login">
      <div className="sf-login-intro">
        <a className="sf-brand" href="/">
          Sinfreno<span>.</span>
        </a>
        <h1>
          Tu cochera,
          <br />
          en movimiento.
        </h1>
        <p>Ingresos claros, cobros verificables y turnos de caja ordenados.</p>
        <div className="sf-login-rule">
          <span />
          Operación simple. Cada movimiento, en su lugar.
        </div>
      </div>
      <section className="sf-login-card">
        <div className="sf-login-lock">
          <LockKeyhole size={24} />
        </div>
        <span className="sf-eyebrow">Acceso a tu sucursal</span>
        <h2>Bienvenido de nuevo</h2>
        <p className="sf-help">
          {branding?.empresa && branding.empresa !== "Sinfreno"
            ? branding.empresa
            : "Ingresá con tu cuenta autorizada."}
        </p>
        <form onSubmit={submit}>
          <label className="sf-field" htmlFor="login-email">
            Email
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              autoFocus
              value={email}
              disabled={busy}
              onBlur={discover}
              onChange={(event) => {
                currentEmail.current = event.target.value;
                setEmail(event.target.value);
                setBranding(null);
              }}
            />
          </label>
          <label className="sf-field" htmlFor="login-password">
            Contraseña
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="sf-notice sf-error">
              {error}
            </p>
          )}
          <button className="sf-button sf-primary" disabled={busy}>
            {busy ? "Verificando acceso…" : "Ingresar"}
            <ArrowRight size={18} />
          </button>
        </form>
        <p className="sf-login-note">
          Tu rol y tu sucursal determinan las operaciones disponibles.
        </p>
      </section>
    </main>
  );
}
