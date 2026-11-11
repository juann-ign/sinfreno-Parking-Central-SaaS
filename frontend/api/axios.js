import axios from "axios";
import { apiBaseUrl } from "../config/connections.js";

const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    // IMPORTANTE: Verifica que sean BACKTICKS (tecla al lado de la P o la Ñ)
    // No comillas simples.
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user_info");
      // Solo redirigir si no estamos ya en el login
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
