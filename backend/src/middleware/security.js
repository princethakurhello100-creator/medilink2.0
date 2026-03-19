const jwt = require('jsonwebtoken');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const helmet = require('helmet');
const { User } = require('../models');

const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://maps.googleapis.com'],
      connectSrc: ["'self'", 'https://maps.googleapis.com'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
  noSniff: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req),
  handler: (req, res) => res.status(429).json({ error: 'Too many requests' }),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => res.status(429).json({ error: 'Too many login attempts' }),
});

const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: 'Too many search requests' }),
});

const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.slice(7);
    const secret = process.env.JWT_PUBLIC_KEY && process.env.JWT_PUBLIC_KEY !== 'placeholder'
      ? process.env.JWT_PUBLIC_KEY
      : 'dev_secret_change_in_production';
    const algorithms = process.env.JWT_PUBLIC_KEY && process.env.JWT_PUBLIC_KEY !== 'placeholder'
      ? ['RS256'] : ['HS256'];
    const decoded = jwt.verify(token, secret, {
      algorithms,
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    });
    if (!decoded.sub || !decoded.role || !decoded.jti) {
      return res.status(401).json({ error: 'Invalid token structure' });
    }
    const user = await User.findById(decoded.sub).select('_id role lockedUntil storeId').lean();
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(403).json({ error: 'Account locked' });
    }
    req.user = { id: decoded.sub, role: decoded.role, jti: decoded.jti, storeId: user.storeId };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    if (err.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Invalid token' });
    next(err);
  }
};

const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
  next();
};

const stripMongoOperators = (obj, depth = 0) => {
  if (depth > 10) return obj;
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(i => stripMongoOperators(i, depth + 1));
  const result = {};
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$')) continue;
    result[key] = stripMongoOperators(obj[key], depth + 1);
  }
  return result;
};

const sanitizeRequest = (req, _, next) => {
  try {
    if (req.body) req.body = stripMongoOperators(req.body);
    if (req.params) req.params = stripMongoOperators(req.params);
  } catch {}
  next();
};

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: 'Too many uploads, please try again later' }),
});

module.exports = {
  securityHeaders,
  apiLimiter,
  authLimiter,
  searchLimiter,
  authenticateJWT,
  requireRole,
  sanitizeRequest,
  uploadLimiter,
};
