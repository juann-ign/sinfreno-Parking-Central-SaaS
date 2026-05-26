import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

const OccupancyPieChart = ({ occupied, available }) => {
  const data = [
    { name: "Ocupado", value: occupied },
    { name: "Disponible", value: available },
  ];

  // Colores azul para lo lleno y gris para lo vacío
  const COLORS = ["#6e6c6c", "#06c906"];

  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 h-[350px] flex flex-col">
      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
        Distribución de Planta
      </h3>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default OccupancyPieChart;
