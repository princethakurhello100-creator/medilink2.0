// ============================================================
// FILE: mobile/src/services/secureApiClient.js
// PURPOSE: React Native — Secure Token Storage & API Client
// OWASP Coverage: A02 Crypto Failures (secure token storage),
//                 A07 Auth Failures
// ============================================================

import * as SecureStore from "expo-secure-store";
// expo-secure-store uses:
//   iOS  → Keychain Services (hardware-backed on modern devices)
//   Android → Android Keystore System (TEE/hardware-backed)
// This is OWASP-compliant token storage — never use AsyncStorage for auth tokens

import axios from "axios";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

// Base URL injected at build time via environment — not hardcoded
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const TOKEN_KEYS = {
  ACCESS: "access_token",
  REFRESH: "refresh_token",
};

// expo-secure-store options
const SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  // Tokens are NOT backed up to iCloud/Android Backup
  // They must re-authenticate on new devices
};


// ─────────────────────────────────────────────
// SECURE TOKEN MANAGER
// ─────────────────────────────────────────────

export const TokenManager = {
  async saveTokens({ accessToken, refreshToken }) {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEYS.ACCESS, accessToken, SECURE_STORE_OPTIONS),
      SecureStore.setItemAsync(TOKEN_KEYS.REFRESH, refreshToken, SECURE_STORE_OPTIONS),
    ]);
  },

  async getAccessToken() {
    return SecureStore.getItemAsync(TOKEN_KEYS.ACCESS, SECURE_STORE_OPTIONS);
  },

  async getRefreshToken() {
    return SecureStore.getItemAsync(TOKEN_KEYS.REFRESH, SECURE_STORE_OPTIONS);
  },

  async clearTokens() {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEYS.ACCESS, SECURE_STORE_OPTIONS),
      SecureStore.deleteItemAsync(TOKEN_KEYS.REFRESH, SECURE_STORE_OPTIONS),
    ]);
  },
};


// ─────────────────────────────────────────────
// AXIOS INSTANCE — Secure Configuration
// ─────────────────────────────────────────────

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10s
  headers: {
    "Content-Type": "application/json",
    // No API keys in headers — auth via JWT only
  },
  // Certificate pinning in React Native is handled via
  // native modules (e.g., react-native-ssl-pinning)
  // Add in production for high-security deployments
});


// ─────────────────────────────────────────────
// REQUEST INTERCEPTOR — Attach JWT
// ─────────────────────────────────────────────

apiClient.interceptors.request.use(
  async (config) => {
    const token = await TokenManager.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);


// ─────────────────────────────────────────────
// RESPONSE INTERCEPTOR — Auto Token Refresh
// ─────────────────────────────────────────────

let isRefreshing = false;
let pendingQueue = [];

const processPendingQueue = (error, token = null) => {
  pendingQueue.forEach((prom) => {
    error ? prom.reject(error) : prom.resolve(token);
  });
  pendingQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && error.response?.data?.code === "TOKEN_EXPIRED"
        && !originalRequest._retry) {

      if (isRefreshing) {
        // Queue request while refresh is in progress
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await TokenManager.getRefreshToken();
        if (!refreshToken) throw new Error("No refresh token");

        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        await TokenManager.saveTokens(data);
        processPendingQueue(null, data.accessToken);

        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processPendingQueue(refreshError, null);
        await TokenManager.clearTokens();
        // Navigate to login — emit event or use navigation ref
        // navigationRef.current?.navigate("Login");
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);


// ─────────────────────────────────────────────
// API METHODS
// ─────────────────────────────────────────────

export const MedicineAPI = {
  search: (query, options = {}) =>
    apiClient.get("/medicines/search", {
      params: {
        q: query,
        category: options.category,
        page: options.page || 1,
        limit: options.limit || 20,
      },
    }),
};

export const PrescriptionAPI = {
  upload: (fileUri, mimeType) => {
    const formData = new FormData();
    formData.append("prescription", {
      uri: fileUri,
      type: mimeType,
      // NEVER use the original filename — generate a safe one
      name: `prescription.${mimeType === "application/pdf" ? "pdf" : "jpg"}`,
    });
    return apiClient.post("/prescriptions/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

export const NavigationAPI = {
  getNearestStores: (lat, lng, radiusKm = 5) =>
    apiClient.get("/navigation/stores/nearest", {
      params: { lat, lng, radius: radiusKm },
    }),

  getDirections: (originLat, originLng, destLat, destLng, mode = "driving") =>
    apiClient.get("/navigation/directions", {
      params: { originLat, originLng, destLat, destLng, mode },
    }),
};

export default apiClient;
