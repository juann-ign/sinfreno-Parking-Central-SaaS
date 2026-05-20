import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const RevenueChart = ({ data }) => {
  // Formateador para que los montos se vean como moneda ($ 1.500)
  const formatCurrency = (value) => `$${value.toLocaleString()}`;

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 h-[400px]">
      <h3 className="text-lg font-bold text-gray-700 mb-6 flex items-center gap-2">
        Recaudación por Hora (Hoy)
      </h3>

      <ResponsiveContainer width="100%" height="85%">
        <BarChart
          data={data}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#f0f0f0"
          />
          <XAxis
            dataKey="hora"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#9ca3af", fontSize: 12 }}
            label={{
              value: "Hora del día",
              position: "insideBottom",
              offset: -5,
              fontSize: 12,
            }}
          />
          <YAxis
            tickFormatter={formatCurrency}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#9ca3af", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "#f3f4f6" }}
            contentStyle={{
              borderRadius: "10px",
              border: "none",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
            formatter={(value) => [formatCurrency(value), "Recaudado"]}
          />
          <Bar
            dataKey="monto"
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
            barSize={40}
          >
            {/* Podemos hacer que la barra cambie de color si supera cierto monto */}
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.monto > 5000 ? "#10b981" : "#3b82f6"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RevenueChart;
