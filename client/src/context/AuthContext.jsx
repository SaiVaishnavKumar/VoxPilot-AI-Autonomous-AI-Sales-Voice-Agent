import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState({
    ai: { mode: 'demo', provider: 'Loading...' },
    database: { engine: 'sqlite', details: '' },
  });

  const refreshSystemStatus = async () => {
    try {
      const h = await api.health();
      setSystemStatus({ ai: h.ai, database: h.database, company: h.company });
    } catch {
      // Keep fallback status if server offline
    }
  };

  useEffect(() => {
    const init = async () => {
      await refreshSystemStatus();
      const token = localStorage.getItem('voxpilot_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.me();
        setUser(res.user);
      } catch {
        localStorage.removeItem('voxpilot_token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (email, password) => {
    const res = await api.login({ email, password });
    localStorage.setItem('voxpilot_token', res.token);
    setUser(res.user);
    await refreshSystemStatus();
    return res.user;
  };

  const register = async (name, email, password, company) => {
    const res = await api.register({ name, email, password, company });
    localStorage.setItem('voxpilot_token', res.token);
    setUser(res.user);
    await refreshSystemStatus();
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('voxpilot_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        systemStatus,
        refreshSystemStatus,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
