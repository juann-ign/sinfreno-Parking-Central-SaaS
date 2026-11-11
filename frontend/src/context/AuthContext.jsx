import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AuthContext } from "./auth-context.js";
import api from "../../api/axios.js";
import { clearSession, SESSION_ENDED_EVENT } from "../../api/session.js";
import { createSessionController } from "../../api/session-controller.js";

export const AuthProvider = ({ children }) => {
  const [controller] = useState(() =>
    createSessionController({
      storage: localStorage,
      requestProfile: (token, signal) =>
        api
          .get("/auth/me", { signal, sessionToken: token, timeout: 12000 })
          .then(({ data }) => data),
      onInvalid: clearSession,
    }),
  );
  const {
    user,
    status: sessionStatus,
    error: sessionError,
  } = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const login = useCallback(
    (userData, expectedToken) => controller.login(userData, expectedToken),
    [controller],
  );
  const retrySession = useCallback(() => controller.restore(), [controller]);

  const logout = useCallback(() => {
    clearSession();
    window.location.href = "/";
  }, []);

  useEffect(() => {
    const endSession = controller.end;
    const storageChanged = (event) => {
      if (event.storageArea !== localStorage) return;
      if (
        (event.key === "token" && event.newValue === null) ||
        (event.key === null && !localStorage.getItem("token"))
      ) {
        clearSession();
      } else if (event.key === "token") {
        window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
        controller.requireVerification(
          "La cuenta cambió en otra pestaña. Verificá la sesión antes de continuar; para cuentas simultáneas usá perfiles independientes.",
        );
      }
    };
    window.addEventListener(SESSION_ENDED_EVENT, endSession);
    window.addEventListener("storage", storageChanged);
    controller.restore();
    return () => {
      controller.cancel();
      window.removeEventListener(SESSION_ENDED_EVENT, endSession);
      window.removeEventListener("storage", storageChanged);
    };
  }, [controller]);

  const hasPermission = useCallback(
    (permission) => {
      if (!user) return false;

      return Array.isArray(user.permisos) && user.permisos.includes(permission);
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        checkingSession: sessionStatus === "checking",
        sessionStatus,
        sessionError,
        retrySession,
        login,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
