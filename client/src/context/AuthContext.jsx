import { createContext, useContext, useState, useEffect, useRef } from 'react';
import api, { setToken } from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [username, setUsername] = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const scheduleRefresh = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Refresh 1 min before the 15-min access token expires
    timerRef.current = setTimeout(silentRefresh, 14 * 60 * 1000);
  };

  const silentRefresh = async () => {
    try {
      const { data } = await api.post('/auth/refresh');
      setToken(data.accessToken);
      setUsername(data.username);
      scheduleRefresh();
      return true;
    } catch {
      setToken(null);
      setUsername(null);
      return false;
    }
  };

  useEffect(() => {
    silentRefresh().finally(() => setLoading(false));
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const login = async (uname, password) => {
    const { data } = await api.post('/auth/login', { username: uname, password });
    setToken(data.accessToken);
    setUsername(data.username);
    scheduleRefresh();
  };

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    setToken(null);
    setUsername(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return (
    <AuthContext.Provider value={{ username, loading, login, logout, isAuth: !!username }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
