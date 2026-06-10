import React, { useState } from "react";
import api from "../api/axios";
import { LogIn, Car } from "lucide-react";
import { useAuth } from "../src/context/AuthContext";

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault(); // Evita que la página se recargue
    try {
      // Enviamos los datos en formato Form Data como pide FastAPI
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);

      const response = await api.post("/auth/login", formData);

      // Guardamos el token para Axios
      localStorage.setItem("token", response.data.access_token);

      // 2. Guardar TODA la info del usuario en el Contexto (SaaS Pro)
      login(response.data.user_info);

      // Avisamos a la App que entramos con éxito
      onLoginSuccess();
    } catch (err) {
      setError("Credenciales inválidas. Intenta de nuevo.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 font-sans">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="flex justify-center mb-6 text-blue-600">
          <Car size={48} strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
          Sinfreno
        </h2>
        <p className="text-center text-gray-500 mb-8">
          Gestión de Parking Inteligente
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)} // "Reactivo": actualiza la memoria al escribir
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              type="password"
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 font-medium transition-colors"
          >
            <LogIn className="mr-2" size={18} /> Entrar al Panel
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
