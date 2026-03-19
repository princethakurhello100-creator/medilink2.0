const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const Groq = require("groq-sdk");
const { Medicine, Inventory, Store, StockRequest, User } = require("../models");
const { authenticateJWT, requireRole } = require("../middleware/security");
const { sendStockRequestEmail } = require("../services/emailService");
const {
  ALLOWED_TYPES, validateFileBuffer, validateFileSize,
  validateExtension, sanitizeExtractedText,
} = require("../middleware/fileSecurity");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) cb(null, true);
    else cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  },
});

let groq = null;
const getGroq = () => {
  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groq;
};

// AI verdict for each medicine — is it real or fake?
const getAIVerdict = async (medicineName, quantity, price) => {
  try {
    const response = await getGroq().chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are a pharmaceutical verification expert. Analyze medicine details and determine if they look legitimate or suspicious/fake.
          
Return ONLY a JSON object like:
{"verdict": "legit", "confidence": 85, "reason": "Standard medicine with normal pricing"}

verdict must be one of: "legit", "suspicious", "fake"
confidence is 0-100
reason is a short explanation under 100 chars`,
        },
        {
          role: "user",
          content: `Medicine: "${medicineName}", Quantity: ${quantity}, Price: ₹${price}. Is this legitimate?`,
        },
      ],
      max_tokens: 150,
    });

    const text = response.choices[0]?.message?.content || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      verdict:    parsed.verdict || "suspicious",
      confidence: parsed.confidence || 50,
      reason:     parsed.reason || "Could not determine",
    };
  } catch {
    return { verdict: "suspicious", confidence: 50, reason: "AI verification unavailable" };
  }
};

const extractFromPdf = async (buffer) => {
  const data = await pdfParse(buffer);
  return data.text;
};

const extractFromDocx = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
};

const prepareImage = async (buffer, mimeType) => {
  let processed = buffer;
  if (mimeType.startsWith("image/")) {
    processed = await sharp(buffer)
      .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  }
  return processed.toString("base64");
};

const parseMedicinesFromAI = (text) => {
  try {
    const jsonMatch = text.match(/STOCK:\s*(\[[\s\S]*?\])/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]);
  } catch {}
  return [];
};

// ── SCAN ──────────────────────────────────────────────────
router.post("/scan", authenticateJWT, requireRole("pharmacist", "admin"), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { buffer, mimetype, originalname } = req.file;

    try {
      validateFileSize(buffer, mimetype);
      validateExtension(originalname, mimetype);
      await validateFileBuffer(buffer, mimetype);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    let extractedText = "";
    let useVision = false;

    if (mimetype === "application/pdf") {
      extractedText = await extractFromPdf(buffer);
    } else if (mimetype.includes("wordprocessingml")) {
      extractedText = await extractFromDocx(buffer);
    } else if (mimetype.startsWith("image/")) {
      useVision = true;
    }

    if (extractedText) extractedText = sanitizeExtractedText(extractedText);

    let aiResponse;
    if (useVision) {
      const base64Image = await prepareImage(buffer, mimetype);
      aiResponse = await getGroq().chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            { type: "text", text: `Analyze this pharmacy invoice image and extract all medicine names with quantities and prices.\n\nReturn ONLY this format:\nSTOCK: [\n  {"name": "Medicine Name", "quantity": 100, "price": 50.00}\n]\nIf quantity or price not visible, use 0. Only extract medicine/drug names.` },
          ],
        }],
        max_tokens: 1000,
      });
    } else {
      aiResponse = await getGroq().chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: `Extract medicine names, quantities and prices from invoice text.\nReturn ONLY:\nSTOCK: [\n  {"name": "Medicine Name", "quantity": 100, "price": 50.00}\n]\nIf not found, use 0. Only extract medicine/drug names.` },
          { role: "user", content: `Extract medicines:\n\n${extractedText.substring(0, 8000)}` },
        ],
        max_tokens: 1000,
      });
    }

    const rawReply = aiResponse.choices[0]?.message?.content || "";
    const extractedMedicines = parseMedicinesFromAI(rawReply);

    if (extractedMedicines.length === 0) {
      return res.status(422).json({ error: "No medicines found. Please upload a clear medicine invoice." });
    }

    const matchedMedicines   = [];
    const unmatchedMedicines = [];

    for (const item of extractedMedicines) {
      if (!item.name || typeof item.name !== "string") continue;
      const safeName = item.name.replace(/[^a-zA-Z0-9\s\-().]/g, "").substring(0, 100);
      const quantity = Math.min(Math.max(parseInt(item.quantity) || 0, 0), 99999);
      const price    = Math.min(Math.max(parseFloat(item.price) || 0, 0), 99999);

      const found = await Medicine.findOne({
        isActive: true,
        $or: [
          { name: { $regex: safeName, $options: "i" } },
          { genericName: { $regex: safeName, $options: "i" } },
        ],
      }).lean();

      if (found) {
        matchedMedicines.push({
          medicineId:    found._id,
          name:          found.name,
          genericName:   found.genericName,
          extractedName: safeName,
          quantity, price,
          inDatabase:    true,
          include:       true,
        });
      } else {
        unmatchedMedicines.push({
          extractedName: safeName,
          quantity, price,
          inDatabase:    false,
          include:       true,
        });
      }
    }

    res.json({
      message:      "Scan complete",
      matched:      matchedMedicines,
      unmatched:    unmatchedMedicines,
      totalFound:   extractedMedicines.length,
      totalMatched: matchedMedicines.length,
    });

  } catch (err) {
    if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "File too large. Max 10MB." });
    next(err);
  }
});

// ── CONFIRM — all items go to admin with AI verdict ───────
router.post("/confirm", authenticateJWT, requireRole("pharmacist", "admin"), async (req, res, next) => {
  try {
    console.log("[CONFIRM] Hit by user:", req.user?.id);
    const { medicines, filename } = req.body;

    if (!medicines || !Array.isArray(medicines) || medicines.length === 0)
      return res.status(400).json({ error: "No medicines to add" });
    if (medicines.length > 100)
      return res.status(400).json({ error: "Too many medicines in one batch" });

    const user = await User.findById(req.user.id).select("storeId").lean();
    if (!user?.storeId) return res.status(404).json({ error: "No store linked to your account" });
    const store = await Store.findById(user.storeId).lean();
    if (!store) return res.status(404).json({ error: "Store not found" });

    console.log("[CONFIRM] Store:", store.name, "medicines:", medicines.length);

    const requestItems = [];

    for (const item of medicines) {
      if (!item.include) continue;

      const quantity = Math.min(Math.max(parseInt(item.quantity) || 0, 0), 99999);
      const price    = Math.min(Math.max(parseFloat(item.price) || 0, 0), 99999);
      const name     = item.inDatabase ? item.name : item.extractedName;

      // Get AI verdict for every medicine
      console.log("[CONFIRM] Getting AI verdict for:", name);
      const aiVerdict = await getAIVerdict(name, quantity, price);
      console.log("[CONFIRM] Verdict:", name, "→", aiVerdict.verdict, aiVerdict.confidence + "%");

      if (item.inDatabase && item.medicineId) {
        // Matched medicine — verify it exists
        const medicine = await Medicine.findOne({ _id: item.medicineId, isActive: true }).lean();
        if (!medicine) continue;

        requestItems.push({
          medicineId:    item.medicineId,
          extractedName: item.extractedName,
          matchedName:   medicine.name,
          quantity, price,
          confidence:    aiVerdict.confidence,
          autoApproved:  false,
          status:        "pending",
          inDatabase:    true,
          flags:         aiVerdict.verdict !== "legit" ? [aiVerdict.reason] : [],
          aiVerdict:     aiVerdict.verdict,
          aiReason:      aiVerdict.reason,
        });
      } else {
        // Unmatched medicine — also send to admin
        requestItems.push({
          medicineId:    null,
          extractedName: item.extractedName,
          matchedName:   null,
          quantity, price,
          confidence:    aiVerdict.confidence,
          autoApproved:  false,
          status:        "pending",
          inDatabase:    false,
          flags:         aiVerdict.verdict !== "legit"
            ? [aiVerdict.reason]
            : ["Not in database — admin must add it first"],
          aiVerdict:     aiVerdict.verdict,
          aiReason:      aiVerdict.reason,
        });
      }
    }

    if (requestItems.length === 0)
      return res.status(400).json({ error: "No valid medicines to submit" });

    const stockRequest = await StockRequest.create({
      storeId:           store._id,
      submittedBy:       req.user.id,
      status:            "pending",
      invoiceFileName:   filename || "invoice",
      autoApprovedCount: 0,
      pendingCount:      requestItems.length,
      items:             requestItems,
    });

    console.log("[CONFIRM] StockRequest created:", stockRequest._id, "items:", requestItems.length);

    res.json({
      message: `✅ ${requestItems.length} medicines submitted for admin approval. You will be notified once reviewed.`,
      pendingReview: requestItems.length,
      requestId:     stockRequest._id,
    });

  } catch (err) {
    console.error("[CONFIRM ERROR]", err);
    next(err);
  }
});

module.exports = router;