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
export const TableRowSkeleton = () => (
  <tr className="animate-pulse">
    <td className="px-6 py-4">
      <div className="h-10 w-10 bg-slate-200 rounded-full inline-block mr-3"></div>
      <div className="h-6 w-24 bg-slate-100 rounded inline-block"></div>
    </td>
    <td className="px-6 py-4">
      <div className="h-4 w-20 bg-slate-50 rounded"></div>
    </td>
    <td className="px-6 py-4">
      <div className="h-4 w-16 bg-slate-50 rounded"></div>
    </td>
    <td className="px-6 py-4 text-right">
      <div className="h-4 w-12 bg-slate-200 rounded ml-auto"></div>
    </td>
  </tr>
);
