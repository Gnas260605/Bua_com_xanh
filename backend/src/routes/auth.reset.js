import { Router } from "express";
import bcrypt from "bcryptjs";
import { sendOtpMail } from "../lib/email.js";
import { db } from "../lib/db.mysql.js"; // nếu bạn dùng SQLite thì đổi sang ../lib/db.js

export const authResetRouter = Router();

// POST /api/auth/forgot-password  {email}
authResetRouter.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ message: "Missing email" });

  // Tạo OTP 6 chữ số, hết hạn 10 phút
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

  await db.run(
    "INSERT INTO password_resets (email, code, expires_at, used) VALUES (?,?,?,0)",
    [email, code, expiresAt]
  );

  try {
    await sendOtpMail(email, code);
  } catch (e) {
    console.error("MAIL_ERROR", e);
    return res.status(500).json({ message: "Không gửi được email OTP" });
  }

  res.json({ ok: true });
});

// POST /api/auth/verify-otp  {email, code}
authResetRouter.post("/verify-otp", async (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ message: "Thiếu email/code" });

  const row = await db.get(
    "SELECT * FROM password_resets WHERE email=? AND code=? AND used=0 ORDER BY id DESC LIMIT 1",
    [email, code]
  );
  if (!row) return res.status(400).json({ message: "OTP không hợp lệ" });
  if (new Date(row.expires_at) < new Date()) return res.status(400).json({ message: "OTP đã hết hạn" });

  res.json({ ok: true });
});

// POST /api/auth/reset-password  {email, code, newPassword}
authResetRouter.post("/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body || {};
  if (!email || !code || !newPassword) return res.status(400).json({ message: "Thiếu dữ liệu" });

  const row = await db.get(
    "SELECT * FROM password_resets WHERE email=? AND code=? AND used=0 ORDER BY id DESC LIMIT 1",
    [email, code]
  );
  if (!row) return res.status(400).json({ message: "OTP không hợp lệ" });
  if (new Date(row.expires_at) < new Date()) return res.status(400).json({ message: "OTP đã hết hạn" });

  const hash = await bcrypt.hash(newPassword, 10);

  await db.run("UPDATE users SET password_hash=? WHERE email=?", [hash, email]);
  await db.run("UPDATE password_resets SET used=1 WHERE id=?", [row.id]);

  res.json({ ok: true });
});
