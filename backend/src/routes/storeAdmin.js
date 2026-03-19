const express = require("express");
const bcrypt = require("bcryptjs");
const { body, param, validationResult } = require("express-validator");
const { User, Store, Medicine, Inventory, AuditLog } = require("../models");
const { authenticateJWT, requireRole } = require("../middleware/security");

const router = express.Router();

// ── Register Store Admin (with license) ───────────────────
router.post("/register", [
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("password").isLength({ min: 8 }).matches(/[A-Z]/).matches(/[0-9]/)
    .withMessage("Password needs 8+ chars, uppercase and number"),
  body("ownerName").trim().notEmpty().isLength({ min: 2, max: 100 })
    .withMessage("Owner full name required"),
  body("ownerPhone").trim().matches(/^\+?[0-9\s\-]{7,20}$/)
    .withMessage("Valid owner phone required"),
  body("licenseNumber").trim().notEmpty()
    .matches(/^[A-Z0-9\-\/]{5,30}$/)
    .withMessage("Valid license number required (e.g. DL-MH-123456)"),
  body("licenseExpiry").isISO8601()
    .withMessage("License expiry required (YYYY-MM-DD)")
    .custom(val => {
      if (new Date(val) <= new Date()) throw new Error("License must not be expired");
      return true;
    }),
  body("storeName").trim().notEmpty().isLength({ min: 2, max: 150 })
    .withMessage("Store name required"),
  body("street").trim().notEmpty().withMessage("Street address required"),
  body("city").trim().notEmpty().withMessage("City required"),
  body("state").trim().notEmpty().withMessage("State required"),
  body("postalCode").trim().matches(/^[0-9]{4,10}$/).withMessage("Valid postal code required"),
  body("storePhone").trim().matches(/^\+?[0-9\s\-]{7,20}$/).withMessage("Valid store phone required"),
  body("latitude").isFloat({ min: -90, max: 90 }).withMessage("Valid latitude required"),
  body("longitude").isFloat({ min: -180, max: 180 }).withMessage("Valid longitude required"),
  body("openTime").matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage("Open time HH:MM"),
  body("closeTime").matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage("Close time HH:MM"),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  try {
    const {
      email, password, ownerName, ownerPhone,
      licenseNumber, licenseExpiry,
      storeName, street, city, state, postalCode,
      storePhone, latitude, longitude, openTime, closeTime,
    } = req.body;

    if (await User.findOne({ email }).lean())
      return res.status(409).json({ error: "Email already registered" });
    if (await Store.findOne({ licenseNumber }).lean())
      return res.status(409).json({ error: "License number already registered" });

    const store = await Store.create({
      name: storeName,
      address: { street, city, state, postalCode, country: "IN" },
      location: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
      phone: storePhone, licenseNumber,
      licenseExpiry: new Date(licenseExpiry),
      ownerName, ownerPhone,
      isVerified: true, // auto-verify for now; in prod admin reviews
      operatingHours: { open: openTime, close: closeTime },
    });

    const passwordHash = await bcrypt.hash(password, 4);
    const user = await User.create({ email, passwordHash, role: "pharmacist", storeId: store._id });

    await AuditLog.create({
      actorId: user._id, action: "USER_REGISTER", ipAddress: req.ip, outcome: "success",
      metadata: { email, role: "pharmacist", licenseNumber, storeId: store._id },
    });

    res.status(201).json({
      message: "Store admin registered successfully.",
      storeId: store._id, storeName: store.name, licenseNumber,
    });
  } catch (err) { next(err); }
});

// ── Get my store + inventory ───────────────────────────────
router.get("/my-store", authenticateJWT, requireRole("pharmacist", "admin"), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("storeId").lean();
    if (!user?.storeId) return res.status(404).json({ error: "No store linked to your account" });
    const store = await Store.findById(user.storeId).lean();
    if (!store) return res.status(404).json({ error: "Store not found" });
    const inventory = await Inventory.find({ storeId: store._id })
      .populate("medicineId", "name genericName category dosageForms requiresPrescription manufacturer")
      .lean();
    res.json({ store, inventory });
  } catch (err) { next(err); }
});

