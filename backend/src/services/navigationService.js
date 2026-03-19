// ============================================================
// FILE: src/services/navigationService.js
// PURPOSE: Secure Nearest-Store Lookup + Route Calculation
// OWASP Coverage: A02 Crypto Failures (API key mgmt),
//                 A03 Injection (coordinate validation),
//                 A04 Insecure Design (server-side proxy)
// ============================================================

const axios = require("axios");

/**
 * SECURITY ARCHITECTURE FOR GOOGLE MAPS API:
 *
 * ┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
 * │  React      │────▶│  Our Backend     │────▶│  Google Maps    │
 * │  Native     │     │  (Secure Proxy)  │     │  API            │
 * │  Client     │◀────│                  │◀────│                 │
 * └─────────────┘     └──────────────────┘     └─────────────────┘
 *
 * The Google Maps API key is NEVER sent to the client.
 * All Maps API calls are proxied through our server.
 * This prevents:
 *   - API key theft from client-side code/network inspection
 *   - Unauthorized usage of our API quota
 *   - Key exposure in mobile app bundles
 */

// ─────────────────────────────────────────────
// SECURE MAPS CLIENT (server-side only)
// ─────────────────────────────────────────────

const MAPS_API_BASE = "https://maps.googleapis.com/maps/api";

// API key loaded from environment variable — NEVER hardcoded
// Rotate via: process.env.GOOGLE_MAPS_API_KEY
const getMapsApiKey = () => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY environment variable not set");
  return key;
};

// Axios instance — isolated config for Maps API
const mapsClient = axios.create({
  baseURL: MAPS_API_BASE,
  timeout: 8000, // 8s timeout — prevents hanging requests
  headers: {
    "User-Agent": "MedicalInventoryApp/1.0 (server-side proxy)",
  },
});

// Response interceptor — strip sensitive fields before passing data downstream
mapsClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Never propagate raw Google error (may contain API key in URL)
    const safeError = new Error("Navigation service unavailable");
    safeError.statusCode = 503;
    return Promise.reject(safeError);
  }
);


// ─────────────────────────────────────────────
// 1. COORDINATE VALIDATOR
//    Prevents injection via malformed geo inputs
// ─────────────────────────────────────────────

/**
 * Validates and sanitizes a coordinate pair.
 * Returns a clean {lat, lng} object or throws.
 */
const validateCoordinates = (lat, lng, label = "location") => {
  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);

  if (!isFinite(parsedLat) || !isFinite(parsedLng)) {
    throw new TypeError(`${label}: coordinates must be finite numbers`);
  }
  if (parsedLat < -90 || parsedLat > 90) {
    throw new RangeError(`${label}: latitude must be between -90 and 90`);
  }
  if (parsedLng < -180 || parsedLng > 180) {
    throw new RangeError(`${label}: longitude must be between -180 and 180`);
  }

  // Precision limit — prevents fingerprinting via hyper-precise coords
  return {
    lat: Math.round(parsedLat * 1_000_000) / 1_000_000, // 6 decimal places ≈ 11cm
    lng: Math.round(parsedLng * 1_000_000) / 1_000_000,
  };
};

/**
 * Formats a safe coordinate string for Google APIs.
 * Uses template literal with validated numbers — not raw user input.
 */
const toCoordString = ({ lat, lng }) => `${lat},${lng}`;


// ─────────────────────────────────────────────
// 2. FIND NEAREST STORES (MongoDB Geospatial)
//    Uses our own DB first — no external API needed
//    for store lookup
// ─────────────────────────────────────────────

const { Store } = require("../models");

/**
 * Finds the N nearest verified pharmacies to a given location.
 * Uses MongoDB $nearSphere — efficient, server-side, index-backed.
 *
 * @param {number} lat - User latitude
 * @param {number} lng - User longitude
 * @param {number} radiusKm - Search radius in km (max 50)
 * @param {number} limit - Max results (max 20)
 * @returns {Promise<Store[]>}
 */
const findNearestStores = async (lat, lng, radiusKm = 5, limit = 10) => {
  // Validate inputs
  const coords = validateCoordinates(lat, lng, "user location");

  // Enforce bounds — prevent abuse
  const safeRadius = Math.min(Math.max(Number(radiusKm) || 5, 0.1), 50);
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);

  const radiusMeters = safeRadius * 1000;

  // GeoJSON $nearSphere query — uses 2dsphere index
  // Parameters are validated numbers — not strings from user input
  const stores = await Store.find({
    isVerified: true,
    location: {
      $nearSphere: {
        $geometry: {
          type: "Point",
          coordinates: [coords.lng, coords.lat], // GeoJSON: [lng, lat]
        },
        $maxDistance: radiusMeters,
      },
    },
  })
    .limit(safeLimit)
    .select("name address phone location operatingHours")
    .lean();

  // Calculate and attach distance to each store (approximate)
  return stores.map((store) => ({
    ...store,
    distanceKm: haversineDistance(
      coords.lat, coords.lng,
      store.location.coordinates[1],
      store.location.coordinates[0]
    ).toFixed(2),
  }));
};


