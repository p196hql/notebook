import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { cloudinary } from "../config/cloudinary.js";
import { env } from "../config/env.js";

const localAssetsDir = path.resolve(process.cwd(), env.uploadsPath, "assets");

function sanitizeFilename(value = "") {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function buildLocalAssetName(originalName) {
  const extension = path.extname(originalName);
  const baseName = path.basename(originalName, extension);
  const safeBaseName = sanitizeFilename(baseName) || "upload";
  const suffix = crypto.randomBytes(6).toString("hex");
  return `${Date.now()}-${suffix}-${safeBaseName}${extension}`;
}

async function uploadLocalNotebookAsset(filePath, originalName) {
  await fs.mkdir(localAssetsDir, { recursive: true });

  const assetName = buildLocalAssetName(originalName);
  const targetPath = path.join(localAssetsDir, assetName);
  await fs.rename(filePath, targetPath);

  return {
    secure_url: `${env.localUploadsBasePath}/${assetName}`,
    public_id: assetName,
    local_path: targetPath,
  };
}

async function deleteLocalNotebookAsset(publicId) {
  if (!publicId) {
    return { result: "not found" };
  }

  await fs.rm(path.join(localAssetsDir, publicId), { force: true });
  return { result: "ok" };
}

export async function uploadNotebookAsset(filePath, originalName) {
  if (env.uploadStorage === "local") {
    return uploadLocalNotebookAsset(filePath, originalName);
  }

  return cloudinary.uploader.upload(filePath, {
    folder: "notebook-assets",
    resource_type: "auto",
    use_filename: true,
    unique_filename: true,
    filename_override: originalName,
  });
}

export async function deleteNotebookAsset(publicId, resourceType = "raw") {
  if (env.uploadStorage === "local") {
    return deleteLocalNotebookAsset(publicId);
  }

  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });
}
