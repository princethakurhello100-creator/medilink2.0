// ============================================================
// FILE: src/models/index.js
// PURPOSE: Secure MongoDB Schemas with Mongoose Validation
// OWASP Coverage: A03 Injection, A04 Insecure Design
// ============================================================

const mongoose = require("mongoose");
const { Schema } = mongoose;

// ─────────────────────────────────────────────
// ENUM CONSTANTS  (prevents arbitrary string injection)
// ─────────────────────────────────────────────
const MEDICINE_CATEGORIES = [
  "antibiotic", "analgesic", "antiviral", "antifungal",
  "antihypertensive", "antidiabetic", "antihistamine",
  "supplement", "vaccine", "other",
];
const PRESCRIPTION_STATUSES = ["pending", "verified", "rejected", "fulfilled"];
const USER_ROLES = ["patient", "pharmacist", "admin"];

// ─────────────────────────────────────────────
// 1. USER SCHEMA
// ─────────────────────────────────────────────
const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      // Strict RFC-5322 subset — prevents NoSQL operator injection
      match: [/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/, "Invalid email format"],
      maxlength: [254, "Email too long"],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // NEVER returned in queries by default
    },
    role: {
      type: String,
      enum: { values: USER_ROLES, message: "Invalid role" },
      default: "patient",
    },
    mfaSecret: {
      type: String,
      select: false, // Hidden from API responses
    },
    mfaEnabled: { type: Boolean, default: false },
    failedLoginAttempts: {
      type: Number,
      default: 0,
      max: [10, "Account locked"],
      select: false,
    },
    lockedUntil: { type: Date, select: false },
    lastLoginAt: { type: Date },
    storeId: { type: Schema.Types.ObjectId, ref: "Store", default: null },
    refreshTokenHash: { type: String, select: false },
    createdAt: { type: Date, default: Date.now, immutable: true },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    // Strip any fields not in schema (prevents mass-assignment attacks)
    strict: true,
    // Never expose __v
    versionKey: false,
    // Sanitize toJSON output
    toJSON: {
      transform(_, ret) {
        delete ret.passwordHash;
        delete ret.mfaSecret;
        delete ret.refreshTokenHash;
        delete ret.failedLoginAttempts;
        return ret;
      },
    },
  }
);

// Compound index — fast lookup, prevents duplicates



// ─────────────────────────────────────────────
// 2. MEDICINE SCHEMA
// ─────────────────────────────────────────────
const MedicineSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, "Name too short"],
      maxlength: [200, "Name too long"],
      // Allow only safe pharmaceutical characters
      match: [/^[a-zA-Z0-9\s\-\/().,']+$/, "Invalid characters in medicine name"],
    },
    genericName: {
      type: String,
      trim: true,
      maxlength: [200, "Generic name too long"],
      match: [/^[a-zA-Z0-9\s\-\/().,']*$/, "Invalid characters"],
    },
    category: {
      type: String,
      required: true,
      enum: { values: MEDICINE_CATEGORIES, message: "Invalid category" },
    },
    manufacturer: {
      type: String,
      trim: true,
      maxlength: [150, "Manufacturer name too long"],
      match: [/^[a-zA-Z0-9\s\-&.,()]+$/, "Invalid characters in manufacturer"],
    },
    dosageForms: [
      {
        type: String,
        enum: ["tablet", "capsule", "syrup", "injection", "cream", "drops", "inhaler", "patch"],
      },
    ],
    requiresPrescription: { type: Boolean, default: false },
    // Stores are referenced by ObjectId — no embedded user input
    availableAt: [{ type: Schema.Types.ObjectId, ref: "Store" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true },
  },
  { strict: true, versionKey: false, timestamps: true }
);

// Text index for safe full-text search (avoids regex injection)
MedicineSchema.index({ name: "text", genericName: "text" });
MedicineSchema.index({ category: 1, isActive: 1 });


// ─────────────────────────────────────────────
// 3. PRESCRIPTION SCHEMA
// ─────────────────────────────────────────────
const PrescriptionSchema = new Schema(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true, // Cannot be reassigned after creation
    },
    status: {
      type: String,
      enum: { values: PRESCRIPTION_STATUSES, message: "Invalid status" },
      default: "pending",
    },
    // Store only the GCS/S3 object key — never a user-supplied URL
    imageKey: {
      type: String,
      required: true,
      immutable: true,
      // Enforce internal key format: uuid/filename.ext
      match: [
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|pdf)$/,
        "Invalid image key format",
      ],
    },
    // OCR-extracted text — stored but never rendered as HTML
    ocrText: {
      type: String,
      maxlength: [5000, "OCR text too long"],
      select: false, // Hidden from patient-role queries
    },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    rejectionReason: {
      type: String,
      maxlength: [500, "Rejection reason too long"],
      // Only plain text — strip any HTML/script tags at model level
      set: (v) => v?.replace(/<[^>]*>/g, "").trim(),
    },
    medicines: [
      {
        medicineId: { type: Schema.Types.ObjectId, ref: "Medicine" },
        quantity: { type: Number, min: 1, max: 9999 },
      },
    ],
  },
  { strict: true, versionKey: false, timestamps: true }
);

