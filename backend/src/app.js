require("dotenv-safe").config({ allowEmptyValues: true });

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const compression = require("compression");
const hpp = require("hpp");
const aiRouter = require("./routes/ai");
const stockOcrRouter = require("./routes/stockOcr");

const {
  securityHeaders,
  apiLimiter,
  sanitizeRequest,
  authenticateJWT,
} = require("./middleware/security");

const { medicineRouter, prescriptionRouter } = require("./routes");
const authRouter = require("./routes/auth");
const storeAdminRouter = require("./routes/storeAdmin");
const adminRouter = require("./routes/admin");
const {
  nearestStoresValidation,
  directionsValidation,
  getNearestStoresHandler,
  getDirectionsHandler,
} = require("./services/navigationService");

const app = express();

// 1. Trust proxy
app.set("trust proxy", 1);

// 2. Security headers
app.use(securityHeaders);

// 3. CORS
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);
if (process.env.NODE_ENV === "development") {
ALLOWED_ORIGINS.push("http://localhost:8081", "http://localhost:8082", "http://localhost:3002", "http://localhost:5173");
}
app.use(cors({
  origin: (origin, callback) => {
    if (!origin && process.env.NODE_ENV === "development") return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400,
}));

// 4. Body parsing
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

// 5. NoSQL injection sanitizer (OWASP A03)
app.use((req, res, next) => {
  try {
    if (req.body && typeof req.body === "object") {
      const sanitize = (obj, depth = 0) => {
        if (depth > 10) return obj;
        if (typeof obj !== "object" || obj === null) return obj;
        if (Array.isArray(obj)) return obj.map(i => sanitize(i, depth + 1));
        const result = {};
        for (const key of Object.keys(obj)) {
          if (key.startsWith("$")) continue;
          result[key] = sanitize(obj[key], depth + 1);
        }
        return result;
      };
      req.body = sanitize(req.body);
    }
  } catch (e) {
    console.warn("[SECURITY] Sanitizer error:", e.message);
  }
  next();
});

// 6. Request sanitizer
app.use(sanitizeRequest);

// 7. HTTP Parameter Pollution protection
app.use(hpp({ whitelist: ["dosageForms"] }));

// 8. Global rate limiter
app.use("/api/", apiLimiter);

// 9. Compression
app.use(compression());

// 10. Test route (dev only)
app.post("/api/v1/test", (req, res) => res.json({ received: req.body }));

// 11. Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/store-admin", storeAdminRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/medicines", medicineRouter);
app.use("/api/v1/ai", aiRouter);
app.use("/api/v1/prescriptions", prescriptionRouter);
app.use("/api/v1/stock-ocr", stockOcrRouter);

// 12. Navigation routes
app.get(
  "/api/v1/navigation/stores/nearest",
  authenticateJWT,
  nearestStoresValidation,
  getNearestStoresHandler
);
app.get(
  "/api/v1/navigation/directions",
  authenticateJWT,
  directionsValidation,
  getDirectionsHandler
);

// 13. Health check
app.get("/health", (_, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 14. 404 handler
app.use((_, res) => {
  res.status(404).json({ error: "Resource not found" });
});

// 15. Global error handler
app.use((err, req, res, _next) => {
  console.error("[ERROR]", {
    message: err.message,
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    path: req.path,
    ip: req.ip,
  });
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: process.env.NODE_ENV === "production"
      ? "An error occurred. Please try again."
      : err.message,
  });
});

// 16. Database + Server start
const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
  console.log("[DB] MongoDB connected");
};

const startServer = async () => {
  await connectDB();
  const PORT = parseInt(process.env.PORT) || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  });
};

startServer().catch((err) => {
  console.error("[FATAL] Server failed to start:", err.message);
  process.exit(1);
});

module.exports = app;