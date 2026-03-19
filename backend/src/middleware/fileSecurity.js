const fileType = require("file-type");
const path = require("path");

// Allowed MIME types
const ALLOWED_TYPES = {
  "image/jpeg":      { ext: ["jpg", "jpeg"], maxSize: 5 * 1024 * 1024 },  // 5MB
  "image/png":       { ext: ["png"],         maxSize: 5 * 1024 * 1024 },
  "image/webp":      { ext: ["webp"],        maxSize: 5 * 1024 * 1024 },
  "application/pdf": { ext: ["pdf"],         maxSize: 10 * 1024 * 1024 }, // 10MB
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    ext: ["docx"], maxSize: 10 * 1024 * 1024
  },
};

// Dangerous patterns to block in extracted text
const DANGEROUS_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /\$\{.*?\}/g,
  /\{\{.*?\}\}/g,
  /eval\s*\(/gi,
  /exec\s*\(/gi,
  /require\s*\(/gi,
  /import\s*\(/gi,
  /SELECT\s+.*\s+FROM/gi,
  /DROP\s+TABLE/gi,
  /INSERT\s+INTO/gi,
  /UPDATE\s+.*\s+SET/gi,
  /DELETE\s+FROM/gi,
  /<\?php/gi,
  /\.\.\//g,
];

// Validate file buffer magic bytes (not just extension)
const validateFileBuffer = async (buffer, declaredMime) => {
  const detected = await fileType.fromBuffer(buffer);

  if (!detected) {
    // For text-based files that don't have magic bytes (some docx)
    if (declaredMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return true;
    }
    throw new Error("Could not determine file type");
  }

  // Check if detected mime matches declared mime
  const allowedForDetected = ALLOWED_TYPES[detected.mime];
  if (!allowedForDetected) {
    throw new Error(`File type ${detected.mime} is not allowed`);
  }

  // Extra check: declared type must match detected type category
  const declaredCategory = declaredMime?.split("/")[0];
  const detectedCategory = detected.mime?.split("/")[0];
  if (declaredCategory !== detectedCategory && declaredMime !== "application/pdf") {
    throw new Error("File type mismatch detected");
  }

  return true;
};

// Sanitize extracted text
const sanitizeExtractedText = (text) => {
  if (!text || typeof text !== "string") return "";

  let sanitized = text;

  // Remove dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  // Limit length
  sanitized = sanitized.substring(0, 50000);

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, "");

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, " ").trim();

  return sanitized;
};

// Validate file size
const validateFileSize = (buffer, mimeType) => {
  const config = ALLOWED_TYPES[mimeType];
  if (!config) throw new Error("Unsupported file type");
  if (buffer.length > config.maxSize) {
    throw new Error(`File too large. Max size is ${config.maxSize / (1024 * 1024)}MB`);
  }
  return true;
};

// Validate file extension matches mime
const validateExtension = (filename, mimeType) => {
  if (!filename) throw new Error("Filename is required");

  // Sanitize filename
  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "");
  const ext = safeName.split(".").pop()?.toLowerCase();

  if (!ext) throw new Error("File has no extension");

  const config = ALLOWED_TYPES[mimeType];
  if (!config) throw new Error("Unsupported file type");

  if (!config.ext.includes(ext)) {
    throw new Error(`Extension .${ext} does not match file type ${mimeType}`);
  }

  return safeName;
};

module.exports = {
  ALLOWED_TYPES,
  validateFileBuffer,
  validateFileSize,
  validateExtension,
  sanitizeExtractedText,
};