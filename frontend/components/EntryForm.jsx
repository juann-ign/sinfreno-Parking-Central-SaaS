import React, { useState } from 'react';
import { PlusCircle, Car, AlertCircle } from 'lucide-react';
import api from '../api/axios';

const EntryForm = ({ onEntrySuccess }) => {
    // Estas son nuestras "cajas" de memoria
    const [patente, setPatente] = useState('');
    const [torreId, setTorreId] = useState('1'); // Por defecto torre 1
    const [loading, setLoading] = useState(false);
    const [errorLocal, setErrorLocal] = useState('');

    // FUNCIÓN DE VALIDACIÓN (Visión de Negocio: Datos limpios)
    const validarPatente = (valor) => {
        // 1. Solo permitir letras y números (elimina espacios y guiones)
        const limpio = valor.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        
        // 2. Limitar a 7 caracteres (estándar Mercosur)
        if (limpio.length > 7) return;

        setPatente(limpio);

        // 3. Validación de formato básico (mínimo 6 caracteres para ser válida)
        if (limpio.length > 0 && limpio.length < 6) {
            setErrorLocal('La patente debe tener 6 o 7 caracteres');
        } else {
            setErrorLocal('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); // Evita que la página se recargue sola

        if (!patente) return alert("Por favor, ingresa una patente");

        // No enviamos si no cumple el mínimo
        if (patente.length < 6) {
            setErrorLocal('Formato de patente inválido');
            return;
        }

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
        <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-blue-50 mb-12 mt-12 transition-all">
            <div className = "mb-6">
                <h3 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
                    <PlusCircle className="text-blue-600" size={24} /> Registrar nuevo ingreso
                </h3>
                <p className="text-gray-500 text-sm">Registra un nuevo vehículo en el sistema.</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-6">
                <div className="flex-1 min-w-[300px]">
                    <label className="block text-sm font-bold text-gray-600 mb-2 uppercase tracking-wide">Patente (sin espacios)</label>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400">
                            <Car size={24} />
                        </span>
                        <input 
                            type="text"
                            placeholder="ABC123 o AA111AA"
                            className={`w-full pl-12 pr-4 py-5 border-3 rounded-xl focus:ring-4 text-2xl font-mono font-all transition-all uppercase ${
                                errorLocal ? `border-red-500 bg-red-100 focus:border-red-400 focus:ring-red 100` : `border-gray-100 bg-gray 50 focus:border-blue-500 focus:ring-blue-200`
                            }`}
                            value={patente}
                            onChange={(e) => validarPatente(e.target.value)}
                        />
                    </div>
                    {errorLocal && (
                        <p className='mt-2 text-red 500 text-sm flex items-center gap-1 font-medium'>
                            <AlertCircle size={14} /> {errorLocal}
                        </p>
                    )}
                </div>

                <div className="w-40">
                    <label className="block text-sm font-bold text-gray-600 mb-2 uppercase">Torre</label>
                    <select 
                        className="w-full p-5 border-3 border-gray-100 bg-gray 50 rounded-xl focus:border-blue-500 text-2xl font-bold transition-all"
                        value={torreId}
                        onChange={(e) => setTorreId(e.target.value)}
                    >
                        <option value="1">Torre 1</option>
                        <option value="2">Torre 2</option>
                    </select>
                </div>

                <button 
                    type="submit"
                    disabled={loading || patente.length < 6}
                    className={`px-10 py-5 rounded-xl font-black text-xl text-white shadow-x1 transition-all flex items-center gap-3 ${
                        loading || patente.length < 6 
                        ? 'bg-gray-300 cursor-not-allowed shadow-none' 
                        : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-1 active:scale-95'
                    }`}
                >
                    {loading ? 'Procesando...' : 'INGRESAR VEHÍCULO'}
                </button>
            </form>
        </div>
    );
};

export default EntryForm;