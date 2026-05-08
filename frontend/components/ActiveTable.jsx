import React from 'react';
import { LogOut, Clock, Hash, MapPin } from 'lucide-react';

const ActiveTable = ({ vehicles, onCheckout }) => {
    return (
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <Hash size={18} className="text-blue-500" /> Vehículos en el Predio
            </h3>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Patente</th>
                <th className="px-6 py-4 font-semibold">Torre / Sector</th>
                <th className="px-6 py-4 font-semibold">Ingreso</th>
                <th className="px-6 py-4 font-semibold text-right">Acción</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {vehicles.length === 0 ? (
                <tr>
                    <td colSpan="4" className="px-6 py-10 text-center text-gray-400">
                    No hay vehículos activos en este momento.
                    </td>
                </tr>
                ) : (
                vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4">
                        <span className="font-mono font-bold text-lg bg-gray-100 px-2 py-1 rounded border border-gray-200">
                        {v.patente || "S/D"} 
                        </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                        <div className="flex items-center gap-1">
                        <MapPin size={14} /> Torre {v.torre_id}
                        </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                        <div className="flex items-center gap-1 text-sm">
                        <Clock size={14} /> {new Date(v.fecha_entrada).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                        <button
                        onClick={() => onCheckout(v.patente)}
                        className="bg-white border border-red-200 text-red-500 hover:bg-red-500 hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ml-auto shadow-sm"
                        >
                        <LogOut size={16} /> Cobrar Salida
                        </button>
                    </td>
                    </tr>
                ))
                )}
            </tbody>
            </table>
        </div>
        </div>
    );
};

export default ActiveTable;