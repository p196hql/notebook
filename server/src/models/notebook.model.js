import mongoose from "mongoose";

const sourceFileSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    cloudinaryUrl: { type: String, required: true },
    cloudinaryPublicId: { type: String, required: true },
    pageCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    characterCount: { type: Number, default: 0 },
    extractionStatus: {
      type: String,
      enum: ["indexed", "partial", "unsupported"],
      default: "indexed",
    },
  },
  { _id: false },
);

const notebookSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: ["processing", "ready", "failed"],
      default: "processing",
      index: true,
    },
    chunkCount: {
      type: Number,
      default: 0,
    },
    sourceFiles: {
      type: [sourceFileSchema],
      default: [],
    },
    errorMessage: {
      type: String,
      default: "",
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

notebookSchema.index({ user: 1, updatedAt: -1, createdAt: -1 });
notebookSchema.index({ user: 1, lastMessageAt: -1, updatedAt: -1 });

export const Notebook = mongoose.model("Notebook", notebookSchema);
