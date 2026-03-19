export const API_BASE_URL = "http://localhost:3000";

export const ENDPOINTS = {
  LOGIN:            "/api/v1/auth/login",
  REGISTER:         "/api/v1/auth/register",
  REFRESH:          "/api/v1/auth/refresh",
  LOGOUT:           "/api/v1/auth/logout",
  SEARCH:           "/api/v1/medicines/search",
  UPLOAD:           "/api/v1/prescriptions/upload",
  LIST:             "/api/v1/prescriptions",
  NEAREST_STORES:   "/api/v1/navigation/stores/nearest",
  DIRECTIONS:       "/api/v1/navigation/directions",
  HEALTH:           "/health",
  STORE_REGISTER:   "/api/v1/store-admin/register",
  STORE_MY_STORE:   "/api/v1/store-admin/my-store",
  STORE_MEDICINES:  "/api/v1/store-admin/medicines",
  STORE_INVENTORY:  "/api/v1/store-admin/inventory",
  AI_CHAT: '/api/v1/ai/chat',
 STOCK_OCR_SCAN:    "/api/v1/stock-ocr/scan",
STOCK_OCR_CONFIRM: "/api/v1/stock-ocr/confirm",
};