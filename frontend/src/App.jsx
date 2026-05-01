import React, { useState } from 'react';
import Login from '../pages/Login.jsx';

function App() {
  // Estado para saber si el usuario está dentro o fuera
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));

  if (!isLoggedIn) {
    return <Login onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold">¡Bienvenido a Sinfreno!</h1>
      <p>Próximamente: Tu Dashboard con estadísticas reales.</p>
      <button 
        onClick={() => { localStorage.removeItem('token'); setIsLoggedIn(false); }}
        className="mt-4 bg-red-500 text-white px-4 py-2 rounded"
      >
        Cerrar Sesión
      </button>
    </div>
  );
}

export default App;