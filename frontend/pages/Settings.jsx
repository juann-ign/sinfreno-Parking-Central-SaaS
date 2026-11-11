import { useState } from "react";
import api from "../api/axios.js";
import { useAuth } from "../src/context/useAuth.js";
import { errorMessage } from "../ui/format.js";
import PageHeader from "../components/PageHeader.jsx";

function SettingsForm({ user, login }) {
  const [form, setForm] = useState(() => ({
    nombre: user.sucursal.nombre,
    tarifa_auto: String(user.sucursal.tarifa_auto ?? "1000.00"),
    tarifa_moto: String(user.sucursal.tarifa_moto ?? "500.00"),
    tarifa_camioneta: String(user.sucursal.tarifa_camioneta ?? "1500.00"),
    tiempo_cortesia_min: user.sucursal.tiempo_cortesia_min ?? 0,
    fraccion_minutos: user.sucursal.fraccion_minutos ?? 15,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess(false);
    const token = localStorage.getItem("token");
    try {
      await api.patch("/parking/config", {
        ...form,
        tiempo_cortesia_min: Number(form.tiempo_cortesia_min),
        fraccion_minutos: Number(form.fraccion_minutos),
      });
      const { data } = await api.get("/auth/me", { sessionToken: token });
      login(data, token);
      setSuccess(true);
    } catch (failure) {
      setError(
        errorMessage(
          failure,
          "No pudimos guardar la configuración. Consultá los valores antes de reintentar.",
        ),
      );
    } finally {
      setBusy(false);
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
              Nombre de la sucursal
              <input
                required
                maxLength={100}
                value={form.nombre}
                disabled={busy}
                onChange={(event) =>
                  setForm({ ...form, nombre: event.target.value })
                }
              />
            </label>
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
              Una cortesía de 0 se conserva como 0. La cotización del servidor
              explica la regla aplicada a cada estadía.
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
            <p className="sf-help">
              Las estadías heredadas sin snapshot usan la configuración vigente
              al cotizar y se identifican expresamente como heredadas.
            </p>
            <button className="sf-button sf-primary" disabled={busy}>
              {busy ? "Guardando…" : "Guardar configuración local"}
            </button>
          </section>
        </form>
      </main>
    </div>
  );
}
export default function Settings() {
  const { user, login } = useAuth();
  return <SettingsForm key={user.sucursal.id} user={user} login={login} />;
}
