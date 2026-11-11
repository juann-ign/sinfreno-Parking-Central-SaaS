import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import History from "../pages/History";
import Settings from "../pages/Settings";
import CashHistory from "../pages/CashHistory";
import Users from "../pages/Users";
import SuperAdmin from "../pages/SuperAdmin";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext.jsx";
import { useAuth } from "./context/useAuth";

// Este componente decide qué ver según si el usuario está logueado
const AccessGate = ({ allowed, children }) => allowed ? children : (
  <main className="p-8 text-center">
    <p>No tenés permiso para acceder a esta pantalla.</p>
    <Link to="/" className="text-indigo-600 underline">Volver al inicio</Link>
  </main>
);

const RootNavigation = () => {
  const { user, checkingSession, logout, hasPermission } = useAuth();

  if (checkingSession) return <p role="status" className="p-8 text-center">Verificando sesión…</p>;

  if (!user) {
    return <Login onLoginSuccess={() => console.log("Logueado!")} />;
  }
  const isAdmin = user.rol === "ADMIN";
  const canOperate = Boolean(user.sucursal) && ["ingreso", "salida", "ver_ocupacion", "ver_stats", "ver_historial"].some(hasPermission);

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
      <Route path="/dashboard" element={<AccessGate allowed={canOperate}><Dashboard onLogout={logout} /></AccessGate>} />
      <Route path="/history" element={<AccessGate allowed={hasPermission("ver_historial")}><History /></AccessGate>} />
      <Route path="/settings" element={<AccessGate allowed={hasPermission("config_sucursal")}><Settings /></AccessGate>} />
      <Route path="/cash-history" element={<AccessGate allowed={isAdmin}><CashHistory /></AccessGate>} />
      <Route path="/users" element={<AccessGate allowed={isAdmin}><Users /></AccessGate>} />
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
