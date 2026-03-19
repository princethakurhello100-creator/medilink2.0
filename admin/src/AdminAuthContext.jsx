import { createContext, useContext, useState, useEffect } from 'react';
import API from './adminApi';

const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role === 'admin' && payload.exp * 1000 > Date.now()) {
          setAdmin({ id: payload.sub, role: payload.role, token });
        } else {
          localStorage.removeItem('admin_token');
        }
      } catch { localStorage.removeItem('admin_token'); }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await API.post('/auth/login', { email, password,loginType: "admin"});
    const payload = JSON.parse(atob(data.accessToken.split('.')[1]));
    if (payload.role !== 'admin') throw new Error('Not an admin account');
    localStorage.setItem('admin_token', data.accessToken);
    setAdmin({ id: payload.sub, role: payload.role, token: data.accessToken });
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => useContext(AdminAuthContext);