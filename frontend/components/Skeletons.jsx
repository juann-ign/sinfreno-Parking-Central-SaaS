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
  <tr className="animate-pulse flex flex-col lg:table-row border-b border-slate-100 p-4 lg:p-0">
    <td className="px-4 lg:px-8 py-4 lg:py-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 lg:w-12 lg:h-12 bg-slate-200 rounded-xl"></div>
        <div className="h-4 w-24 bg-slate-100 rounded"></div>
      </div>
    </td>
    <td className="hidden lg:table-cell px-8 py-6">
      <div className="h-4 w-20 bg-slate-50 rounded"></div>
    </td>
    <td className="px-4 lg:px-8 py-2 lg:py-6">
      <div className="h-6 w-32 bg-slate-100 rounded-lg"></div>
    </td>
    <td className="px-4 lg:px-8 py-4 lg:py-6 text-right">
      <div className="h-10 w-24 bg-slate-200 rounded-xl ml-auto"></div>
    </td>
  </tr>
);
