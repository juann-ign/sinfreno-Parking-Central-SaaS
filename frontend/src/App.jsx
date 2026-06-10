import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import History from "../pages/History";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "sonner";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("token"));

  const handleLogin = () => setIsLoggedIn(true);
  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
  };

  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="font-sans antialiased text-gray-900">
          <Toaster
            position="top-right"
            richColors
            expand={false}
            duration={5000}
            visibleToasts={3}
          />

          <Routes>
            {/* Si no está logueado, cualquier ruta lo manda al Login */}
            {!isLoggedIn ? (
              <Route
                path="*"
                element={<Login onLoginSuccess={handleLogin} />}
              />
            ) : (
              <>
                <Route
                  path="/dashboard"
                  element={<Dashboard onLogout={handleLogout} />}
                />
                <Route path="/history" element={<History />} />
                {/* Ruta por dedecto: Dashboard */}
                <Route path="*" element={<Navigate to="/dashboard" />} />
              </>
            )}
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
