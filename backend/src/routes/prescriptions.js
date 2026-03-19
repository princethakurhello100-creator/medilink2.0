const express = require("express");
const multer  = require("multer");
const crypto  = require("crypto");
const { Prescription, AuditLog } = require("../models");
const { authenticateJWT, uploadLimiter, requireRole } = require("../middleware/security");
const { extractTextFromImage } = require("../services/ocrService");

const router = express.Router();

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 5 },
  fileFilter: (_, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype))
      return cb(new Error("Only JPEG, PNG, and PDF files are allowed"), false);
    cb(null, true);
  },
});

const MAGIC_BYTES = {
  "image/jpeg":      [0xff, 0xd8, 0xff],
  "image/png":       [0x89, 0x50, 0x4e, 0x47],
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
};

const validateMagicBytes = (buffer, mimeType) => {
  const expected = MAGIC_BYTES[mimeType];
  if (!expected) return false;
  return expected.every((byte, i) => buffer[i] === byte);
};

// In development: just generate a key and skip actual GCS upload
const storeFile = async (buffer, mimeType, userId) => {
  const uuid = crypto.randomUUID();
  const ext  = mimeType === "application/pdf" ? "pdf"
             : mimeType === "image/png"        ? "png" : "jpg";
  const objectKey = `${uuid}/${userId}.${ext}`;

  if (process.env.NODE_ENV === "production" && process.env.GCS_PRESCRIPTION_BUCKET) {
    const { Storage } = require("@google-cloud/storage");
    const gcs    = new Storage();
    const bucket = gcs.bucket(process.env.GCS_PRESCRIPTION_BUCKET);
    await bucket.file(objectKey).save(buffer, {
      contentType: mimeType,
      metadata: {
        uploadedBy: userId,
        sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
      },
      predefinedAcl: "private",
    });
  }
  return objectKey;
};

router.post("/upload",
  uploadLimiter, authenticateJWT, requireRole("patient"),
  upload.single("prescription"),
  async (req, res, next) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Prescription file is required" });

    try {
      if (!validateMagicBytes(file.buffer, file.mimetype))
        return res.status(400).json({ error: "File content does not match declared type" });
      if (file.buffer.length > MAX_FILE_SIZE)
        return res.status(400).json({ error: "File too large" });

      const userId   = req.user.id;
      const imageKey = await storeFile(file.buffer, file.mimetype, userId);
      const ocrText  = await extractTextFromImage(file.buffer, file.mimetype);

      const prescription = await Prescription.create({
        patientId: userId, imageKey, ocrText, status: "pending",
      });

      await AuditLog.create({
        actorId: userId, action: "PRESCRIPTION_UPLOAD",
        resourceType: "Prescription", resourceId: prescription._id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"]?.substring(0, 500),
        outcome: "success",
        metadata: {
          fileSize: file.buffer.length, mimeType: file.mimetype,
          sha256: crypto.createHash("sha256").update(file.buffer).digest("hex"),
        },
      });

      res.status(201).json({
        message: "Prescription uploaded successfully. Pending verification.",
        prescriptionId: prescription._id,
        status: prescription.status,
      });
    } catch (err) {
      await AuditLog.create({
        actorId: req.user?.id, action: "PRESCRIPTION_UPLOAD",
        ipAddress: req.ip, outcome: "failure",
        metadata: { error: err.message },
      }).catch(() => {});
      next(err);
    }
  }
);

module.exports = router;