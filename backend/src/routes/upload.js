// src/routes/upload.js
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bảo đảm thư mục uploads tồn tại
const uploadDir = path.resolve(__dirname, "../..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Cấu hình multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path.basename(file.originalname || "file", ext).replace(/\s+/g, "_");
    const name = `${base}-${Date.now()}${ext || ".bin"}`;
    cb(null, name);
  },
});

function fileFilter(_req, file, cb) {
  // Chỉ nhận ảnh
  const ok = /^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(file.mimetype);
  cb(ok ? null : new Error("ONLY_IMAGE_ALLOWED"), ok);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const router = Router();

/**
 * POST /api/upload
 * body: multipart/form-data; field name = "file"
 * return: { url }
 */
router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });

  // Build absolute URL cho FE
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const fileUrl = `${proto}://${host}/uploads/${req.file.filename}`;

  res.json({ url: fileUrl, filename: req.file.filename, size: req.file.size, mimetype: req.file.mimetype });
});

export default router;
