import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login"; // Asegurate que sea minúscula si el archivo es login.jsx
import Dashboard from "../pages/Dashboard";
import History from "../pages/History";
import Settings from "../pages/Settings";
import CashHistory from "../pages/CashHistory";
import Users from "../pages/Users";
import SuperAdmin from "../pages/SuperAdmin";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Este componente decide qué ver según si el usuario está logueado
const RootNavigation = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return <Login onLoginSuccess={() => console.log("Logueado!")} />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          user.rol === "SUPERADMIN" ? (
            <Navigate to="/superadmin" />
          ) : (
            <Navigate to="/dashboard" />
          )
        }
      />
      <Route path="/dashboard" element={<Dashboard onLogout={logout} />} />
      <Route path="/history" element={<History />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/cash-history" element={<CashHistory />} />
      <Route path="/users" element={<Users />} />
      <Route
        path="/superadmin"
        element={
          user?.rol === "SUPERADMIN" ? (
            <SuperAdmin />
          ) : (
            <Navigate to="/dashboard" />
          )
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="font-sans antialiased text-gray-900">
          <Toaster
            position="top-right"
            toastOptions={{
              style: { padding: "12px 16px" }, // controlás vos el padding
            }}
          />
          <RootNavigation />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
