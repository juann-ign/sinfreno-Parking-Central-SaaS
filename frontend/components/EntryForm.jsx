import React, { useState } from 'react';
import { PlusCircle, Car } from 'lucide-react';
import api from '../api/axios';

const EntryForm = ({ onEntrySuccess }) => {
    // Estas son nuestras "cajas" de memoria
    const [patente, setPatente] = useState('');
    const [torreId, setTorreId] = useState('1'); // Por defecto torre 1
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault(); // Evita que la página se recargue sola
        if (!patente) return alert("Por favor, ingresa una patente");

        setLoading(true);
        try {
            // Llamada al backend (FastAPI)
            await api.post('/parking/ingreso', {
                patente: patente.trim().toUpperCase(),
                torre_id: parseInt(torreId)
            });

            // Si sale bien:
            setPatente(''); // Limpiamos el cuadrito de texto
            alert(`Vehículo ${patente.toUpperCase()} ingresado con éxito`);
            onEntrySuccess(); // Le avisamos al Dashboard que refresque la lista
        } catch (error) {
            alert(error.response?.data?.detail || "Error al ingresar el vehículo");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md border border-blue-100 mb-8">
            <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                <PlusCircle className="text-blue-600" /> Registrar Nuevo Ingreso
            </h3>
            
            <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Patente / Dominio</label>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                            <Car size={18} />
                        </span>
                        <input 
                            type="text"
                            placeholder="Ej: ABC1234"
                            className="w-full pl-10 pr-4 py-3 border-2 border-gray-100 rounded-lg focus:border-blue-500 focus:ring-0 text-xl font-mono uppercase transition-all"
                            value={patente}
                            onChange={(e) => setPatente(e.target.value.toUpperCase())}
                            maxLength={10}
                        />
                    </div>
                </div>

                <div className="w-32">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Torre</label>
                    <select 
                        className="w-full p-3 border-2 border-gray-100 rounded-lg focus:border-blue-500 bg-white text-lg"
                        value={torreId}
                        onChange={(e) => setTorreId(e.target.value)}
                    >
                        <option value="1">Torre 1</option>
                        <option value="2">Torre 2</option>
                    </select>
                </div>

                <button 
                    type="submit"
                    disabled={loading}
                    className={`px-8 py-3 rounded-lg font-bold text-white transition-all flex items-center gap-2 shadow-lg ${
                        loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                    }`}
                >
                    {loading ? 'Procesando...' : 'INGRESAR VEHÍCULO'}
                </button>
            </form>
        </div>
    );
};

export default EntryForm;