// ─────────────────────────────────────────────
// 3. HAVERSINE DISTANCE (no external API needed)
//    Accurate great-circle distance calculation
// ─────────────────────────────────────────────

const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth radius km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};


// ─────────────────────────────────────────────
// 4. GET DIRECTIONS (Google Directions API Proxy)
//    Server-side proxy — API key never leaves server
// ─────────────────────────────────────────────

const ALLOWED_TRAVEL_MODES = new Set(["driving", "walking", "transit", "bicycling"]);

/**
 * Fetches directions between two points via Google Directions API.
 * The API key is injected server-side; client never sees it.
 *
 * @param {Object} origin - { lat, lng }
 * @param {Object} destination - { lat, lng }
 * @param {string} mode - Travel mode
 * @returns {Promise<Object>} - Sanitized route data
 */
const getDirections = async (origin, destination, mode = "driving") => {
  // Validate all inputs before touching external API
  const safeOrigin = validateCoordinates(origin.lat, origin.lng, "origin");
  const safeDest = validateCoordinates(destination.lat, destination.lng, "destination");

  // Whitelist travel mode — prevents parameter injection
  if (!ALLOWED_TRAVEL_MODES.has(mode)) {
    throw new TypeError("Invalid travel mode");
  }

  const response = await mapsClient.get("/directions/json", {
    params: {
      // All parameters are validated — no raw user strings passed to API
      origin: toCoordString(safeOrigin),
      destination: toCoordString(safeDest),
      mode,
      key: getMapsApiKey(), // Injected server-side
      alternatives: false,
      units: "metric",
    },
  });

  const data = response.data;

  if (data.status !== "OK") {
    throw new Error("Directions unavailable for this route");
  }

  // ── Sanitize response — return only what the client needs ──
  // Never proxy the full Google response (may contain billing data, etc.)
  const route = data.routes[0];
  const leg = route.legs[0];

  return {
    distance: {
      text: leg.distance.text,
      meters: leg.distance.value,
    },
    duration: {
      text: leg.duration.text,
      seconds: leg.duration.value,
    },
    // Return encoded polyline only — client decodes for display
    polyline: route.overview_polyline.points,
    steps: leg.steps.map((step) => ({
      instruction: step.html_instructions.replace(/<[^>]*>/g, ""), // Strip HTML
      distance: step.distance.text,
      duration: step.duration.text,
      travelMode: step.travel_mode,
    })),
  };
};


// ─────────────────────────────────────────────
// 5. ROUTE CONTROLLER (Express Handler)
// ─────────────────────────────────────────────

const { query, validationResult } = require("express-validator");

const nearestStoresValidation = [
  query("lat").isFloat({ min: -90, max: 90 }).withMessage("Invalid latitude").toFloat(),
  query("lng").isFloat({ min: -180, max: 180 }).withMessage("Invalid longitude").toFloat(),
  query("radius").optional().isFloat({ min: 0.1, max: 50 }).withMessage("Radius must be 0.1–50 km").toFloat(),
  query("limit").optional().isInt({ min: 1, max: 20 }).withMessage("Limit must be 1–20").toInt(),
];

const directionsValidation = [
  query("originLat").isFloat({ min: -90, max: 90 }).toFloat(),
  query("originLng").isFloat({ min: -180, max: 180 }).toFloat(),
  query("destLat").isFloat({ min: -90, max: 90 }).toFloat(),
  query("destLng").isFloat({ min: -180, max: 180 }).toFloat(),
  query("mode")
    .optional()
    .isIn(["driving", "walking", "transit", "bicycling"])
    .withMessage("Invalid mode"),
];

const getNearestStoresHandler = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: "Invalid coordinates", details: errors.array() });
  }

  try {
    const { lat, lng, radius, limit } = req.query;
    const stores = await findNearestStores(lat, lng, radius, limit);
    res.json({ data: stores, count: stores.length });
  } catch (err) {
    next(err);
  }
};

const getDirectionsHandler = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: "Invalid route parameters", details: errors.array() });
  }

  try {
    const { originLat, originLng, destLat, destLng, mode } = req.query;
    const directions = await getDirections(
      { lat: originLat, lng: originLng },
      { lat: destLat, lng: destLng },
      mode
    );
    res.json({ data: directions });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  findNearestStores,
  getDirections,
  validateCoordinates,
  haversineDistance,
  nearestStoresValidation,
  directionsValidation,
  getNearestStoresHandler,
  getDirectionsHandler,
};
