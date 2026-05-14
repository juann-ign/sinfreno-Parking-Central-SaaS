import React, { useState } from 'react';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import { Toaster } from sonner

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
  };

  return (
    <div className="font-sans antialiased text-gray-900">
      <Toaster position="top-right" richColors closeButton />
      {!isLoggedIn ? (
        <Login onLoginSuccess={() => setIsLoggedIn(true)} />
      ) : (
        <Dashboard onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;