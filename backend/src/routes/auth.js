const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");
const { User, AuditLog } = require("../models");
const { authLimiter } = require("../middleware/security");

const router = express.Router();

// Each portal maps to allowed roles
const PORTAL_ROLES = {
  user:    ["patient"],
  store:   ["pharmacist"],
  admin:   ["admin"],
};

function generateTokens(user) {
  const jti = crypto.randomUUID();
  const payload = { sub: user._id.toString(), role: user.role, jti };
  const secret = "dev_secret_change_in_production";
  const algorithm = "HS256";
  const accessToken = jwt.sign(payload, secret, {
    algorithm,
    expiresIn: process.env.JWT_ACCESS_EXPIRY || "2h",
    issuer: process.env.JWT_ISSUER || "medilink-api",
    audience: process.env.JWT_AUDIENCE || "medilink-client",
  });
  const refreshToken = jwt.sign({ sub: user._id.toString(), jti }, secret, {
    algorithm,
    expiresIn: process.env.JWT_REFRESH_EXPIRY || "7d",
    issuer: process.env.JWT_ISSUER || "medilink-api",
    audience: process.env.JWT_AUDIENCE || "medilink-client",
  });
  return { accessToken, refreshToken };
}

router.post("/register",
  [
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("password")
      .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
      .matches(/[A-Z]/).withMessage("Must contain uppercase letter")
      .matches(/[a-z]/).withMessage("Must contain lowercase letter")
      .matches(/[0-9]/).withMessage("Must contain a number"),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    try {
      const { email, password } = req.body;
      const existing = await User.findOne({ email }).lean();
      if (existing) return res.status(409).json({ error: "Email already registered" });
      const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
      const user = await User.create({ email, passwordHash, role: "patient" });
      const tokens = generateTokens(user);
      await AuditLog.create({
        actorId: user._id, action: "USER_REGISTER", ipAddress: req.ip,
        outcome: "success", metadata: { email, role: "patient" },
      });
      res.status(201).json({
        message: "Account created successfully",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        role: user.role,
      });
    } catch (err) { next(err); }
  }
);

router.post("/login",
  authLimiter,
  [
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("password").notEmpty().withMessage("Password required"),
    body("loginType").isIn(["user", "store", "admin"]).withMessage("Invalid login type"),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    try {
      const { email, password, loginType } = req.body;

      const user = await User.findOne({ email }).select("+passwordHash +failedLoginAttempts +lockedUntil");
      if (!user) {
        await AuditLog.create({
          action: "LOGIN_FAILED", ipAddress: req.ip, outcome: "failure",
          metadata: { email, reason: "User not found", loginType },
        });
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Check account lock
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        return res.status(403).json({ error: "Account locked. Try again later." });
      }

      // Validate password
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        const attempts = (user.failedLoginAttempts || 0) + 1;
        const update = { failedLoginAttempts: attempts };
        if (attempts >= 10) update.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await User.findByIdAndUpdate(user._id, update);
        await AuditLog.create({
          actorId: user._id, action: "LOGIN_FAILED", ipAddress: req.ip, outcome: "failure",
          metadata: { email, reason: "Wrong password", loginType },
        });
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // ── ROLE CHECK — strict portal separation ──────────────
      const allowedRoles = PORTAL_ROLES[loginType];
      if (!allowedRoles.includes(user.role)) {
        await AuditLog.create({
          actorId: user._id, action: "LOGIN_FAILED", ipAddress: req.ip, outcome: "failure",
          metadata: { email, reason: `Role '${user.role}' not allowed on '${loginType}' portal`, loginType },
        });

        // Give a clear but safe error message per portal
        if (loginType === "user") {
          return res.status(403).json({ error: "This account is not a user account. Please use the correct portal." });
        }
        if (loginType === "store") {
          return res.status(403).json({ error: "This account is not a store account. Please use the correct portal." });
        }
        if (loginType === "admin") {
          return res.status(403).json({ error: "Access denied. Admin credentials required." });
        }
      }

      // All good — reset failed attempts and login
      await User.findByIdAndUpdate(user._id, {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      });

      await AuditLog.create({
        actorId: user._id, action: "LOGIN_SUCCESS", ipAddress: req.ip, outcome: "success",
        metadata: { email, role: user.role, loginType },
      });

      const tokens = generateTokens(user);
      res.json({
        accessToken:  tokens.accessToken,
        refreshToken: tokens.refreshToken,
        role:         user.role,
      });
    } catch (err) { next(err); }
  }
);

router.post("/logout", async (req, res) => {
  res.json({ message: "Logged out successfully" });
});

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: "Refresh token required" });
    const decoded = jwt.verify(refreshToken, "dev_secret_change_in_production", { algorithms: ["HS256"] });
    const user = await User.findById(decoded.sub).select("_id role").lean();
    if (!user) return res.status(401).json({ error: "User not found" });
    const tokens = generateTokens(user);
    res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

module.exports = router;