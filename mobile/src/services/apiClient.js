import axios from "axios";
import { Platform } from "react-native";
import { API_BASE_URL } from "./config";

const isWeb = Platform.OS === "web";

const webStorage = {
  async setItem(key, value) { localStorage.setItem(key, value); },
  async getItem(key) { return localStorage.getItem(key); },
  async deleteItem(key) { localStorage.removeItem(key); },
};

const mobileStorage = {
  async setItem(key, value) {
    const SecureStore = require("expo-secure-store");
    await SecureStore.setItemAsync(key, value);
  },
  async getItem(key) {
    const SecureStore = require("expo-secure-store");
    return await SecureStore.getItemAsync(key);
  },
  async deleteItem(key) {
    const SecureStore = require("expo-secure-store");
    await SecureStore.deleteItemAsync(key);
  },
};

const storage = isWeb ? webStorage : mobileStorage;

export const TokenManager = {
  async saveTokens({ accessToken, refreshToken }) {
    await storage.setItem("access_token", accessToken);
    await storage.setItem("refresh_token", refreshToken);
  },
  async getAccessToken() {
    try { return await storage.getItem("access_token"); } catch { return null; }
  },
  async getRefreshToken() {
    try { return await storage.getItem("refresh_token"); } catch { return null; }
  },
  async clearTokens() {
    await storage.deleteItem("access_token");
    await storage.deleteItem("refresh_token");
  },
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await TokenManager.getAccessToken();
  if (token) config.headers.Authorization = "Bearer " + token;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 &&
        error.response?.data?.code === "TOKEN_EXPIRED" &&
        !error.config._retry) {
      error.config._retry = true;
      try {
        const refreshToken = await TokenManager.getRefreshToken();
        const { data } = await axios.post(API_BASE_URL + "/api/v1/auth/refresh", { refreshToken });
        await TokenManager.saveTokens(data);
        error.config.headers.Authorization = "Bearer " + data.accessToken;
        return apiClient(error.config);
      } catch {
        await TokenManager.clearTokens();
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;