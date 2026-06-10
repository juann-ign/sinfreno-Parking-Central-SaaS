import React, { createContext, useState, useContext, useEffect } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Cargamos el usuario desde el localStorage si existe
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user_info");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem("user_info", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user_info");
  };

  // FUNCIÓN CLAVE: Chequea si el usuario tiene un permiso específico
  const hasPermission = (permission) => {
    if (!user || !user.permisos) return false;
    // Si es ADMIN, tiene permiso total (atajo)
    if (user.rol === "ADMIN") return true;
    return user.permisos.includes(permission);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook para usar el contexto fácilmente
export const useAuth = () => useContext(AuthContext);
