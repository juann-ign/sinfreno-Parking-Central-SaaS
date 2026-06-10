import React, { createContext, useState, useContext, useEffect } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user_info");
    if (!savedUser || savedUser === "undefined") return null;
    try {
      return JSON.parse(savedUser);
    } catch (e) {
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

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.rol === "ADMIN") return true;
    return user.permisos?.includes(permission) || false;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
