import React from "react";

// Simula las tarjetas de arriba (Recaudación, Ocupación)
export const SkeletonCard = () => (
  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm animate-pulse">
    <div className="h-3 w-24 bg-slate-200 rounded mb-4"></div>
    <div className="h-10 w-32 bg-slate-300 rounded mb-6"></div>
    <div className="h-12 w-full bg-slate-100 rounded-2xl"></div>
  </div>
);

// Simula las filas de las tablas
export const SkeletonTable = ({ rows = 5 }) => (
  <div className="w-full animate-pulse">
    {[...Array(rows)].map((_, i) => (
      <div
        key={i}
        className="flex items-center justify-between p-6 border-b border-slate-50"
      >
        <div className="flex gap-4 items-center">
          <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
          <div className="space-y-2">
            <div className="h-4 w-24 bg-slate-300 rounded"></div>
            <div className="h-3 w-16 bg-slate-200 rounded"></div>
          </div>
        </div>
        <div className="h-4 w-20 bg-slate-200 rounded"></div>
        <div className="h-4 w-20 bg-slate-200 rounded"></div>
      </div>
    ))}
  </div>
);
