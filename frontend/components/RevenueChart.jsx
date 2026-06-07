// frontend/components/RevenueChart.jsx

import React from "react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from "recharts";

const RevenueChart = ({ data }) => {
  return (
    <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 h-full flex flex-col">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
        Tendencia Horaria
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            {/* Solo mostramos la hora abajo de forma muy sutil */}
            <XAxis dataKey="hora" hide />
            <Tooltip
              cursor={{ fill: "#f1f5f9" }}
              contentStyle={{
                borderRadius: "12px",
                border: "none",
                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                fontSize: "10px",
                fontWeight: "900",
              }}
            />
            <Bar
              dataKey="monto"
              fill="#6366f1"
              radius={[4, 4, 4, 4]}
              barSize={12}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RevenueChart;
