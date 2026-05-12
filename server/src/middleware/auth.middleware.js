import { User } from "../models/user.model.js";
import { readAuthCookie, verifyAuthToken } from "../lib/auth.js";

export async function requireAuth(req, res, next) {
  try {
    const token = readAuthCookie(req);

    if (!token) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const payload = verifyAuthToken(token);
    const user = await User.findById(payload.sub).select("-passwordHash");

    if (!user) {
      return res.status(401).json({ message: "Session is no longer valid." });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired session." });
  }
}
