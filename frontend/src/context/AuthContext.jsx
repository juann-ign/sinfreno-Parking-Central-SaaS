import { useCallback, useState } from "react";
import { AuthContext } from "./auth-context.js";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user_info");
    const token = localStorage.getItem("token");

    // Si falta cualquiera de los dos, no está logueado
    if (!savedUser || !token || savedUser === "undefined") return null;

    try {
      return JSON.parse(savedUser);
    } catch {
      return null;
    }
  });

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem("user_info", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user_info");
    window.location.href = "/";
  };

  const hasPermission = useCallback((permission) => {
    if (!user) return false;

    const rolSuperior = user.rol?.toUpperCase();
    if (rolSuperior === "ADMIN") return true;

    // Usamos .map(p => p.trim()) para limpiar CUALQUIER espacio rebelde
    const permisosLimpios = user.permisos?.map((p) => p.trim()) || [];

    return permisosLimpios.includes(permission);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};
