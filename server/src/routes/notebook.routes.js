import fs from "node:fs/promises";
import path from "node:path";

import express from "express";
import multer from "multer";

import {
  createConversation,
  createNotebook,
  deleteConversation,
  deleteNotebook,
  getNotebook,
  listNotebooks,
  renameConversation,
  renameNotebook,
  sendNotebookChat,
} from "../controllers/notebook.controller.js";
import { env } from "../config/env.js";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  chatRateLimit,
  notebookWriteRateLimit,
} from "../middleware/rate-limit.middleware.js";
import { validateObjectIdParam } from "../middleware/validate-object-id.middleware.js";

const router = express.Router();

const tempUploadDir = path.resolve(process.cwd(), env.uploadsPath, "tmp");

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    fs.mkdir(tempUploadDir, { recursive: true })
      .then(() => cb(null, tempUploadDir))
      .catch((error) => cb(error));
  },
  filename(_req, file, cb) {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: {
    files: 12,
    fileSize: 20 * 1024 * 1024,
  },
  fileFilter(_req, file, cb) {
    const accepted =
      file.mimetype === "application/pdf" || file.mimetype.startsWith("image/");
    cb(
      accepted ? null : new Error("Only PDF and image files are supported."),
      accepted,
    );
  },
});

router.get("/", requireAuth, asyncHandler(listNotebooks));
router.post(
  "/",
  requireAuth,
  notebookWriteRateLimit,
  upload.array("files", 12),
  asyncHandler(createNotebook),
);
router.get(
  "/:notebookId",
  requireAuth,
  validateObjectIdParam("notebookId"),
  asyncHandler(getNotebook),
);
router.post(
  "/:notebookId/conversations",
  requireAuth,
  notebookWriteRateLimit,
  validateObjectIdParam("notebookId"),
  asyncHandler(createConversation),
);
router.patch(
  "/:notebookId",
  requireAuth,
  notebookWriteRateLimit,
  validateObjectIdParam("notebookId"),
  asyncHandler(renameNotebook),
);
router.patch(
  "/:notebookId/conversations/:conversationId",
  requireAuth,
  notebookWriteRateLimit,
  validateObjectIdParam("notebookId"),
  validateObjectIdParam("conversationId"),
  asyncHandler(renameConversation),
);
router.delete(
  "/:notebookId/conversations/:conversationId",
  requireAuth,
  notebookWriteRateLimit,
  validateObjectIdParam("notebookId"),
  validateObjectIdParam("conversationId"),
  asyncHandler(deleteConversation),
);
router.post(
  "/:notebookId/chat",
  requireAuth,
  chatRateLimit,
  validateObjectIdParam("notebookId"),
  asyncHandler(sendNotebookChat),
);
router.delete(
  "/:notebookId",
  requireAuth,
  notebookWriteRateLimit,
  validateObjectIdParam("notebookId"),
  asyncHandler(deleteNotebook),
);

export { router as notebookRouter };
