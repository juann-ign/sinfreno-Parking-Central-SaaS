import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8000/api/v1', // La URL de tu FastAPI
});

// Este "interceptor" pega el Token JWT en cada pedido automáticamente
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;