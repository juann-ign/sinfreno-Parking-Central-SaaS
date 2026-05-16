import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import History from "../pages/History";
import { Toaster } from "sonner";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("token"));

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
  };

  return (
    <BrowserRouter>
      <div className="font-sans antialiased text-gray-900">
        <Toaster position="top-right" richColors closeButton />

        <Routes>
          {/* Si no está logueado, cualquier ruta lo manda al Login */}
          {!isLoggedIn ? (
            <Route
              path="*"
              element={<Login onLoginSuccess={() => setIsLoggedIn(true)} />}
            />
          ) : (
            <>
              <Route
                path="/dashboard"
                element={<Dashboard onLogout={handleLogout} />}
              />
              <Route
                path="/history"
                element={<History onLogout={handleLogout} />}
              />
              {/* Ruta por dedecto: Dashboard */}
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </>
          )}
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
