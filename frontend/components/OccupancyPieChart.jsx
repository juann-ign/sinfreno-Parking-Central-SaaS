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
  const COLORS = ["#3b82f6", "e5e7eb"];

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100 h-[300px]">
      <h3 className="text-lg font-bold text-gray-700 mb-2">
        Estado de Capacidad
      </h3>
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
  );
};

export default OccupancyPieChart;
