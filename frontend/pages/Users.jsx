import { useCallback, useEffect, useState } from "react";
import { Plus, UserRound } from "lucide-react";
import api from "../api/axios.js";
import { useAuth } from "../src/context/useAuth.js";
import { errorMessage } from "../ui/format.js";
import PageHeader from "../components/PageHeader.jsx";
import Dialog from "../components/Dialog.jsx";

const grants = {
  ingreso: "Registrar ingresos",
  salida: "Cotizar y registrar cobros",
  ver_ocupacion: "Consultar ocupación",
  ver_historial: "Consultar historial y PDF de la sucursal",
  ver_stats: "Consultar recaudación agregada",
};
function CreateUser({ onClose, onCreated }) {
  const [form, setForm] = useState({
    email: "",
    password: "",
    rol: "OPERADOR",
    permisos: ["ingreso", "salida", "ver_ocupacion"],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/users", {
        ...form,
        permisos: form.rol === "ADMIN" ? [] : form.permisos,
      });
      onCreated();
    } catch (failure) {
      setError(errorMessage(failure, "No se pudo crear el usuario local."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open title="Crear acceso local" onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <p className="sf-help">
          La sucursal se hereda de tu cuenta. Este formulario no crea accesos
          globales.
        </p>
        <label className="sf-field">
          Email
          <input
            type="email"
            required
            data-autofocus
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
            disabled={busy}
          />
        </label>
        <label className="sf-field">
          Contraseña temporal
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={(event) =>
              setForm({ ...form, password: event.target.value })
            }
            disabled={busy}
          />
        </label>
        <label className="sf-field">
          Rol local
          <select
            value={form.rol}
            onChange={(event) => setForm({ ...form, rol: event.target.value })}
            disabled={busy}
          >
            <option value="OPERADOR">Operador</option>
            <option value="ADMIN">Administrador de esta sucursal</option>
          </select>
        </label>
        {form.rol === "ADMIN" ? (
          <p className="sf-notice sf-warning">
            El administrador puede gestionar usuarios, configuración, turnos y
            reportes de esta sucursal.
          </p>
        ) : (
          <fieldset className="sf-permissions" disabled={busy}>
            <legend>Permisos concedidos</legend>
            {Object.entries(grants).map(([value, label]) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={form.permisos.includes(value)}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      permisos: event.target.checked
                        ? [...form.permisos, value]
                        : form.permisos.filter(
                            (permission) => permission !== value,
                          ),
                    })
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
        )}
        {error && (
          <p className="sf-notice sf-error" role="alert">
            {error}
          </p>
        )}
        <div className="sf-dialog-actions">
          <button
            type="button"
            className="sf-button"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="sf-button sf-primary" disabled={busy}>
            {busy ? "Creando…" : "Crear usuario de esta sucursal"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export default function Users() {
  const { user } = useAuth();
  const [state, setState] = useState({ users: [], loading: true, error: "" });
  const [creating, setCreating] = useState(false);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(
    () =>
      api
        .get("/auth/users")
        .then(({ data }) =>
          setState({ users: data, loading: false, error: "" }),
        )
        .catch((failure) =>
          setState({ users: [], loading: false, error: errorMessage(failure) }),
        ),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  const deactivate = async () => {
    setBusy(true);
    setError("");
    try {
      await api.delete(`/auth/users/${target.id}`);
      setTarget(null);
      load();
    } catch (failure) {
      setError(errorMessage(failure, "No se pudo desactivar el usuario."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="sf-app">
      <PageHeader
        title="Equipo de la sucursal"
        subtitle="Los usuarios desactivados conservan su identidad y el historial de operaciones."
      >
        <button
          className="sf-button sf-primary"
          onClick={() => setCreating(true)}
        >
          <Plus size={18} />
          Crear acceso
        </button>
      </PageHeader>
      <main className="sf-workspace">
        {state.error && (
          <p className="sf-notice sf-error" role="alert">
            {state.error}{" "}
            <button className="sf-button" onClick={load}>
              Reintentar
            </button>
          </p>
        )}
        <section className="sf-card sf-table-wrap">
          <table className="sf-table">
            <caption className="sr-only">Usuarios de tu sucursal</caption>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado de acceso</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {state.loading ? (
                <tr>
                  <td colSpan={4} role="status">
                    Cargando equipo…
                  </td>
                </tr>
              ) : (
                state.users.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <UserRound size={16} className="inline" /> {member.email}
                      {member.email === user.email && <small>Tu cuenta</small>}
                    </td>
                    <td>
                      {member.rol === "ADMIN" ? "Administrador" : "Operador"}
                    </td>
                    <td>
                      <span
                        className={`sf-badge ${member.activo === false ? "sf-badge-warning" : "sf-badge-success"}`}
                      >
                        {member.activo === false
                          ? "Desactivado · historial conservado"
                          : "Activo"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="sf-button sf-danger"
                        disabled={
                          member.activo === false || member.email === user.email
                        }
                        onClick={() => {
                          setError("");
                          setTarget(member);
                        }}
                      >
                        Desactivar acceso
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </main>
      {creating && (
        <CreateUser
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      )}
      {target && (
        <Dialog
          open
          title="Desactivar acceso"
          onClose={() => setTarget(null)}
          busy={busy}
        >
          <p>
            Se impedirá que <strong>{target.email}</strong> inicie sesión o use
            credenciales existentes. Su identidad e historial se conservarán.
          </p>
          {error && (
            <p className="sf-notice sf-error" role="alert">
              {error}
            </p>
          )}
          <div className="sf-dialog-actions">
            <button
              className="sf-button"
              disabled={busy}
              onClick={() => setTarget(null)}
            >
              Cancelar
            </button>
            <button
              className="sf-button sf-danger"
              disabled={busy}
              onClick={deactivate}
            >
              {busy ? "Desactivando…" : "Confirmar desactivación"}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
