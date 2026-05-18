import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import multer from "multer";
import path from "node:path";

import { env } from "./config/env.js";
import { securityHeaders } from "./middleware/security.middleware.js";
import { router } from "./routes/index.js";

function apiNotFoundHandler(_req, res) {
  res.status(404).json({ message: "Route not found." });
}

function apiErrorHandler(err, _req, res, _next) {
  console.error(err);

  if (err?.code === 11000) {
    return res
      .status(409)
      .json({ message: "An account with that email already exists." });
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ message: "Each uploaded file must be 20MB or smaller." });
    }

    return res.status(400).json({ message: "Upload request is invalid." });
  }

  if (err.message === "CORS origin not allowed.") {
    return res.status(403).json({ message: err.message });
  }

  if (err?.name === "ValidationError") {
    return res.status(400).json({ message: "Request validation failed." });
  }

  if (err?.name === "CastError") {
    return res.status(400).json({ message: "Invalid request identifier." });
  }

  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ message: "Request body must be valid JSON." });
  }

  if (err?.expose && err?.message) {
    return res
      .status(Number.isInteger(err.statusCode) ? err.statusCode : 500)
      .json({ message: err.message });
  }

  return res.status(500).json({ message: "Something went wrong." });
}

function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.clientUrls.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error("CORS origin not allowed."));
      },
      credentials: true,
    }),
  );
  app.use(securityHeaders);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));
  app.use(cookieParser());
  app.use(
    env.localUploadsBasePath,
    express.static(path.resolve(process.cwd(), env.uploadsPath, "assets")),
  );

  app.use("/api", router);

  app.use("/api", apiNotFoundHandler);
  app.use(apiErrorHandler);

  return app;
}

export { apiErrorHandler, apiNotFoundHandler, createApp };
