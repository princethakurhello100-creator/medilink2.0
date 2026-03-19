import React, { createContext, useContext, useState, useEffect } from "react";
import apiClient, { TokenManager } from "../services/apiClient";
import { ENDPOINTS } from "../services/config";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await TokenManager.getAccessToken();
        if (token) {
          const payload = JSON.parse(atob(token.split(".")[1]));
          const isExpired = payload.exp * 1000 < Date.now();
          if (!isExpired) {
            setUser({ loggedIn: true, role: payload.role, id: payload.sub });
          } else {
            await TokenManager.clearTokens();
          }
        }
      } catch { await TokenManager.clearTokens(); }
      setLoading(false);
    };
    checkToken();
  }, []);

  const login = async (email, password) => {
   const { data } = await apiClient.post(ENDPOINTS.LOGIN, { email, password, loginType: "user" });
    await TokenManager.saveTokens(data);
    const payload = JSON.parse(atob(data.accessToken.split(".")[1]));
    setUser({ loggedIn: true, role: payload.role, id: payload.sub });
    return data;
  };

  const register = async (email, password) => {
    const { data } = await apiClient.post(ENDPOINTS.REGISTER, { email, password });
    await TokenManager.saveTokens(data);
    const payload = JSON.parse(atob(data.accessToken.split(".")[1]));
    setUser({ loggedIn: true, role: payload.role, id: payload.sub });
    return data;
  };

  const logout = async () => {
    try { await apiClient.post(ENDPOINTS.LOGOUT); } catch {}
    await TokenManager.clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);