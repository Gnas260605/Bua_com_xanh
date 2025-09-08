// backend/src/routes/auth.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import "dotenv/config";

/* =========================
   DB bootstrap (SQLite/MySQL)
========================= */
const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) {
  ({ db } = await import("../lib/db.mysql.js"));
} else {
  ({ db } = await import("../lib/db.js"));
}

export const authRouter = Router();

/* =========================
   Small DB helpers (driver-agnostic)
========================= */
async function dbGet(sql, params = []) {
  if (useMySQL) {
    if (typeof db.get === "function") return await db.get(sql, params);
    if (typeof db.query === "function") {
      const [rows] = await db.query(sql, params);
      return rows?.[0] ?? null;
    }
    throw new Error("MySQL adapter missing .get/.query");
  }
  return db.prepare(sql).get(...params);
}

async function dbRun(sql, params = []) {
  if (useMySQL) {
    if (typeof db.run === "function") return await db.run(sql, params);
    if (typeof db.query === "function") {
      const [ret] = await db.query(sql, params);
      return ret; // có .affectedRows
    }
    throw new Error("MySQL adapter missing .run/.query");
  }
  return db.prepare(sql).run(...params);
}

function nowFn() {
  return useMySQL ? "NOW()" : "CURRENT_TIMESTAMP";
}

/* =========================
   JWT helpers & middleware
========================= */
function signToken(user, remember) {
  const payload = {
    id: user.id,
    uid: user.id,         // giữ cả id & uid cho tương thích
    email: user.email,
    role: user.role,
  };
  const expiresIn = remember ? "30d" : "1d";
  return jwt.sign(payload, process.env.JWT_SECRET || "dev_secret", { expiresIn });
}

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ message: "Missing token" });
  try {
    const payload = jwt.verify(m[1], process.env.JWT_SECRET || "dev_secret");
    if (!payload?.id && payload?.uid) payload.id = payload.uid;
    if (!payload?.uid && payload?.id) payload.uid = payload.id;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

/* =========================
   Mail helpers (optional SMTP)
========================= */
async function sendMail({ to, subject, text, html }) {
  if (!process.env.SMTP_HOST) {
    // Fallback: không cấu hình SMTP → log
    console.log("[MAIL-FALLBACK]", { to, subject, text });
    return { ok: true, fallback: true };
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  const from = process.env.SMTP_FROM || "no-reply@buacomxanh.local";
  await transporter.sendMail({ from, to, subject, text, html });
  return { ok: true };
}

/* =========================
   Routes
========================= */

/**
 * POST /api/auth/register
 * body: {name, email, password, address}
 * return: {user, token}
 */
authRouter.post("/register", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const address = String(req.body?.address || "").trim();
    if (!name || !email || !password || !address) {
      return res.status(400).json({ message: "Thiếu thông tin" });
    }

    const existed = await dbGet("SELECT id FROM users WHERE email=?", [email]);
    if (existed) return res.status(409).json({ message: "Email đã tồn tại" });

    const { randomUUID } = await import("crypto");
    const id = randomUUID();
    const hash = await bcrypt.hash(password, 10);

    await dbRun(
      "INSERT INTO users (id, email, password_hash, name, role, address, status, created_at, updated_at) VALUES (?,?,?,?,?,?, 'active', " +
        `${nowFn()}, ${nowFn()})`,
      [id, email, hash, name, "user", address]
    );

    const user = await dbGet(
      "SELECT id,email,name,avatar_url,role,address,phone,status,lat,lng,created_at,updated_at FROM users WHERE id=?",
      [id]
    );

    const token = signToken(user, true);
    res.status(201).json({ user, token });
  } catch (e) {
    console.error("REGISTER_ERROR", e);
    res.status(500).json({ message: "Lỗi hệ thống khi đăng ký" });
  }
});

/**
 * POST /api/auth/login
 * body: {email, password, remember}
 * return: {user, token}
 */
