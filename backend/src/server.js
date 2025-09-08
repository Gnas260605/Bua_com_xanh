// src/server.js (ESM)
import express from "express";
import cors from "cors";
import morgan from "morgan";
import "dotenv/config";

import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import { authResetRouter } from "./routes/auth.reset.js";
import usersRouter from "./routes/users.js";
import overviewRouter from "./routes/overview.js";
import foodsRouter from "./routes/foods.js";
import campaignsRouter from "./routes/campaigns.js";
import donorsRouter from "./routes/donors.js";
import recipientsRouter from "./routes/recipients.js";
import shippersRouter from "./routes/shippers.js";
import uploadRouter from "./routes/upload.js";          
import path from "path";
import { fileURLToPath } from "url";
import { ensureMySQLSchema } from "./lib/ensure-mysql.js";
import adminRouter from "./routes/admin.js";
await ensureMySQLSchema();

const app = express();

// CORS
const origins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(s => s.trim())
  : ["http://localhost:5173"];
app.use(cors({ origin: origins, credentials: true }));

app.use(express.json());
app.use(morgan("dev"));

// ESM __dirname để serve static
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static uploads
app.use("/uploads", express.static(path.resolve(__dirname, "..", "uploads"))); // 👈 cho phép GET ảnh

// Mount API routers
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/auth", authResetRouter);
app.use("/api/users", usersRouter);
app.use("/api/overview", overviewRouter);
app.use("/api/foods", foodsRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/donors", donorsRouter);
app.use("/api/recipients", recipientsRouter);
app.use("/api/shippers", shippersRouter);
app.use("/api", uploadRouter);                              // 👈 mount /api/upload
app.use("/api/admin", adminRouter);

// Friendly root
app.get("/", (_req, res) => res.send("BuaComXanh API is running. Try GET /api/health"));

// 404 & error handlers
app.use((req, res) => res.status(404).json({ error: "Not Found", path: req.originalUrl }));
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.message === "ONLY_IMAGE_ALLOWED") {
    return res.status(400).json({ error: "Chỉ cho phép file ảnh (png, jpg, jpeg, webp, gif, svg)" });
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File quá lớn (tối đa 5MB)" });
  }
  res.status(500).json({ error: "Internal Server Error" });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => console.log(`API up at http://localhost:${PORT}`));
