import express from "express";
import mysql from "mysql2/promise";

const router = express.Router();
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DB || "bua_com_xanh",
  port: Number(process.env.MYSQL_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
});

// (Bạn có thể chèn middleware auth admin ở đây)

router.get("/", async (_req, res) => {
  const [rows] = await pool.query(
    "SELECT id, name, address, lat, lng, opening, status, created_at FROM pickup_points ORDER BY created_at DESC"
  );
  res.json(rows || []);
});

router.post("/", async (req, res) => {
  const { name, address = "", lat = null, lng = null, opening = "", status = "active" } = req.body || {};
  if (!name) return res.status(400).json({ error: "name is required" });
  const [r] = await pool.query(
    "INSERT INTO pickup_points (name, address, lat, lng, opening, status) VALUES (?, ?, ?, ?, ?, ?)",
    [name, address, lat, lng, opening, status === "inactive" ? "inactive" : "active"]
  );
  res.json({ ok: true, id: r.insertId });
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, address, lat, lng, opening, status } = req.body || {};
  if (!id) return res.status(400).json({ error: "invalid id" });

  const fields = [];
  const values = [];
  if (name != null) { fields.push("name=?"); values.push(name); }
  if (address != null) { fields.push("address=?"); values.push(address); }
  if (lat != null) { fields.push("lat=?"); values.push(lat); }
  if (lng != null) { fields.push("lng=?"); values.push(lng); }
  if (opening != null) { fields.push("opening=?"); values.push(opening); }
  if (status != null) { fields.push("status=?"); values.push(status === "inactive" ? "inactive" : "active"); }
  if (!fields.length) return res.json({ ok: true });

  values.push(id);
  await pool.query(`UPDATE pickup_points SET ${fields.join(", ")} WHERE id=?`, values);
  res.json({ ok: true });
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid id" });
  await pool.query("DELETE FROM pickup_points WHERE id=?", [id]);
  res.json({ ok: true });
});

export default router;
