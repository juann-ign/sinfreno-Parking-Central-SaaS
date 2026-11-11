import { useState } from "react";
import api from "../api/axios.js";
import Dialog from "./Dialog.jsx";
import { errorMessage } from "../ui/format.js";

export default function ReviewDateDialog({ stay, onClose, onReviewed }) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const iso = new Date(`${date}:00-03:00`).toISOString();
      await api.post(`/parking/${stay.id}/revisar-fecha`, {
        fecha_entrada_utc: iso,
        motivo: reason,
      });
      onReviewed();
    } catch (failure) {
      setError(errorMessage(failure, "No se pudo registrar la revisión."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      title={`Revisar fecha histórica · ${stay.patente}`}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <p className="sf-notice sf-warning">
          La fecha heredada no tiene una zona horaria confiable. Confirmá el
          ingreso con una fuente verificable; esta acción quedará auditada.
        </p>
        <label className="sf-field">
          Ingreso confirmado, hora de Buenos Aires (UTC−3)
          <input
            type="datetime-local"
            required
            data-autofocus
            value={date}
            onChange={(event) => setDate(event.target.value)}
            disabled={busy}
          />
        </label>
        <label className="sf-field">
          Fuente y motivo de la revisión
          <textarea
            rows={3}
            required
            minLength={8}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={busy}
          />
        </label>
        {error && (
          <p role="alert" className="sf-notice sf-error">
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
            {busy ? "Guardando…" : "Registrar revisión y cotizar"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
