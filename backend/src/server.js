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
import mealsRouter from "./routes/meals.js";
import campaignsRouter from "./routes/campaigns.js";

// ⬇️ Router mới/được sửa: trả số liệu từ DB cho trang Reports
import adminCampaignsRouter from "./routes/admincampaigns.js";

import donorsRouter from "./routes/donors.js";
import recipientsRouter from "./routes/recipients.js";
import shippersRouter from "./routes/shippers.js";
import uploadRouter from "./routes/upload.js";
import adminRouter from "./routes/admin.js";
import vietqrWebhook from "./routes/webhooks.vietqr.js";
import importPayments from "./routes/payments.import.js";
import paymentsRouter from "./routes/payments.js";
import siteSettingsRouter from "./routes/site_settings.js";
import pickupPointsRouter from "./routes/pickup_points.js";
import adminPickupPointsRouter from "./routes/admin.pickup_points.js";
import momoRouter from "./routes/payments.momo.js";
import reportsPublicRouter from "./routes/reports.public.js";
import paymentsImportRouter from "./routes/payments.import.js";
// ====== Khởi tạo schema (nếu dùng MySQL)
await ensureMySQLSchema();

const app = express();
app.set("trust proxy", true);

/* ---------- CORS ---------- */
const origins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (origins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Origin",
      "Cache-Control",
      "Pragma",
      "X-Requested-With",
    ],
    exposedHeaders: ["Content-Length"],
    maxAge: 86400,
  })
);
app.options("*", cors());

/* ---------- Body parsers & logger ---------- */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

/* ---------- ESM __dirname ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------- Static ---------- */
app.use(
  "/uploads",
  express.static(path.resolve(__dirname, "..", "uploads"), {
    maxAge: "7d",
    immutable: false,
  })
);
app.use("/api/reports", reportsPublicRouter);
app.use("/api", paymentsImportRouter);
/* ---------- Webhooks ---------- */
app.use("/api/webhooks", express.json({ type: "*/*" }), vietqrWebhook);

/* ---------- Mount API routers ---------- */
app.use("/api/site-settings", siteSettingsRouter);

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/auth", authResetRouter);

app.use("/api/users", usersRouter);
app.use("/api/overview", overviewRouter);
app.use("/api/foods", foodsRouter);
app.use("/api/meals", mealsRouter);

// Public campaigns
app.use("/api/campaigns", campaignsRouter);

// Admin campaigns (đÃ TÍNH tổng hợp số liệu cho trang Reports)
app.use("/api/admin/campaigns", adminCampaignsRouter);

app.use("/api/donors", donorsRouter);
app.use("/api/recipients", recipientsRouter);
app.use("/api/shippers", shippersRouter);

// Upload
app.use("/api", uploadRouter);

// Admin tổng hợp (giữ nguyên các route khác dưới /api/admin)
app.use("/api/admin", adminRouter);

// Payments
app.use("/api/payments", paymentsRouter);
app.use("/api/payments/momo", momoRouter);
app.use("/api/payments-import", importPayments);

// Pickup points
app.use("/api/pickup-points", pickupPointsRouter);
app.use("/api/admin/pickup-points", adminPickupPointsRouter);

// Friendly root
app.get("/", (_req, res) => {
  res.send("BuaComXanh API is running. Try GET /api/health");
});
app.get("/favicon.ico", (_req, res) => res.status(204).end());

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not Found", path: req.originalUrl });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.message === "ONLY_IMAGE_ALLOWED") {
    return res.status(415).json({ error: "Chỉ cho phép file ảnh (png, jpg, jpeg, webp, gif, svg)" });
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File quá lớn (tối đa 5MB)" });
  }
  res.status(err?.statusCode || 500).json({ error: err?.message || "Internal Server Error" });
});

// Start
const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`API up at http://localhost:${PORT}`);
});
