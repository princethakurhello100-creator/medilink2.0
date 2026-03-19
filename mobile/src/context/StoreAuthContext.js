import React, { createContext, useContext, useState, useEffect } from "react";
import apiClient from "../services/apiClient";
import { ENDPOINTS } from "../services/config";

const StoreAuthContext = createContext(null);

export const StoreAuthProvider = ({ children }) => {
  const [storeAdmin, setStoreAdmin] = useState(null);
  const [storeLoading, setStoreLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const token = localStorage.getItem("store_access_token");
        if (token) {
          const payload = JSON.parse(atob(token.split(".")[1]));
          if (
            (payload.role === "pharmacist" || payload.role === "admin") &&
            payload.exp * 1000 > Date.now()
          ) {
            setStoreAdmin({ loggedIn: true, role: payload.role, id: payload.sub });
          } else {
            localStorage.removeItem("store_access_token");
            localStorage.removeItem("store_refresh_token");
          }
        }
      } catch {}
      setStoreLoading(false);
    };
    check();
  }, []);

  const storeLogin = async (email, password) => {
   const { data } = await apiClient.post(ENDPOINTS.LOGIN, { email, password, loginType: "store" });
    const payload = JSON.parse(atob(data.accessToken.split(".")[1]));
    if (payload.role !== "pharmacist" && payload.role !== "admin") {
      throw { response: { data: { error: "This is not a store admin account. Please use the regular user login." } } };
    }
    localStorage.setItem("store_access_token", data.accessToken);
    localStorage.setItem("store_refresh_token", data.refreshToken);
    setStoreAdmin({ loggedIn: true, role: payload.role, id: payload.sub });
    return data;
  };

  const storeLogout = async () => {
    try { await apiClient.post(ENDPOINTS.LOGOUT); } catch {}
    localStorage.removeItem("store_access_token");
    localStorage.removeItem("store_refresh_token");
    setStoreAdmin(null);
  };

  const getStoreToken = () => localStorage.getItem("store_access_token");

  return (
    <StoreAuthContext.Provider value={{ storeAdmin, storeLoading, storeLogin, storeLogout, getStoreToken }}>
      {children}
    </StoreAuthContext.Provider>
  );
};

export const useStoreAuth = () => useContext(StoreAuthContext);