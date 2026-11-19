import { useEffect, useRef, useState } from "react";
import api from "../api/axios.js";
import { useAuth } from "../src/context/useAuth.js";
import { errorMessage } from "../ui/format.js";
import PageHeader from "../components/PageHeader.jsx";

function settingsValues(branch) {
  return {
    nombre: branch.nombre,
    direccion: branch.direccion ?? "",
    telefono: branch.telefono ?? "",
    tarifa_auto: String(branch.tarifa_auto ?? "1000.00"),
    tarifa_moto: String(branch.tarifa_moto ?? "500.00"),
    tarifa_camioneta: String(branch.tarifa_camioneta ?? "1500.00"),
    tiempo_cortesia_min: String(branch.tiempo_cortesia_min ?? 0),
    fraccion_minutos: String(branch.fraccion_minutos ?? 15),
  };
}

function SettingsForm({ user, login, retrySession }) {
  const [form, setForm] = useState(() => settingsValues(user.sucursal));
  const saved = useRef(form);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [profileWarning, setProfileWarning] = useState("");
  const mounted = useRef(false);
  const profileRequest = useRef(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      profileRequest.current?.abort();
    };
  }, []);
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess(false);
    setProfileWarning("");
    const token = localStorage.getItem("token");
    const isCurrent = () => mounted.current && localStorage.getItem("token") === token;
    try {
      const changes = Object.fromEntries(
        Object.entries(form).filter(([key, value]) => value !== saved.current[key]),
      );
      if ("tiempo_cortesia_min" in changes) changes.tiempo_cortesia_min = Number(form.tiempo_cortesia_min);
      if ("fraccion_minutos" in changes) changes.fraccion_minutos = Number(form.fraccion_minutos);
      const { data } = await api.patch("/parking/config", changes, { sessionToken: token, timeout: 12000 });
      if (isCurrent()) {
        saved.current = settingsValues(data);
        setForm(saved.current);
      }
    } catch (failure) {
      if (isCurrent()) setError(errorMessage(failure,
        "No pudimos confirmar el guardado. Consultá los valores antes de reintentar.",
      ));
      if (mounted.current) setBusy(false);
      return;
    }
    if (!isCurrent()) {
      if (mounted.current) setBusy(false);
      return;
    }
    setSuccess(true);
    const controller = new AbortController();
    profileRequest.current = controller;
    try {
      const { data } = await api.get("/auth/me", {
        sessionToken: token, signal: controller.signal, timeout: 12000,
      });
      if (!isCurrent() || controller.signal.aborted) return;
      if (data.email !== user.email || data.sucursal?.id !== user.sucursal.id) {
        retrySession();
        return;
      }
      login(data, token);
    } catch {
      if (isCurrent() && !controller.signal.aborted) {
        setProfileWarning("La configuración quedó guardada, pero no pudimos actualizar el perfil de la sesión. No hace falta volver a guardar; recargá o verificá la sesión para actualizarlo.");
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <div className="sf-app">
      <PageHeader
        title="Configuración de la sucursal"
        subtitle="Tarifas y reglas para nuevos ingresos. Las estadías nuevas conservan lo aceptado al ingresar."
      />
      <main className="sf-workspace">
        <form onSubmit={save} className="sf-settings-grid">
          <section className="sf-card sf-form-card sf-ticket-contact">
            <h2>Datos del ticket</h2>
            <p className="sf-help">La dirección y el teléfono son opcionales. También se actualizan en las reimpresiones.</p>
            <div className="sf-ticket-contact-fields">
              <label className="sf-field">
                Nombre de la sucursal
                <input
                  required maxLength={100} value={form.nombre} disabled={busy}
                  onChange={(event) => setForm({ ...form, nombre: event.target.value })}
                />
              </label>
              <label className="sf-field">
                Dirección de la cochera
                <input
                  maxLength={200} value={form.direccion} disabled={busy}
                  onChange={(event) => setForm({ ...form, direccion: event.target.value })}
                />
              </label>
              <label className="sf-field">
                Teléfono de contacto
                <input
                  type="tel" maxLength={40} pattern=".*[0-9].*" title="Incluí al menos un dígito."
                  value={form.telefono} disabled={busy}
                  onChange={(event) => setForm({ ...form, telefono: event.target.value })}
                />
              </label>
            </div>
          </section>
          <section className="sf-card sf-form-card">
            <h2>Tarifas por categoría</h2>
            <p className="sf-help">
              Importes en ARS por hora. Después de la cortesía inclusiva se
              cobra la primera hora completa; luego se aplican fracciones.
            </p>
            {[
              ["tarifa_auto", "Auto"],
              ["tarifa_moto", "Moto"],
              ["tarifa_camioneta", "Camioneta"],
            ].map(([key, label]) => (
              <label className="sf-field" key={key}>
                {label} · ARS/hora
                <input
                  type="number"
                  min="0.01"
                  max="999999999999.99"
                  step="0.01"
                  required
                  value={form[key]}
                  disabled={busy}
                  onChange={(event) =>
                    setForm({ ...form, [key]: event.target.value })
                  }
                />
              </label>
            ))}
          </section>
          <section className="sf-card sf-form-card">
            <h2>Reglas operativas</h2>
            <label className="sf-field">
              Cortesía inclusiva, en minutos
              <input
                type="number"
                required
                min="0"
                step="1"
                value={form.tiempo_cortesia_min}
                disabled={busy}
                onChange={(event) =>
                  setForm({ ...form, tiempo_cortesia_min: event.target.value })
                }
              />
            </label>
            <label className="sf-field">
              Fracción posterior a la primera hora, en minutos
              <input
                type="number"
                required
                min="1"
                step="1"
                value={form.fraccion_minutos}
                disabled={busy}
                onChange={(event) =>
                  setForm({ ...form, fraccion_minutos: event.target.value })
                }
              />
            </label>
            <p className="sf-help">
              0 = sin minutos de cortesía.
            </p>
            <div className="sf-brand-readonly">
              <span
                className="sf-color-swatch"
                style={{ backgroundColor: user.sucursal.color || "#4f46e5" }}
              />
              <span>
                La identidad de empresa es compartida y requiere administración
                global.
              </span>
            </div>
          </section>
          <section className="sf-settings-save">
            {error && (
              <p className="sf-notice sf-error" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="sf-notice sf-success" role="status">
                Configuración guardada.
              </p>
            )}
            {profileWarning && <p className="sf-notice sf-warning" role="status">{profileWarning}</p>}
            <p className="sf-help">
              Las estadías heredadas sin snapshot usan la configuración vigente
              al cotizar y se identifican expresamente como heredadas.
            </p>
            <button className="sf-button sf-primary" disabled={busy}>
              {busy ? success ? "Actualizando sesión…" : "Guardando…" : "Guardar configuración local"}
            </button>
          </section>
        </form>
      </main>
    </div>
  );
}
export default function Settings() {
  const { user, login, retrySession, logout } = useAuth();
  if (!user?.sucursal) return (
    <div className="sf-app">
      <PageHeader title="Configuración no disponible" />
      <main className="sf-workspace">
        <p className="sf-notice sf-warning" role="alert">Tu sesión no tiene una sucursal asignada para configurar. No se muestran ni modifican datos de otra sucursal.</p>
        <button className="sf-button" onClick={logout}>Cerrar sesión</button>
      </main>
    </div>
  );
  return <SettingsForm key={`${user.email}/${user.sucursal.id}`} user={user} login={login} retrySession={retrySession} />;
}
