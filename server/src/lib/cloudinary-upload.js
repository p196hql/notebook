import { cloudinary } from "../config/cloudinary.js";

export async function uploadNotebookAsset(filePath, originalName) {
  return cloudinary.uploader.upload(filePath, {
    folder: "notebook-assets",
    resource_type: "auto",
    use_filename: true,
    unique_filename: true,
    filename_override: originalName,
  });
}

export async function deleteNotebookAsset(publicId, resourceType = "raw") {
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });
}
