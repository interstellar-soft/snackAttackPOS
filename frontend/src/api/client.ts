import axios from "axios";
import { authStore } from "../store/auth-store";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:5243/api",
  withCredentials: true
});

api.interceptors.request.use((config) => {
  const token = authStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await authStore.getState().refresh();
        return api(originalRequest);
      } catch (refreshError) {
        authStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
