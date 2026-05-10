import React, { useState } from 'react';
import { PlusCircle, Car, AlertCircle, CheckCircle2, Globe } from 'lucide-react';
import api from '../api/axios';

const EntryForm = ({ onEntrySuccess }) => {
    const [patente, setPatente] = useState('');
    const [torreId, setTorreId] = useState('1');
    const [loading, setLoading] = useState(false);
    
    // Estados de validación
    const [status, setStatus] = useState('empty'); // 'empty', 'valid-arg', 'special', 'invalid'

    const analizarPatente = (valor) => {
        // 1. Limpieza absoluta (solo letras y números)
        const limpio = valor.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        if (limpio.length > 8) return; // Máximo 8 (algunos países usan 8)

        setPatente(limpio);

        // 2. Definir patrones (Regex)
        const patronArgViejo = /^[A-Z]{3}\d{3}$/;          // AAA111
        const patronArgNuevo = /^[A-Z]{2}\d{3}[A-Z]{2}$/;  // AA111AA
        const esAlfanumerico = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{6,8}$/; // Mezcla de letras y números entre 6 y 8

        // 3. Lógica de estados
        if (limpio === '') {
            setStatus('empty');
        } else if (patronArgViejo.test(limpio) || patronArgNuevo.test(limpio)) {
            setStatus('valid-arg');
        } else if (esAlfanumerico.test(limpio)) {
            setStatus('special');
        } else {
            setStatus('invalid');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (status === 'invalid' || status === 'empty') return;

        setLoading(true);
        try {
            await api.post('/parking/ingreso', {
                patente: patente,
                torre_id: parseInt(torreId)
            });
            setPatente('');
            setStatus('empty');
            alert(`✅ Ingreso registrado: ${patente}`);
            onEntrySuccess();
        } catch (error) {
            alert(error.response?.data?.detail || "Error al ingresar");
        } finally {
            setLoading(false);
        }
    };

    // Colores dinámicos según el estado
    const getStyles = () => {
        switch(status) {
            case 'valid-arg': return 'border-green-500 bg-green-50 focus:ring-green-100';
            case 'special': return 'border-orange-400 bg-orange-50 focus:ring-orange-100';
            case 'invalid': return 'border-red-400 bg-red-50 focus:ring-red-100';
            default: return 'border-gray-100 bg-gray-50 focus:border-blue-500 focus:ring-blue-100';
        }
    };

    return (
        <div className="bg-white p-8 rounded-2xl shadow-xl border-2 border-blue-50 mb-12 mt-12 transition-all">
            <div className="mb-6">
                <h3 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                    <PlusCircle className="text-blue-600" size={24} /> 
                    Registrar ingreso de vehículo
                </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-wrap items-start gap-6">
                {/* Input de Patente con validación y feedback visual */}
                <div className="flex-1 min-w-[300px] relative">
                    <label className="block text-sm font-bold text-gray-600 mb-2 uppercase tracking-widest">
                        Patente 
                    </label>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400">
                            <Car size={24} />
                        </span>
                        <input 
                            type="text"
                            placeholder="ABC1234"
                            className={`w-full pl-12 pr-12 py-5 border-3 rounded-xl transition-all text-2xl font-mono font-bold uppercase outline-none ${getStyles()}`}
                            value={patente}
                            onChange={(e) => analizarPatente(e.target.value)}
                        />
                        {/* ICONO DE ESTADO A LA DERECHA DEL INPUT */}
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                            {status === 'valid-arg' && <CheckCircle2 className="text-green-500" size={28} />}
                            {status === 'special' && <Globe className="text-orange-500" size={28} />}
                            {status === 'invalid' && <AlertCircle className="text-red-500" size={28} />}
                        </div>
                    </div>

                    {/* MENSAJES DE AYUDA */}
                    <div className="absolute top-full left-0 mt-2 w-full">
                        {status === 'valid-arg' && <p className="text-green-600 text-xs font-bold uppercase tracking-tighter">Patente Argentina estándar</p>}
                        {status === 'special' && <p className="text-green-600 text-xs font-bold uppercase tracking-tighter">Formato especial / extranjero</p>}
                        {status === 'invalid' && <p className="text-green-500 text-xs font-bold uppercase tracking-tighter">Debe mezclar letras y números (6-8 caracteres)</p>}
                    </div>
                </div>

                <div className="w-40">
                    <label className="block text-sm font-bold text-gray-600 mb-2 uppercase tracking-widest text-center">Torre</label>
                    <select 
                        className="w-full p-5 border-3 border-gray-100 bg-gray-50 rounded-xl focus:border-blue-500 text-xl font-bold transition-all text-center"
                        value={torreId}
                        onChange={(e) => setTorreId(e.target.value)}
                    >
                        <option value="1">T1</option>
                        <option value="2">T2</option>
                    </select>
                </div>

                <div className="flex flex-col">
                    <label className="block text-sm font-bold opacity-0 mb-2 uppercase">
                        Acción
                    </label>
                    <button 
                        type="submit"
                        disabled={loading || status === 'invalid' || status === 'empty'}
                        className={`px-10 py-5 rounded-xl font-black text-xl text-white shadow-xl transition-all flex items-center justify-content h-[76px] gap-3 ${
                            (loading || status === 'invalid' || status === 'empty')
                            ? 'bg-gray-300 cursor-not-allowed shadow-none' 
                            : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                        }`}
                    >
                        {loading ? '...' : 'INGRESAR'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EntryForm;