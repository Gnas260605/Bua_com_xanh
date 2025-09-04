import jwt from "jsonwebtoken";
import "dotenv/config";

export function requireAuth(req, res, next) {
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

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next({ status: 403, message: "Forbidden" });
    }
    next();
  };
}
