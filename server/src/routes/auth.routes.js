import { Router } from "express";

import { login, logout, me, signup } from "../controllers/auth.controller.js";
import { asyncHandler } from "../lib/async-handler.js";
import { authRateLimit } from "../middleware/rate-limit.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/signup", authRateLimit, asyncHandler(signup));
router.post("/login", authRateLimit, asyncHandler(login));
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export { router as authRouter };
