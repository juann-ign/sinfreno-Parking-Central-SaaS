import { useEffect, useRef, useState } from "react";
import { ArrowRight, CarFront } from "lucide-react";

export default function EntryForm({ towers, cashId, onSubmit, busy, pending }) {
  const [plate, setPlate] = useState("");
  const [category, setCategory] = useState("AUTO");
  const [tower, setTower] = useState("");
  const plateRef = useRef(null);
  const selectedTower = tower || String(towers[0]?.id || "");
  const disabled = !cashId || !selectedTower || busy || pending;
  const initialFocusHandled = useRef(false);
  useEffect(() => {
    if (disabled || initialFocusHandled.current) return;
    initialFocusHandled.current = true;
    const active = document.activeElement;
    if (document.querySelector("dialog[open]")) return;
    if (active && active !== document.body && active !== document.documentElement) return;
    plateRef.current?.focus();
  }, [disabled]);
  const submit = async (event) => {
    event.preventDefault();
    if (disabled || !selectedTower) return;
    const result = await onSubmit({
      patente: plate.trim().toUpperCase(),
      tipo: category,
      torre_id: Number(selectedTower),
      caja_id: cashId,
    });
    if (result) {
      setPlate("");
      requestAnimationFrame(() => plateRef.current?.focus());
    }
  };
  return (
    <section className="sf-card sf-entry">
      <div className="sf-section-heading">
        <div>
          <span className="sf-eyebrow">Entrada rápida</span>
          <h2>
            <CarFront size={22} /> Registrar ingreso
          </h2>
        </div>
        <span className="sf-hint">Patente + Enter</span>
      </div>
      <form onSubmit={submit}>
        <fieldset disabled={disabled} className="sf-entry-fields">
          <label className="sf-field sf-plate-field" htmlFor="entry-plate">
            Patente
            <input
              ref={plateRef}
              id="entry-plate"
              autoComplete="off"
              spellCheck="false"
              required
              minLength={6}
              maxLength={10}
              pattern="[A-Za-z0-9]{6,10}"
              placeholder="ABC123"
              value={plate}
              onChange={(event) =>
                setPlate(
                  event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase(),
                )
              }
            />
          </label>
          <label className="sf-field" htmlFor="entry-category">
            Categoría
            <select
              id="entry-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="AUTO">Auto</option>
              <option value="MOTO">Moto</option>
              <option value="CAMIONETA">Camioneta</option>
            </select>
          </label>
          <label className="sf-field" htmlFor="entry-sector">
            Sector
            <select
              id="entry-sector"
              required
              value={selectedTower}
              onChange={(event) => setTower(event.target.value)}
            >
              {towers.map((item) => (
                <option key={item.id} value={item.id}>
                  Sector {item.numero}
                </option>
              ))}
            </select>
          </label>
          <button
            className="sf-button sf-primary"
            disabled={!selectedTower || plate.length < 6}
            type="submit"
          >
            {busy ? "Registrando…" : "Registrar ingreso"}
            <ArrowRight size={18} />
          </button>
        </fieldset>
      </form>
      {!cashId && (
        <p className="sf-help">
          Se necesita una caja abierta para registrar el ingreso. Las consultas
          siguen disponibles.
        </p>
      )}
    </section>
  );
}
