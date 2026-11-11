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
const AccessGate = ({ allowed, children }) => {
  const { logout } = useAuth();
  if (allowed) return children;
  return (
    <main className="session-recovery">
      <h1>Acceso no disponible</h1>
      <p>
        No tenés permiso para acceder a esta pantalla. Podés volver al inicio o
        cerrar la sesión para usar otra cuenta.
      </p>
      <Link to="/" className="sf-button">
        Volver al inicio
      </Link>
      <button className="sf-button" onClick={logout}>
        Cerrar sesión
      </button>
    </main>
  );
};

const RootNavigation = () => {
  const {
    user,
    checkingSession,
    sessionStatus,
    sessionError,
    retrySession,
    logout,
    hasPermission,
  } = useAuth();

  if (checkingSession)
    return (
      <p role="status" className="p-8 text-center">
        Verificando sesión…
      </p>
    );
  if (sessionStatus === "unavailable")
    return (
      <main className="session-recovery">
        <h1>Verificación de sesión pendiente</h1>
        <p role="alert">{sessionError}</p>
        <button className="sf-button sf-primary" onClick={retrySession}>
          Reintentar verificación
        </button>
        <button className="sf-button" onClick={logout}>
          Cerrar sesión
        </button>
      </main>
    );

  if (!user) {
    return <Login />;
  }
  const isAdmin = user.rol === "ADMIN";
  const canOperate =
    Boolean(user.sucursal) &&
    ["ingreso", "salida", "ver_ocupacion", "ver_stats", "ver_historial"].some(
      hasPermission,
    );

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
      <Route
        path="/dashboard"
        element={
          <AccessGate allowed={canOperate}>
            <Dashboard
              key={`${user.email}/${user.sucursal?.id}/${user.rol}/${(user.permisos || []).join(",")}`}
              onLogout={logout}
            />
          </AccessGate>
        }
      />
      <Route
        path="/history"
        element={
          <AccessGate allowed={hasPermission("ver_historial")}>
            <History />
          </AccessGate>
        }
      />
      <Route
        path="/settings"
        element={
          <AccessGate allowed={hasPermission("config_sucursal")}>
            <Settings />
          </AccessGate>
        }
      />
      <Route
        path="/cash-history"
        element={
          <AccessGate allowed={isAdmin}>
            <CashHistory />
          </AccessGate>
        }
      />
      <Route
        path="/users"
        element={
          <AccessGate allowed={isAdmin}>
            <Users />
          </AccessGate>
        }
      />
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