authRouter.post("/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const remember = !!req.body?.remember;

    const userRow = await dbGet(
      "SELECT id,email,name,avatar_url,role,address,phone,status,lat,lng,password_hash FROM users WHERE email=?",
      [email]
    );
    if (!userRow) return res.status(401).json({ message: "Sai email hoặc mật khẩu" });
    if (userRow.status && userRow.status !== "active") {
      return res.status(403).json({ message: "Tài khoản chưa được phép đăng nhập" });
    }

    const ok = await bcrypt.compare(password, userRow.password_hash || "");
    if (!ok) return res.status(401).json({ message: "Sai email hoặc mật khẩu" });

    delete userRow.password_hash;
    const token = signToken(userRow, remember);
    res.json({ user: userRow, token });
  } catch (e) {
    console.error("LOGIN_ERROR", e);
    res.status(500).json({ message: "Lỗi hệ thống khi đăng nhập" });
  }
});

/**
 * POST /api/auth/logout
 * return: {ok:true}
 */
authRouter.post("/logout", (_req, res) => {
  // Nếu bạn có cơ chế session/refresh-token → revoke tại đây
  res.json({ ok: true });
});

/**
 * GET /api/auth/me
 * header: Authorization: Bearer <token>
 * return: {user}
 */
authRouter.get("/me", requireAuth, async (req, res) => {
  const row = await dbGet(
    "SELECT id,email,name,avatar_url,role,address,phone,status,lat,lng,created_at,updated_at FROM users WHERE id=?",
    [req.user.id]
  );
  if (!row) return res.status(404).json({ message: "User not found" });
  res.json({ user: row });
});

/**
 * POST /api/auth/change-password
 * header: Authorization: Bearer <token>
 * body: { new_password: string (>=8) }
 * return: {ok:true, message}
 *
 * Lưu ý:
 * - FE chỉ cần nhập mật khẩu mới 2 lần (validate phía FE). BE kiểm tra độ dài tối thiểu.
 * - Sau khi đổi thành công, hệ thống sẽ gửi email thông báo (hoặc fallback console).
 */
authRouter.post("/change-password", requireAuth, async (req, res) => {
  try {
    const newPassword = String(req.body?.new_password || "");
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: "Mật khẩu tối thiểu 8 ký tự" });
    }

    // Lấy người dùng hiện tại (để gửi mail)
    const user = await dbGet(
      "SELECT id,email,name FROM users WHERE id=?",
      [req.user.id]
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    // Hash và cập nhật
    const hash = await bcrypt.hash(newPassword, 10);
    const sql = `UPDATE users SET password_hash=?, updated_at=${nowFn()} WHERE id=?`;
    const ret = await dbRun(sql, [hash, user.id]);

    if (useMySQL && ret?.affectedRows === 0) {
      return res.status(500).json({ message: "Không cập nhật được mật khẩu" });
    }

    // Gửi email thông báo (không chặn flow nếu lỗi)
    const subj = "[Bữa Cơm Xanh] Mật khẩu của bạn đã được thay đổi";
    const text = `Xin chào${user.name ? " " + user.name : ""},

Mật khẩu tài khoản của bạn vừa được thay đổi thành công.

Nếu không phải bạn thực hiện, vui lòng bảo mật lại tài khoản ngay lập tức hoặc liên hệ quản trị viên.

— Hệ thống Bữa Cơm Xanh`;
    const html = `
      <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6">
        <p>Xin chào${user.name ? " <b>" + user.name + "</b>" : ""},</p>
        <p>Mật khẩu tài khoản của bạn vừa được <b>thay đổi thành công</b>.</p>
        <p>Nếu <i>không phải</i> bạn thực hiện, vui lòng bảo mật lại tài khoản ngay hoặc liên hệ quản trị viên.</p>
        <p style="color:#16a34a">— Hệ thống Bữa Cơm Xanh</p>
      </div>
    `;
    try {
      await sendMail({ to: user.email, subject: subj, text, html });
    } catch (mailErr) {
      console.warn("MAIL_SEND_ERROR", mailErr);
      // không fail request nếu gửi mail lỗi
    }

    return res.json({ ok: true, message: "Đã đổi mật khẩu và gửi email thông báo" });
  } catch (e) {
    console.error("CHANGE_PASSWORD_ERROR", e);
    return res.status(500).json({ message: "Lỗi hệ thống khi đổi mật khẩu" });
  }
});

/* =========================
   Exports
========================= */
export default authRouter;
export { authRouter as router };