// ── Update store details ───────────────────────────────────
router.put("/my-store", authenticateJWT, requireRole("pharmacist", "admin"), [
  body("storeName").optional().trim().isLength({ min: 2, max: 150 }),
  body("phone").optional().trim().matches(/^\+?[0-9\s\-]{7,20}$/),
  body("openTime").optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body("closeTime").optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body("street").optional().trim().notEmpty(),
  body("city").optional().trim().notEmpty(),
  body("state").optional().trim().notEmpty(),
  body("postalCode").optional().matches(/^[0-9]{4,10}$/),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  try {
    const user = await User.findById(req.user.id).select("storeId").lean();
    if (!user?.storeId) return res.status(404).json({ error: "No store linked" });
    const store = await Store.findById(user.storeId).lean();
    const { storeName, phone, openTime, closeTime, street, city, state, postalCode } = req.body;
    const update = {};
    if (storeName) update.name = storeName;
    if (phone) update.phone = phone;
    if (openTime || closeTime) update.operatingHours = {
      open: openTime || store.operatingHours?.open,
      close: closeTime || store.operatingHours?.close,
    };
    if (street || city || state || postalCode) update.address = {
      ...store.address,
      ...(street && { street }), ...(city && { city }),
      ...(state && { state }), ...(postalCode && { postalCode }),
    };
    const updated = await Store.findByIdAndUpdate(user.storeId, update, { new: true });
    res.json({ message: "Store updated", store: updated });
  } catch (err) { next(err); }
});

// ── Get all medicines list ─────────────────────────────────
router.get("/medicines", authenticateJWT, requireRole("pharmacist", "admin"), async (req, res, next) => {
  try {
    const medicines = await Medicine.find({ isActive: true })
      .select("name genericName category dosageForms requiresPrescription manufacturer")
      .sort({ name: 1 }).lean();
    res.json({ data: medicines });
  } catch (err) { next(err); }
});

// ── Add / Update inventory ─────────────────────────────────
router.post("/inventory", authenticateJWT, requireRole("pharmacist", "admin"), [
  body("medicineId").isMongoId().withMessage("Valid medicine ID required"),
  body("quantity").isInt({ min: 0, max: 999999 }).withMessage("Valid quantity required"),
  body("price").optional().isFloat({ min: 0 }).withMessage("Valid price required"),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  try {
    const user = await User.findById(req.user.id).select("storeId").lean();
    if (!user?.storeId) return res.status(400).json({ error: "No store linked" });
    const { medicineId, quantity, price } = req.body;
    const medicine = await Medicine.findById(medicineId).lean();
    if (!medicine) return res.status(404).json({ error: "Medicine not found" });
    const qty = parseInt(quantity);
    const inv = await Inventory.findOneAndUpdate(
      { storeId: user.storeId, medicineId },
      { quantity: qty, inStock: qty > 0, updatedBy: req.user.id, ...(price !== undefined && { price: parseFloat(price) }) },
      { upsert: true, new: true, runValidators: true }
    );
    if (qty > 0) {
      await Medicine.findByIdAndUpdate(medicineId, { $addToSet: { availableAt: user.storeId } });
    } else {
      await Medicine.findByIdAndUpdate(medicineId, { $pull: { availableAt: user.storeId } });
    }
    res.json({ message: "Inventory updated", medicine: medicine.name, quantity: inv.quantity, inStock: inv.inStock, price: inv.price });
  } catch (err) { next(err); }
});

// ── Delete from inventory ──────────────────────────────────
router.delete("/inventory/:medicineId", authenticateJWT, requireRole("pharmacist", "admin"),
  [param("medicineId").isMongoId()],
  async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id).select("storeId").lean();
      if (!user?.storeId) return res.status(400).json({ error: "No store linked" });
      await Inventory.findOneAndDelete({ storeId: user.storeId, medicineId: req.params.medicineId });
      await Medicine.findByIdAndUpdate(req.params.medicineId, { $pull: { availableAt: user.storeId } });
      res.json({ message: "Removed from inventory" });
    } catch (err) { next(err); }
  }
);

module.exports = router;