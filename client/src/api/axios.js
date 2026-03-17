import axios from 'axios';

// Access token lives in module scope (in-memory, not localStorage)
let _token = null;

export const setToken = (t) => { _token = t; };
export const getToken = () => _token;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true, // send httpOnly refresh cookie automatically
});

api.interceptors.request.use((config) => {
  if (_token) config.headers.Authorization = `Bearer ${_token}`;
  return config;
});

export default api;
