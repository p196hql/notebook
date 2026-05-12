import mongoose from "mongoose";

const citationSchema = new mongoose.Schema(
  {
    sourceName: { type: String, required: true },
    pageNumber: { type: Number, default: 1 },
    chunkIndex: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    quote: { type: String, default: "" },
  },
  { _id: false },
);

const notebookMessageSchema = new mongoose.Schema(
  {
    notebook: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notebook",
      required: true,
      index: true,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NotebookConversation",
      default: null,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    citations: {
      type: [citationSchema],
      default: [],
    },
  },
  { timestamps: true },
);

notebookMessageSchema.index({
  notebook: 1,
  user: 1,
  conversation: 1,
  createdAt: 1,
});
notebookMessageSchema.index({
  notebook: 1,
  user: 1,
  createdAt: -1,
});

export const NotebookMessage = mongoose.model(
  "NotebookMessage",
  notebookMessageSchema,
);
