// ============================================================
// FILE: src/services/ocrService.js
// Dev-safe version — Google Vision loads only in production
// ============================================================

const crypto = require("crypto");

const MAX_OCR_LENGTH = 5000;
const ALLOWED_OCR_CHARS = /[^a-zA-Z0-9\s.,:()\-\/°%+#@\n]/g;

const sanitizeOcrText = (rawText) => {
  if (typeof rawText !== "string") return "";
  return rawText
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(ALLOWED_OCR_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, MAX_OCR_LENGTH);
};

const validateImageBuffer = (buffer, mimeType) => {
  if (!Buffer.isBuffer(buffer)) throw new TypeError("Expected Buffer");
  if (buffer.length < 1024)    throw new Error("Image too small or corrupt");
  if (buffer.length > 5 * 1024 * 1024) throw new Error("Image too large");
  const allowed = new Set(["image/jpeg", "image/png", "application/pdf"]);
  if (!allowed.has(mimeType))  throw new Error("Unsupported image type");
};

const extractTextFromImage = async (imageBuffer, mimeType) => {
  validateImageBuffer(imageBuffer, mimeType);

  let rawText = "";

  if (process.env.USE_GOOGLE_VISION === "true") {
    // Only loaded in production when explicitly enabled
    const vision = require("@google-cloud/vision");
    const client = new vision.ImageAnnotatorClient();
    const [result] = await client.documentTextDetection({
      image: { content: imageBuffer.toString("base64") },
    });
    rawText = result.fullTextAnnotation?.text || "";
  } else {
    // Development: use Tesseract
    try {
      const Tesseract = require("tesseract.js");
      const { data } = await Tesseract.recognize(imageBuffer, "eng", {
        logger: () => {},
      });
      rawText = data.text;
    } catch {
      // Tesseract also not installed? Return empty string — don't crash
      rawText = "[OCR unavailable in development]";
    }
  }

  return sanitizeOcrText(rawText);
};

module.exports = { extractTextFromImage, sanitizeOcrText };