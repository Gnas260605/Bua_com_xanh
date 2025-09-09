// src/server.js (ESM)
import express from "express";
import cors from "cors";
import morgan from "morgan";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";

import { ensureMySQLSchema } from "./lib/ensure-mysql.js";

// Routers
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import { authResetRouter } from "./routes/auth.reset.js";
import usersRouter from "./routes/users.js";
import overviewRouter from "./routes/overview.js";
import foodsRouter from "./routes/foods.js";
import campaignsRouter from "./routes/campaigns.js";
import adminCampaignsRouter from "./routes/admincampaigns.js"; // ✅ router admin campaigns riêng
import donorsRouter from "./routes/donors.js";
import recipientsRouter from "./routes/recipients.js";
import shippersRouter from "./routes/shippers.js";
import uploadRouter from "./routes/upload.js"; // chứa /upload và /upload-data
import adminRouter from "./routes/admin.js";

// ====== Khởi tạo schema (nếu dùng MySQL)
await ensureMySQLSchema();

const app = express();

// Nếu deploy sau proxy (nginx, render, railway, vercel, cloudflare), nên bật:
app.set("trust proxy", true);

// ====== CORS
const origins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

app.use(
  cors({
    origin: origins,
    credentials: true,
  })
);

// ====== Body parsers (tăng limit để nhận data_url ảnh)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ====== Logger (dev)
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ====== ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== Static: GET /uploads/**
app.use(
  "/uploads",
  express.static(path.resolve(__dirname, "..", "uploads"), {
    maxAge: "7d",
    immutable: false,
  })
);

// ====== Mount API routers
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/auth", authResetRouter);

app.use("/api/users", usersRouter);
app.use("/api/overview", overviewRouter);
app.use("/api/foods", foodsRouter);

// Chiến dịch
app.use("/api/campaigns", campaignsRouter);          // public
app.use("/api/admin/campaigns", adminCampaignsRouter); // ✅ admin

app.use("/api/donors", donorsRouter);
app.use("/api/recipients", recipientsRouter);
app.use("/api/shippers", shippersRouter);

// Upload (bao gồm /api/upload và /api/upload-data)
app.use("/api", uploadRouter);

// Admin router tổng hợp (các chức năng admin khác: users, settings…)
app.use("/api/admin", adminRouter);

// ====== Friendly root
app.get("/", (_req, res) => {
  res.send("BuaComXanh API is running. Try GET /api/health");
});

// (tuỳ chọn) hạn chế 404 favicon trong log
app.get("/favicon.ico", (_req, res) => res.status(204).end());

// ====== 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not Found", path: req.originalUrl });
});

// ====== Error handler cuối
app.use((err, _req, res, _next) => {
  console.error(err);

  // Các lỗi phổ biến khi upload
  if (err?.message === "ONLY_IMAGE_ALLOWED") {
    return res
      .status(415)
      .json({ error: "Chỉ cho phép file ảnh (png, jpg, jpeg, webp, gif, svg)" });
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File quá lớn (tối đa 5MB)" });
  }

  // Mặc định
  res
    .status(err?.statusCode || 500)
    .json({ error: err?.message || "Internal Server Error" });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`API up at http://localhost:${PORT}`);
});
