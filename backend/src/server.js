// src/server.js (ESM)
import express from "express";
import cors from "cors";
import morgan from "morgan";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";

import { ensureMySQLSchema } from "./lib/ensure-mysql.js";

/* ---------- Routers ---------- */
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import { authResetRouter } from "./routes/auth.reset.js";
import usersRouter from "./routes/users.js";
import overviewRouter from "./routes/overview.js";
import foodsRouter from "./routes/foods.js";
import mealsRouter from "./routes/meals.js";
import campaignsRouter from "./routes/campaigns.js";
import adminCampaignsRouter from "./routes/admincampaigns.js";
import donorsRouter from "./routes/donors.js";
import recipientsRouter from "./routes/recipients.js";
import shippersRouter from "./routes/shippers.js";
import uploadRouter from "./routes/upload.js";
import adminRouter from "./routes/admin.js";
import vietqrWebhook from "./routes/webhooks.vietqr.js";
import paymentsRouter from "./routes/payments.js";
import momoRouter from "./routes/payments.momo.js";
import siteSettingsRouter from "./routes/site_settings.js";
import pickupPointsRouter from "./routes/pickup_points.js";
import adminPickupPointsRouter from "./routes/admin.pickup_points.js";
import reportsPublicRouter from "./routes/reports.public.js";
import paymentsImportRouter from "./routes/payments.import.js";
import announcementsRouter from "./routes/announcements.js";
import { deliveriesRouter } from "./routes/deliveries.js";
import { bookingsRouter } from "./routes/bookings.js";
import donorRouter from "./routes/donors.js";

/* ====== Khởi tạo schema (nếu dùng MySQL) ====== */
await ensureMySQLSchema();

const app = express();
app.set("trust proxy", true);

/* ---------- CORS (đặt trước routers) ---------- */
const origins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ];

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
app.use("/api/donor", donorRouter);
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

/* ---------- Middleware: gắn req.user từ JWT cho toàn app ---------- */
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
app.use((req, _res, next) => {
  try {
    const h = req.headers.authorization || "";
    const m = h.match(/^Bearer\s+(.+)$/i);
    if (m) req.user = jwt.verify(m[1], JWT_SECRET); // { id, email, role }
  } catch {
    /* ignore */
  }
  next();
});

/* ---------- Debug endpoint: xem app đang dùng DB nào ---------- */
app.get("/api/_debug/info", async (req, res) => {
  const info = {
    DB_DRIVER: process.env.DB_DRIVER || "sqlite",
    MYSQL_HOST: process.env.DB_HOST || null,
    MYSQL_DB: process.env.DB_NAME || null,
    SQLITE_FILE: process.env.DB_FILE || null,
    NODE_ENV: process.env.NODE_ENV || null,
    PORT: process.env.PORT || 4000,
  };
  try {
    // cố gắng lấy thông tin runtime
    if ((process.env.DB_DRIVER || "sqlite") === "mysql") {
      const { db } = await import("./lib/db.mysql.js");
      const [r] = await db.query("SELECT DATABASE() db, NOW() `now`");
      info.db_runtime = r?.[0] || r;
    } else {
      const { db } = await import("./lib/db.js");
      info.db_runtime = { sqlite_file: db?.name || process.env.DB_FILE || "sqlite.db" };
    }
  } catch (e) {
    info.db_runtime_error = String(e);
  }
  res.json(info);
});

/* ---------- Webhooks (đặt trước nếu cần raw body) ---------- */
app.use("/api/webhooks", express.json({ type: "*/*" }), vietqrWebhook);

/* ---------- Routers (THỨ TỰ QUAN TRỌNG) ---------- */
/* 1) Các router “khai báo path tuyệt đối” như deliveriesRouter
      đã có sẵn path bên trong (e.g. /api/admin/deliveries, /api/shippers/...) */
app.use("/api", deliveriesRouter);
app.use("/api", bookingsRouter);

app.use("/api/admin/pickup-points", adminPickupPointsRouter);
/* 2) Public reports & imports */
app.use("/api/reports", reportsPublicRouter);
app.use("/api", paymentsImportRouter);

/* 3) Site settings & health */
app.use("/api/site-settings", siteSettingsRouter);
app.use("/api/health", healthRouter);

/* 4) Auth */
app.use("/api/auth", authRouter);
app.use("/api/auth", authResetRouter);

/* 5) Core resources */
app.use("/api/users", usersRouter);
app.use("/api/overview", overviewRouter);
app.use("/api/foods", foodsRouter);
app.use("/api/meals", mealsRouter);

/* 6) Campaigns */
app.use("/api/campaigns", campaignsRouter);             // public campaigns
app.use("/api/admin/campaigns", adminCampaignsRouter);  // admin campaigns

/* 7) Donors/Recipients/Shippers */
app.use("/api/donors", donorsRouter);
app.use("/api/recipients", recipientsRouter);
app.use("/api/shippers", shippersRouter);

/* 8) Upload */
app.use("/api", uploadRouter);

/* 9) Admin tổng hợp */
app.use("/api/admin", adminRouter);

/* 10) Payments */
app.use("/api/payments", paymentsRouter);
app.use("/api/payments/momo", momoRouter);

/* 11) Pickup points */
app.use("/api/pickup-points", pickupPointsRouter);
app.use("/api/admin/pickup-points", adminPickupPointsRouter);

/* 12) Announcements */
app.use("/api/announcements", announcementsRouter);

/* ---------- Friendly root ---------- */
app.get("/", (_req, res) => {
  res.send("BuaComXanh API is running. Try GET /api/health");
});
app.get("/favicon.ico", (_req, res) => res.status(204).end());

/* ---------- 404 ---------- */
app.use((req, res) => {
  res.status(404).json({ error: "Not Found", path: req.originalUrl });
});

/* ---------- Error handler ---------- */
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.message === "ONLY_IMAGE_ALLOWED") {
    return res
      .status(415)
      .json({ error: "Chỉ cho phép file ảnh (png, jpg, jpeg, webp, gif, svg)" });
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File quá lớn (tối đa 5MB)" });
  }
  res
    .status(err?.statusCode || 500)
    .json({ error: err?.message || "Internal Server Error" });
});

/* ---------- Start server ---------- */
const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`API up at http://localhost:${PORT}`);
});

export default app;
