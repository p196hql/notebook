import mongoose from "mongoose";

const notebookConversationSchema = new mongoose.Schema(
  {
    notebook: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notebook",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: "New chat",
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

notebookConversationSchema.index({
  notebook: 1,
  user: 1,
  updatedAt: -1,
  lastMessageAt: -1,
  createdAt: -1,
});

export const NotebookConversation = mongoose.model(
  "NotebookConversation",
  notebookConversationSchema,
);
