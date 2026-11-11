import { useCallback, useEffect, useState } from "react";
import { AuthContext } from "./auth-context.js";
import api from "../../api/axios.js";
import { clearSession, SESSION_ENDED_EVENT } from "../../api/session.js";

export const AuthProvider = ({ children }) => {
  const [checkingSession, setCheckingSession] = useState(() => Boolean(localStorage.getItem("token")));
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

  const login = useCallback((userData) => {
    setUser(userData);
    setCheckingSession(false);
    localStorage.setItem("user_info", JSON.stringify(userData));
  }, []);

  const logout = useCallback(() => {
    clearSession();
    window.location.href = "/";
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const endSession = () => {
      controller.abort();
      setUser(null);
      setCheckingSession(false);
    };
    const storageChanged = (event) => {
      if (event.storageArea !== localStorage) return;
      if ((event.key === "token" && event.newValue === null)
        || (event.key === null && !localStorage.getItem("token"))) {
        clearSession();
      }
    };
    window.addEventListener(SESSION_ENDED_EVENT, endSession);
    window.addEventListener("storage", storageChanged);
    if (localStorage.getItem("token")) {
      api.get("/auth/me", { signal: controller.signal })
        .then(({ data }) => {
          if (!controller.signal.aborted) login(data);
        })
        .catch(() => {
          if (!controller.signal.aborted) clearSession();
        });
    }
    return () => {
      controller.abort();
      window.removeEventListener(SESSION_ENDED_EVENT, endSession);
      window.removeEventListener("storage", storageChanged);
    };
  }, [login]);

  const hasPermission = useCallback((permission) => {
    if (!user) return false;

    return Array.isArray(user.permisos) && user.permisos.includes(permission);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, checkingSession, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};
