import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('erp_access_token');
    if (token) {
      api.get('/auth/me')
        .then(({ data }) => setUser(data.data.user))
        .catch(() => {
          localStorage.removeItem('erp_access_token');
          localStorage.removeItem('erp_refresh_token');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email, password, role) => {
    const { data } = await api.post('/auth/login', { email, password, role });
    localStorage.setItem('erp_access_token', data.data.accessToken);
    localStorage.setItem('erp_refresh_token', data.data.refreshToken);
    setUser(data.data.user);
    return data.data.user;
  };

  const logout = () => {
    localStorage.removeItem('erp_access_token');
    localStorage.removeItem('erp_refresh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
