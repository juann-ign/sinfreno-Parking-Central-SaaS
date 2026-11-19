import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CarFront, MapPin } from "lucide-react";
import { VehicleIcon } from "../ui/presentation.jsx";
import { isValidPlate, normalizePlate, plateFormat } from "../ui/plate.js";

const categories = [
  ["AUTO", "Auto"],
  ["MOTO", "Moto"],
  ["CAMIONETA", "Camioneta"],
];

export default function EntryForm({ towers, cashId, onSubmit, busy, pending }) {
  const [plate, setPlate] = useState("");
  const [category, setCategory] = useState("AUTO");
  const [tower, setTower] = useState("");
  const plateRef = useRef(null);
  const selectedTower = tower || String(towers[0]?.id || "");
  const disabled = !cashId || !selectedTower || busy || pending;
  const format = plateFormat(category);
  const validPlate = isValidPlate(plate, category);
  const showWarning = plate.length > 0 && !validPlate;
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
    if (disabled || !validPlate) return;
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
          <h2>
            <CarFront size={22} /> Registrar ingreso
          </h2>
        </div>
      </div>
      <form onSubmit={submit} noValidate>
        <fieldset disabled={disabled} className="sf-entry-fields">
          <div className="sf-field sf-plate-field">
            <label htmlFor="entry-plate">Patente</label>
            <input
              ref={plateRef}
              id="entry-plate"
              autoComplete="off"
              spellCheck="false"
              required
              minLength={6}
              maxLength={10}
              pattern={format.pattern}
              placeholder={format.placeholder}
              aria-invalid={showWarning}
              aria-describedby={showWarning ? "entry-plate-warning" : undefined}
              value={plate}
              onChange={(event) => setPlate(normalizePlate(event.target.value))}
            />
            {showWarning && (
              <p className="sf-plate-warning" id="entry-plate-warning" role="status">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>Formato inválido. Usá {format.examples}.</span>
              </p>
            )}
          </div>
          <div className="sf-field sf-category-field">
            <span id="entry-category-label">Categoría</span>
            <div className="sf-vehicle-options" role="radiogroup" aria-labelledby="entry-category-label">
              {categories.map(([value, label]) => (
                <label key={value} className={`sf-vehicle-option ${category === value ? "selected" : ""}`}>
                  <input
                    className="sf-vehicle-radio"
                    type="radio"
                    name="entry-category"
                    value={value}
                    checked={category === value}
                    onChange={() => setCategory(value)}
                  />
                  <VehicleIcon category={value} size={24} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="sf-field" htmlFor="entry-sector">
            <span className="sf-icon-label"><MapPin size={16} aria-hidden="true" /> Sector</span>
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
            disabled={disabled || !validPlate}
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
