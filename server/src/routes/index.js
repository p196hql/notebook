import { Router } from "express";

import { authRouter } from "./auth.routes.js";
import { notebookRouter } from "./notebook.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/auth", authRouter);
router.use("/notebooks", notebookRouter);

export { router };
