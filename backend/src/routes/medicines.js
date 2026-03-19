const express = require("express");
const { query, validationResult } = require("express-validator");
const { Medicine, Inventory, AuditLog } = require("../models");
const { authenticateJWT, searchLimiter } = require("../middleware/security");
const { safeFuzzyMatch } = require("../services/fuzzyMatch");

const router = express.Router();

const VALID_CATEGORIES = [
  "antibiotic","analgesic","antiviral","antifungal","antihypertensive",
  "antidiabetic","antihistamine","supplement","vaccine","other"
];

const searchValidation = [
  query("q").trim().notEmpty().isLength({ min: 2, max: 100 })
    .matches(/^[a-zA-Z0-9\s\-.]+$/).withMessage("Invalid characters").escape(),
  query("category").optional().isIn(VALID_CATEGORIES),
  query("page").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 50 }).toInt(),
];

router.get("/search", searchLimiter, authenticateJWT, searchValidation, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  try {
    const { q: rawQuery, category, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    const selectFields = "name genericName category manufacturer dosageForms requiresPrescription";

    // ── Layer 1: Full-text search ─────────────────────────
    const textFilter = { $text: { $search: rawQuery }, isActive: true, ...(category && { category }) };
    let [medicines, total] = await Promise.all([
      Medicine.find(textFilter, { score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" } })
        .skip(skip).limit(limit).select(selectFields).lean(),
      Medicine.countDocuments(textFilter),
    ]);

    // ── Layer 2: Fuzzy fallback ───────────────────────────
    let usedFuzzy = false;
    if (medicines.length === 0) {
      usedFuzzy = true;
      const allMeds = await Medicine.find({ isActive: true }).select("_id name genericName").lean();
      const fuzzyIds = safeFuzzyMatch(rawQuery, allMeds);
      if (fuzzyIds.length > 0) {
        const fuzzyFilter = { _id: { $in: fuzzyIds }, isActive: true, ...(category && { category }) };
        [medicines, total] = await Promise.all([
          Medicine.find(fuzzyFilter).skip(skip).limit(limit).select(selectFields).lean(),
          Medicine.countDocuments(fuzzyFilter),
        ]);
      }
    }

    // ── Layer 3: Enrich with live inventory + store info ──
    const medicineIds = medicines.map(m => m._id);
    const inventoryRecords = await Inventory.find({
      medicineId: { $in: medicineIds },
      inStock: true,
      quantity: { $gt: 0 },
    })
    .populate({
      path: "storeId",
      select: "name address phone operatingHours location isVerified",
      match: { isVerified: true },
    })
    .lean();

    // Group inventory by medicineId
    const inventoryMap = {};
    for (const inv of inventoryRecords) {
      if (!inv.storeId) continue; // store not verified
      const key = inv.medicineId.toString();
      if (!inventoryMap[key]) inventoryMap[key] = [];
      inventoryMap[key].push({
        storeId:   inv.storeId._id,
        storeName: inv.storeId.name,
        address:   inv.storeId.address,
        phone:     inv.storeId.phone,
        hours:     inv.storeId.operatingHours,
        location:  inv.storeId.location?.coordinates
                     ? { lat: inv.storeId.location.coordinates[1], lng: inv.storeId.location.coordinates[0] }
                     : null,
        quantity:  inv.quantity,
        price:     inv.price || null,
        inStock:   inv.inStock,
      });
    }

    // Attach store info to each medicine
    const enriched = medicines.map(med => ({
      ...med,
      availableAt: inventoryMap[med._id.toString()] || [],
    }));

    AuditLog.create({
      actorId: req.user.id, action: "MEDICINE_SEARCH",
      ipAddress: req.ip, outcome: "success",
      metadata: { resultCount: enriched.length, usedFuzzy },
    }).catch(() => {});

    res.json({
      data: enriched,
      meta: { query: rawQuery, usedFuzzy, page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
});

module.exports = router;