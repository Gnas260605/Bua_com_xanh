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
import { ensureMySQLSchema } from "./lib/ensure-mysql.js";

await ensureMySQLSchema();

const app = express();

// CORS
const origins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(s => s.trim())
  : ["http://localhost:5173"];
app.use(
  cors({
    origin: origins,
    credentials: true, // nếu bạn dùng cookie/session từ FE; nếu không thì để false
  })
);

app.use(express.json());
app.use(morgan("dev"));

// Mount tất cả router dưới /api
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

// Friendly root
app.get("/", (_req, res) => res.send("BuaComXanh API is running. Try GET /api/health"));

// 404 fallback (optional)
app.use((req, res) => {
  res.status(404).json({ error: "Not Found", path: req.originalUrl });
});

// Error handler (optional)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => console.log(`API up at http://localhost:${PORT}`));
