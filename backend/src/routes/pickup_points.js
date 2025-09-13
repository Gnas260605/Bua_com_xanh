import express from "express";
import mysql from "mysql2/promise";

const router = express.Router();

function getPool() {
  return mysql.createPool({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DB || "bua_com_xanh",
    port: Number(process.env.MYSQL_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10,
  });
}
const pool = getPool();

/**
 * GET /api/pickup-points?active=1
 * Trả về mảng [{id,name,address,lat,lng,open_hours,status}]
 */
router.get("/", async (req, res) => {
  try {
    const activeOnly = String(req.query.active || "1") === "1";
    const [rows] = await pool.query(
      activeOnly
        ? "SELECT id, name, address, lat, lng, opening AS open_hours, status FROM pickup_points WHERE status='active' ORDER BY created_at DESC"
        : "SELECT id, name, address, lat, lng, opening AS open_hours, status FROM pickup_points ORDER BY created_at DESC"
    );
    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to load pickup points" });
  }
});

export default router;
