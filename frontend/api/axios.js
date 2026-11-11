import axios from "axios";
import { apiBaseUrl } from "../config/connections.js";
import { clearSession } from "./session.js";
import { isCurrentSessionFailure } from "./session-controller.js";

const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use((config) => {
  const token = config.sessionToken !== undefined ? config.sessionToken : localStorage.getItem("token");
  config.sessionToken = token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isCurrentSessionFailure(error, localStorage.getItem("token"))) {
      clearSession();
      // Solo redirigir si no estamos ya en el login
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
