// src/routes/upload.js
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ===== ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== Thư mục lưu uploads: <project-root>/uploads
// (file này ở src/routes => ../../ là về project-root)
const UPLOAD_DIR = path.resolve(__dirname, "../..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ===== Map mimetype -> ext (phòng khi không có ext gốc)
const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

// ===== Cấu hình Multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const rawExt = path.extname(file.originalname || "");
    const safeBase =
      path
        .basename(file.originalname || "file", rawExt)
        .replace(/[^\p{L}\p{N}._-]+/gu, "_") || "file";
    const ext = rawExt || EXT_BY_MIME[file.mimetype] || ".bin";
    cb(null, `${safeBase}-${Date.now()}${ext}`);
  },
});

// 🔐 Chỉ nhận ảnh; trả lỗi rõ ràng
function fileFilter(_req, file, cb) {
  const ok = /^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(file.mimetype);
  if (ok) cb(null, true);
  else cb(new Error("ONLY_IMAGE_ALLOWED"));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const router = Router();

/**
 * POST /api/upload
 * multipart/form-data; field: "file"
 * -> { url, filename, size, mimetype }
 */
router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Không nhận được tệp tải lên." });

  // Build absolute URL trả cho FE (tôn trọng proxy headers)
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const fileUrl = `${proto}://${host}/uploads/${req.file.filename}`;

  res.json({
    url: fileUrl,
    filename: req.file.filename,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
});

/**
 * POST /api/upload-data
 * JSON: { data_url: "data:image/...;base64,..." }
 * -> { url }
 */
router.post("/upload-data", async (req, res) => {
  try {
    const dataUrl = String(req.body?.data_url || "");
    if (!dataUrl.startsWith("data:image/")) {
      return res.status(400).json({ message: "data_url không hợp lệ (phải là ảnh)." });
    }
    const [meta, b64] = dataUrl.split(",");
    if (!b64) return res.status(400).json({ message: "Thiếu payload base64 trong data_url." });

    const mime = meta.match(/^data:([^;]+);base64$/)?.[1] || "image/jpeg";
    const ext = EXT_BY_MIME[mime] || ".jpg";
    const buf = Buffer.from(b64, "base64");

    const name = `cover-${Date.now()}${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);

    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const fileUrl = `${proto}://${host}/uploads/${name}`;

    res.json({ url: fileUrl });
  } catch (e) {
    res.status(500).json({ message: e?.message || "Upload data_url thất bại." });
  }
});

// ===== Bộ xử lý lỗi Multer (trả message rõ ràng)
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: "Ảnh vượt quá giới hạn 5MB (413)." });
    }
    return res.status(400).json({ message: `Lỗi tải tệp: ${err.code}` });
  }
  if (err?.message === "ONLY_IMAGE_ALLOWED") {
    return res.status(415).json({ message: "Chỉ chấp nhận định dạng ảnh (png, jpg, webp, gif, svg)." });
  }
  if (err) {
    return res.status(400).json({ message: err.message || "Upload lỗi." });
  }
  res.status(500).json({ message: "Upload lỗi không xác định." });
});

export default router;
