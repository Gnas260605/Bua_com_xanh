export function requireRole(...roles) {
  return (req, res, next) => {
    const current = (req.user?.role || "").toLowerCase();
    // Admin luôn có tất cả quyền
    if (current === "admin") return next();
    if (!current || !roles.map(r => String(r).toLowerCase()).includes(current)) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    next();
  };
}
