import { useEffect, useState } from "react";
import { elapsedInfo } from "../ui/format.js";

function Duration({ value, courtesy }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = elapsedInfo(value, now, courtesy);
  if (!elapsed)
    return <span className="sf-badge sf-badge-warning">Fecha a revisar</span>;
  const { minutes, inCourtesy } = elapsed;
  return (
    <span className={`sf-badge ${inCourtesy ? "sf-badge-success" : ""}`}>
      {inCourtesy ? "En cortesía · " : ""}
      {minutes < 60
        ? `${minutes} min`
        : `${Math.floor(minutes / 60)} h ${minutes % 60} min`}
    </span>
  );
}
export default function ActiveTable({
  vehicles,
  towers,
  onQuote,
  canQuote,
  loading,
  courtesy,
}) {
  return (
    <div className="sf-table-wrap">
      <table className="sf-table">
        <caption className="sr-only">
          Vehículos activos de esta sucursal
        </caption>
        <thead>
          <tr>
            <th>Patente / categoría</th>
            <th>Sector</th>
            <th>Tiempo transcurrido</th>
            <th>
              <span className="sr-only">Acción</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={4} role="status">
                Cargando vehículos…
              </td>
            </tr>
          ) : !vehicles.length ? (
            <tr>
              <td colSpan={4} className="sf-empty">
                No hay vehículos que coincidan con la búsqueda.
              </td>
            </tr>
          ) : (
            vehicles.map((stay) => (
              <tr key={stay.id}>
                <td>
                  <strong className="sf-plate">{stay.patente}</strong>
                  <small>{stay.tipo_vehiculo}</small>
                </td>
                <td>
                  {towers.find((tower) => tower.id === stay.torre_id)
                    ? `Sector ${towers.find((tower) => tower.id === stay.torre_id).numero}`
                    : `Sector · ID ${stay.torre_id}`}
                </td>
                <td>
                  <Duration value={stay.fecha_entrada} courtesy={courtesy} />
                </td>
                <td className="sf-row-action">
                  {canQuote && (
                    <button className="sf-button" onClick={() => onQuote(stay)}>
                      Cotizar salida
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