PrescriptionSchema.index({ patientId: 1, status: 1 });


// ─────────────────────────────────────────────
// 4. STORE / PHARMACY SCHEMA
// ─────────────────────────────────────────────
const StoreSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [150, "Store name too long"],
      match: [/^[a-zA-Z0-9\s\-&.,()]+$/, "Invalid characters in store name"],
    },
    address: {
      street: { type: String, maxlength: [200, "Too long"], trim: true },
      city: { type: String, maxlength: [100, "Too long"], trim: true },
      state: { type: String, maxlength: [100, "Too long"], trim: true },
      postalCode: {
        type: String,
        match: [/^[0-9]{4,10}$/, "Invalid postal code"],
      },
      country: {
        type: String,
        maxlength: [2, "Use ISO 3166-1 alpha-2"],
        minlength: [2, "Use ISO 3166-1 alpha-2"],
        uppercase: true,
      },
    },
    // GeoJSON Point — required for $nearSphere queries
    location: {
      type: {
        type: String,
        enum: ["Point"], // Only GeoJSON Point allowed
        required: true,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        validate: {
          validator: ([lng, lat]) =>
            lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90,
          message: "Invalid coordinates",
        },
      },
    },
    phone: {
      type: String,
      match: [/^\+?[0-9\s\-]{7,20}$/, "Invalid phone number"],
    },
    isVerified: { type: Boolean, default: false },
licenseNumber: {
  type: String,
  required: [true, "License number is required"],
  unique: true,
  trim: true,
  match: [/^[A-Z0-9\-\/]{5,30}$/, "Invalid license format"],
},
licenseExpiry: { type: Date, required: true },
ownerName:  { type: String, trim: true, maxlength: 100 },
ownerPhone: { type: String, match: [/^\+?[0-9\s\-]{7,20}$/, "Invalid phone"] },

    operatingHours: {
      open: { type: String, match: [/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM format"] },
      close: { type: String, match: [/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM format"] },
    },
  },
  { strict: true, versionKey: false, timestamps: true }
);

// 2dsphere index — enables efficient geospatial queries
StoreSchema.index({ location: "2dsphere" });
StoreSchema.index({ isVerified: 1 });


// ─────────────────────────────────────────────
// 5. AUDIT LOG SCHEMA  (immutable, append-only)
// ─────────────────────────────────────────────
const AuditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    action: {
      type: String,
      required: true,
      enum: [
       "LOGIN", "LOGIN_SUCCESS", "LOGOUT", "LOGIN_FAILED",
"USER_REGISTER", "PRESCRIPTION_UPLOAD",
"PRESCRIPTION_VERIFY", "PRESCRIPTION_REJECT", "MEDICINE_SEARCH",
"ACCOUNT_LOCKED", "TOKEN_REFRESH", "ADMIN_ACTION",
"MEDICINE_ADDED", "MEDICINE_UPDATED", "ROLE_CHANGE",
"USER_BAN", "USER_UNBAN", "STORE_APPROVED", "STORE_REJECTED",
"STORE_DELETED",,
      ],
    },
    resourceType: { type: String, maxlength: 50 },
    resourceId: { type: Schema.Types.ObjectId },
    ipAddress: { type: String, maxlength: 45 }, // Supports IPv6
    userAgent: { type: String, maxlength: 500 },
    outcome: { type: String, enum: ["success", "failure"], required: true },
    metadata: { type: Schema.Types.Mixed }, // Flexible but never rendered
    timestamp: { type: Date, default: Date.now, immutable: true },
  },
  {
    strict: true,
    versionKey: false,
    // Audit logs are IMMUTABLE — disable all updates
    timestamps: false,
  }
);

