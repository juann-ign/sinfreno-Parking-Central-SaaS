import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

// --- COMPONENTE DE TOOLTIP PERSONALIZADO (UX FIX) ---
// Esto asegura que el texto siempre sea legible, sin importar el color del gráfico
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white px-4 py-2 rounded-xl shadow-xl border border-slate-700 text-xs font-bold">
        <p className="uppercase tracking-widest opacity-70 mb-1">
          {payload[0].name}
        </p>
        <p className="text-sm">{payload[0].value} Vehículos</p>
      </div>
    );
  }
  return null;
};

const OccupancyPieChart = ({ occupied, available }) => {
  const total = occupied + available;
  const percentage = total > 0 ? Math.round((occupied / total) * 100) : 0;

  const data = [
    { name: "Ocupado", value: occupied },
    { name: "Disponible", value: available },
  ];

  // Paleta corregida para mejor contraste
  const COLORS = ["#6366f1", "#e2e8f0"]; // Un gris un pelín más oscuro para el disponible

  return (
    <div
      className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200 
                    w-full mx-auto
                    flex flex-col overflow-hidden
                    min-h-[350px] max-h-[500px] aspect-[4/5] md:aspect-square"
    >
      {/* 
          EXPLICACIÓN DE LAS CLASES:
          - min-h-[350px]: Evita que se vea muy chico cuando hay muchas cosas.
          - max-h-[500px]: Evita que se estire demasiado cuando está solo (caso Operario).
          - aspect-[4/5]: Le da una forma vertical elegante.
          - md:aspect-square: En pantallas más grandes se vuelve cuadrado.
      */}{" "}
      {/* HEADER: Reducimos padding y margin para dar espacio al gráfico */}
      <div className="mb-2 shrink-0">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          Estado de Capacidad
        </h3>
        <p className="text-xl font-black text-slate-800 tracking-tighter">
          Ocupación Real
        </p>
      </div>
      {/* CONTENEDOR DEL GRÁFICO: Usamos 'relative' y 'flex-1' para que ocupe todo el resto */}
      <div className="flex-1 relative min-h-0 w-full">
        {/* TEXTO CENTRAL: Lo centramos matemáticamente */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
          <span className="text-4xl font-black text-slate-800 leading-none">
            {percentage}%
          </span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Lleno
          </span>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="65%" // Usamos porcentajes para mejor respuesta
              outerRadius="85%"
              paddingAngle={5}
              cornerRadius={8}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  className="outline-none focus:outline-none"
                />
              ))}
            </Pie>
            {/* TOOLTIP PERSONALIZADO APLICADO AQUÍ */}
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* LEYENDA INFERIOR */}
      <div className="grid grid-cols-2 gap-4 mt-2 border-t border-slate-50 pt-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">
              Ocupado
            </p>
            <p className="font-black text-slate-700 text-sm">
              {occupied} LUGARES
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-l border-slate-100 pl-4">
          <div className="w-3 h-3 rounded-full bg-slate-300"></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">
              Libre
            </p>
            <p className="font-black text-slate-700 text-sm">
              {available} LUGARES
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OccupancyPieChart;
