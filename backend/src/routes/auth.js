import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import "dotenv/config";

// Tự chọn DB theo biến môi trường
const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) {
  ({ db } = await import("../lib/db.mysql.js"));
} else {
  ({ db } = await import("../lib/db.js"));
}

export const authRouter = Router();

// Tạo JWT
function signToken(user, remember) {
  const payload = { uid: user.id, email: user.email, role: user.role };
  const expiresIn = remember ? "30d" : "1d";
  return jwt.sign(payload, process.env.JWT_SECRET || "dev_secret", { expiresIn });
}

// Middleware xác thực Bearer token
function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ message: "Missing token" });
  try {
    req.user = jwt.verify(m[1], process.env.JWT_SECRET || "dev_secret");
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

/**
 * POST /api/auth/register
 * body: {name, email, password, address}
 * return: {user, token}
 */
authRouter.post("/register", async (req, res) => {
  try {
    const { name, email, password, address } = req.body || {};
    if (!name || !email || !password || !address) {
      return res.status(400).json({ message: "Thiếu thông tin" });
    }

    // Email unique
    const existed = await db.get("SELECT id FROM users WHERE email=?", [email]);
    if (existed) return res.status(409).json({ message: "Email đã tồn tại" });

    // Tạo id + hash
    const { randomUUID } = await import("crypto");
    const id = randomUUID();
    const hash = await bcrypt.hash(password, 10);

    // role mặc định: user
    await db.run(
      "INSERT INTO users (id, email, password_hash, name, role, address, status) VALUES (?,?,?,?,?,?, 'active')",
      [id, email, hash, name, "user", address]
    );

    const user = await db.get(
      "SELECT id, email, name, role, address, status, created_at, updated_at FROM users WHERE id=?",
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
    const { email, password, remember } = req.body || {};
    const user = await db.get(
      "SELECT id, email, name, role, address, status, password_hash FROM users WHERE email=?",
      [email]
    );
    if (!user) return res.status(401).json({ message: "Sai email hoặc mật khẩu" });
    if (user.status && user.status !== "active") {
      return res.status(403).json({ message: "Tài khoản chưa được phép đăng nhập" });
    }

    const ok = await bcrypt.compare(password || "", user.password_hash || "");
    if (!ok) return res.status(401).json({ message: "Sai email hoặc mật khẩu" });

    delete user.password_hash;
    const token = signToken(user, !!remember);
    res.json({ user, token });
  } catch (e) {
    console.error("LOGIN_ERROR", e);
    res.status(500).json({ message: "Lỗi hệ thống khi đăng nhập" });
  }
});

/**
 * POST /api/auth/logout
 * (JWT là stateless nên chỉ trả ok; frontend xoá token)
 */
authRouter.post("/logout", (req, res) => {
  res.json({ ok: true });
});

/**
 * GET /api/auth/me
 * header: Authorization: Bearer <token>
 * return: {user}
 */
authRouter.get("/me", requireAuth, async (req, res) => {
  const row = await db.get(
    "SELECT id, email, name, role, address, status, created_at, updated_at FROM users WHERE id=?",
    [req.user.uid]
  );
  if (!row) return res.status(404).json({ message: "User not found" });
  res.json({ user: row });
});

export default authRouter;
export { authRouter as router };

