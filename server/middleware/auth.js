import { verifyToken } from "../services/authService.js";

export async function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const user = await verifyToken(token);
  if (!user) return res.status(401).json({ ok: false, message: "Authentication required." });
  req.user = user;
  next();
}