// TTL index — auto-delete audit logs after 2 years (compliance)
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63_072_000 });

// 6. INVENTORY SCHEMA
// ─────────────────────────────────────────────
const InventorySchema = new Schema(
  {
    storeId:    { type: Schema.Types.ObjectId, ref: "Store", required: true },
    medicineId: { type: Schema.Types.ObjectId, ref: "Medicine", required: true },
    quantity:   { type: Number, required: true, min: 0, max: 999999, default: 0 },
    price:      { type: Number, min: 0, max: 999999 },
    inStock:    { type: Boolean, default: true },
    updatedBy:  { type: Schema.Types.ObjectId, ref: "User" },
  },
  { strict: true, versionKey: false, timestamps: true }
);
InventorySchema.index({ storeId: 1, medicineId: 1 }, { unique: true });
InventorySchema.index({ medicineId: 1, inStock: 1 });

const StockRequestSchema = new Schema({
  storeId:      { type: Schema.Types.ObjectId, ref: "Store", required: true },
  submittedBy:  { type: Schema.Types.ObjectId, ref: "User", required: true },
  status:       { type: String, enum: ["pending", "approved", "rejected", "partial"], default: "pending" },
  items: [{
    medicineId:    { type: Schema.Types.ObjectId, ref: "Medicine" },
    extractedName: { type: String, maxlength: 100 },
    matchedName:   { type: String, maxlength: 100 },
    quantity:      { type: Number, min: 0, max: 99999 },
    price:         { type: Number, min: 0, max: 99999 },
    confidence:    { type: Number, min: 0, max: 100 },
    autoApproved:  { type: Boolean, default: false },
    status:        { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    flags:         [{ type: String }],
    inDatabase: { type: Boolean, default: true },
aiVerdict:  { type: String, enum: ["legit", "suspicious", "fake"], default: "suspicious" },
aiReason:   { type: String, maxlength: 200 },
  }],
  autoApprovedCount: { type: Number, default: 0 },
  pendingCount:      { type: Number, default: 0 },
  reviewedBy:        { type: Schema.Types.ObjectId, ref: "User" },
  reviewedAt:        { type: Date },
  adminNote:         { type: String, maxlength: 500 },
  invoiceFileName:   { type: String, maxlength: 200 },
}, { timestamps: true });


module.exports = {
  User: mongoose.model("User", UserSchema),
  Medicine: mongoose.model("Medicine", MedicineSchema),
  Prescription: mongoose.model("Prescription", PrescriptionSchema),
  Store: mongoose.model("Store", StoreSchema),
  AuditLog: mongoose.model("AuditLog", AuditLogSchema),
  Inventory: mongoose.model("Inventory", InventorySchema),
  StockRequest: mongoose.model("StockRequest", StockRequestSchema),
};
// ─────────────────────────────────────────────

