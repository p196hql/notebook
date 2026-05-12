import fs from "node:fs/promises";
import mongoose from "mongoose";

import { runPythonPipeline } from "../lib/python.js";
import {
  deleteNotebookAsset,
  uploadNotebookAsset,
} from "../lib/cloudinary-upload.js";
import { NotebookConversation } from "../models/notebook-conversation.model.js";
import { NotebookMessage } from "../models/notebook-message.model.js";
import { Notebook } from "../models/notebook.model.js";

function serializeNotebook(notebook) {
  return {
    id: notebook._id.toString(),
    name: notebook.name,
    status: notebook.status,
    chunkCount: notebook.chunkCount,
    sourceFiles: notebook.sourceFiles,
    errorMessage: notebook.errorMessage,
    lastMessageAt: notebook.lastMessageAt,
    createdAt: notebook.createdAt,
    updatedAt: notebook.updatedAt,
  };
}

function serializeMessage(message) {
  return {
    id: message._id.toString(),
    conversationId: message.conversation?.toString?.() ?? null,
    role: message.role,
    content: message.content,
    citations: message.citations,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

function serializeConversation(conversation) {
  return {
    id: conversation._id.toString(),
    title: conversation.title,
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

function buildConversationTitle(input = "") {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "New chat";
  }

  return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized;
}

function normalizeNotebookName(value = "") {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeChatMessage(value = "") {
  return value.trim();
}

function normalizeConversationTitle(value = "") {
  return value.trim().replace(/\s+/g, " ");
}

async function removeTempFiles(files) {
  await Promise.all(
    files.map((file) =>
      fs.rm(file.path, { force: true }).catch(() => undefined),
    ),
  );
}

async function getOwnedNotebook(notebookId, userId) {
  return Notebook.findOne({ _id: notebookId, user: userId });
}

async function ensureLegacyConversation(notebookId, userId) {
  const existingConversation = await NotebookConversation.findOne({
    notebook: notebookId,
    user: userId,
  }).sort({ updatedAt: -1, createdAt: -1 });

  if (existingConversation) {
    return existingConversation;
  }

  const legacyMessages = await NotebookMessage.find({
    notebook: notebookId,
    user: userId,
    conversation: null,
  })
    .sort({ createdAt: 1 })
    .limit(1);

  if (legacyMessages.length === 0) {
    return null;
  }

  const conversation = await NotebookConversation.create({
    notebook: notebookId,
    user: userId,
    title: buildConversationTitle(legacyMessages[0].content),
    lastMessageAt: legacyMessages[0].createdAt,
  });

  await NotebookMessage.updateMany(
    {
      notebook: notebookId,
      user: userId,
      conversation: null,
    },
    {
      $set: {
        conversation: conversation._id,
      },
    },
  );

  const latestMessage = await NotebookMessage.findOne({
    notebook: notebookId,
    user: userId,
    conversation: conversation._id,
  }).sort({ createdAt: -1 });

  conversation.lastMessageAt =
    latestMessage?.createdAt ?? conversation.createdAt;
  await conversation.save();

  return conversation;
}

async function getOwnedConversation(conversationId, notebookId, userId) {
  if (!conversationId) {
    return null;
  }

  return NotebookConversation.findOne({
    _id: conversationId,
    notebook: notebookId,
    user: userId,
  });
}

function getCloudinaryResourceType(sourceFile) {
  const url = sourceFile.cloudinaryUrl ?? "";
  const uploadSegmentMatch = url.match(/\/(image|raw|video)\/upload\//);
  if (uploadSegmentMatch?.[1]) {
    return uploadSegmentMatch[1];
  }

  return sourceFile.mimeType?.startsWith("image/") ? "image" : "raw";
}

function toStoredSourceFile(file) {
  return {
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    cloudinaryUrl: file.cloudinaryUrl,
    cloudinaryPublicId: file.cloudinaryPublicId,
    pageCount: file.pageCount ?? 0,
    chunkCount: file.chunkCount ?? 0,
    characterCount: file.characterCount ?? 0,
    extractionStatus: file.extractionStatus ?? "indexed",
  };
}

async function removeNotebookAssets(sourceFiles) {
  const results = await Promise.allSettled(
    (sourceFiles ?? []).map(async (file) => {
      const resourceTypes = [
        getCloudinaryResourceType(file),
        "image",
        "raw",
        "video",
      ].filter((value, index, array) => array.indexOf(value) === index);

      let sawNotFound = false;

      for (const resourceType of resourceTypes) {
        const result = await deleteNotebookAsset(
          file.cloudinaryPublicId,
          resourceType,
        );

        if (result?.result === "ok") {
          return result;
        }

        if (result?.result === "not found") {
          sawNotFound = true;
          continue;
        }
      }

      if (sawNotFound) {
        return { result: "not found" };
      }

      throw new Error(
        `Cloudinary destroy returned no successful result for ${file.cloudinaryPublicId}.`,
      );
    }),
  );

  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    throw new Error(
      `Failed to delete ${failures.length} Cloudinary asset(s) for this notebook.`,
    );
  }
}

async function deleteNotebookData(notebook) {
  const notebookId = notebook._id.toString();

  await Promise.all([
    runPythonPipeline("delete-notebook", { notebookId }).catch((error) => {
      console.error(`[notebook:${notebookId}] failed to delete vectors`, error);
    }),
    removeNotebookAssets(notebook.sourceFiles),
    NotebookMessage.deleteMany({ notebook: notebook._id }),
    NotebookConversation.deleteMany({ notebook: notebook._id }),
  ]);

  await Notebook.deleteOne({ _id: notebook._id });
}

async function processNotebookInBackground(notebook, files) {
  console.info(`[notebook:${notebook._id}] background processing started`);
  const uploadedFiles = [];

  try {
    for (const file of files) {
      console.info(
        `[notebook:${notebook._id}] uploading file to Cloudinary: ${file.originalname}`,
      );
      const asset = await uploadNotebookAsset(file.path, file.originalname);

      uploadedFiles.push({
        localPath: file.path,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        cloudinaryUrl: asset.secure_url,
        cloudinaryPublicId: asset.public_id,
      });
    }

    notebook.sourceFiles = uploadedFiles.map(toStoredSourceFile);
    await notebook.save();

    console.info(
      `[notebook:${notebook._id}] starting ingestion pipeline for ${uploadedFiles.length} file(s)`,
    );
    const result = await runPythonPipeline("ingest", {
      notebookId: notebook._id.toString(),
      files: uploadedFiles,
    });

    notebook.status = "ready";
    notebook.chunkCount = result.chunkCount;
    notebook.sourceFiles = result.sourceFiles.map(toStoredSourceFile);
    notebook.errorMessage = "";
    await notebook.save();
    console.info(
      `[notebook:${notebook._id}] processing complete, ${result.chunkCount} chunks indexed`,
    );
  } catch (error) {
    notebook.status = "failed";
    notebook.sourceFiles = uploadedFiles.map(toStoredSourceFile);
    notebook.errorMessage = error.message;
    await notebook.save();
    console.error(`[notebook:${notebook._id}] processing failed`, error);
  } finally {
    await removeTempFiles(files);
  }
}

async function listNotebooks(req, res) {
  const userId = req.user._id;
  const notebookIds = await Notebook.find({ user: userId })
    .select({ _id: 1 })
    .sort({
      updatedAt: -1,
      createdAt: -1,
    })
    .lean();

  await Promise.all(
    notebookIds.map((notebook) =>
      ensureLegacyConversation(notebook._id, userId),
    ),
  );

  const [freshNotebooks, conversations] = await Promise.all([
    Notebook.find({ user: userId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean(),
    NotebookConversation.find({ user: userId })
      .sort({ updatedAt: -1, lastMessageAt: -1, createdAt: -1 })
      .lean(),
  ]);

  const conversationsByNotebook = conversations.reduce((acc, conversation) => {
    const key = conversation.notebook.toString();
    acc[key] ??= [];
    acc[key].push(serializeConversation(conversation));
    return acc;
  }, {});

  res.json({
    notebooks: freshNotebooks.map((notebook) => ({
      ...serializeNotebook(notebook),
      conversations: conversationsByNotebook[notebook._id.toString()] ?? [],
    })),
  });
}

async function createNotebook(req, res) {
  const name = normalizeNotebookName(req.body?.name ?? "");
  const files = req.files ?? [];

  if (!name) {
    await removeTempFiles(files);
    return res.status(400).json({ message: "Notebook name is required." });
  }

  if (name.length > 120) {
    await removeTempFiles(files);
    return res
      .status(400)
      .json({ message: "Notebook name must be 120 characters or less." });
  }

  if (files.length === 0) {
    await removeTempFiles(files);
    return res.status(400).json({ message: "At least one file is required." });
  }

  const notebook = await Notebook.create({
    user: req.user._id,
    name,
    status: "processing",
  });

  console.info(
    `[notebook:${notebook._id}] created in processing state for user ${req.user._id} with ${files.length} file(s)`,
  );

  processNotebookInBackground(notebook, files).catch((error) => {
    console.error(`[notebook:${notebook._id}] unexpected background error`, error);
  });

  return res.status(201).json({
    notebook: serializeNotebook(notebook),
  });
}

async function getNotebook(req, res) {
  const notebook = await getOwnedNotebook(req.params.notebookId, req.user._id);

  if (!notebook) {
    return res.status(404).json({ message: "Notebook not found." });
  }

  await ensureLegacyConversation(notebook._id, req.user._id);

  const requestedConversationId = req.query?.conversationId?.trim?.() ?? "";

  const conversations = await NotebookConversation.find({
    notebook: notebook._id,
    user: req.user._id,
  })
    .sort({ updatedAt: -1, lastMessageAt: -1, createdAt: -1 })
    .lean();

  const activeConversation =
    conversations.find(
      (conversation) => conversation._id.toString() === requestedConversationId,
    ) ?? null;

  const messages = activeConversation
    ? await NotebookMessage.find({
        notebook: notebook._id,
        user: req.user._id,
        conversation: activeConversation._id,
      })
        .sort({ createdAt: 1 })
        .lean()
    : [];

  res.json({
    notebook: serializeNotebook(notebook),
    conversations: conversations.map(serializeConversation),
    activeConversationId: activeConversation?._id.toString() ?? null,
    messages: messages.map(serializeMessage),
  });
}

async function createConversation(req, res) {
  const notebook = await getOwnedNotebook(req.params.notebookId, req.user._id);

  if (!notebook) {
    return res.status(404).json({ message: "Notebook not found." });
  }

  const title = buildConversationTitle(req.body?.title ?? "");

  const conversation = await NotebookConversation.create({
    notebook: notebook._id,
    user: req.user._id,
    title,
  });

  res.status(201).json({
    conversation: serializeConversation(conversation),
  });
}

async function renameNotebook(req, res) {
  const notebook = await getOwnedNotebook(req.params.notebookId, req.user._id);

  if (!notebook) {
    return res.status(404).json({ message: "Notebook not found." });
  }

  const name = normalizeNotebookName(req.body?.name ?? "");

  if (!name) {
    return res.status(400).json({ message: "Notebook name is required." });
  }

  if (name.length > 120) {
    return res
      .status(400)
      .json({ message: "Notebook name must be 120 characters or less." });
  }

  notebook.name = name;
  await notebook.save();

  res.json({
    notebook: serializeNotebook(notebook),
    message: "Notebook renamed.",
  });
}

async function renameConversation(req, res) {
  const notebook = await getOwnedNotebook(req.params.notebookId, req.user._id);

  if (!notebook) {
    return res.status(404).json({ message: "Notebook not found." });
  }

  const conversation = await getOwnedConversation(
    req.params.conversationId,
    notebook._id,
    req.user._id,
  );

  if (!conversation) {
    return res.status(404).json({ message: "Conversation not found." });
  }

  const title = normalizeConversationTitle(req.body?.title ?? "");

  if (!title) {
    return res.status(400).json({ message: "Chat name is required." });
  }

  if (title.length > 120) {
    return res
      .status(400)
      .json({ message: "Chat name must be 120 characters or less." });
  }

  conversation.title = title;
  await conversation.save();

  res.json({
    conversation: serializeConversation(conversation),
    message: "Chat renamed.",
  });
}

async function deleteConversation(req, res) {
  const notebook = await getOwnedNotebook(req.params.notebookId, req.user._id);

  if (!notebook) {
    return res.status(404).json({ message: "Notebook not found." });
  }

  const conversation = await getOwnedConversation(
    req.params.conversationId,
    notebook._id,
    req.user._id,
  );

  if (!conversation) {
    return res.status(404).json({ message: "Conversation not found." });
  }

  await Promise.all([
    NotebookMessage.deleteMany({
      notebook: notebook._id,
      user: req.user._id,
      conversation: conversation._id,
    }),
    NotebookConversation.deleteOne({ _id: conversation._id }),
  ]);

  const [latestConversation, latestNotebookMessage] = await Promise.all([
    NotebookConversation.findOne({
      notebook: notebook._id,
      user: req.user._id,
    }).sort({ updatedAt: -1, lastMessageAt: -1, createdAt: -1 }),
    NotebookMessage.findOne({
      notebook: notebook._id,
      user: req.user._id,
    }).sort({ createdAt: -1 }),
  ]);

  notebook.lastMessageAt = latestNotebookMessage?.createdAt ?? null;
  await notebook.save();

  res.json({
    deletedConversationId: req.params.conversationId,
    nextConversationId: latestConversation?._id.toString() ?? null,
  });
}

function createSendNotebookChat(deps = {}) {
  const {
    getOwnedNotebookFn = getOwnedNotebook,
    getOwnedConversationFn = getOwnedConversation,
    notebookConversationModel = NotebookConversation,
    notebookMessageModel = NotebookMessage,
    runPythonPipelineFn = runPythonPipeline,
  } = deps;

  return async function sendNotebookChat(req, res) {
    const notebook = await getOwnedNotebookFn(
      req.params.notebookId,
      req.user._id,
    );

    if (!notebook) {
      return res.status(404).json({ message: "Notebook not found." });
    }

    if (notebook.status !== "ready") {
      return res
        .status(400)
        .json({ message: "Notebook is not ready to chat yet." });
    }

    const message = normalizeChatMessage(req.body?.message ?? "");
    const conversationId = req.body?.conversationId?.trim?.() ?? "";

    if (!message) {
      return res.status(400).json({ message: "Message is required." });
    }

    if (message.length > 12000) {
      return res
        .status(400)
        .json({ message: "Message must be 12000 characters or less." });
    }

    if (conversationId && !mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({ message: "Invalid conversationId." });
    }

    let conversation = conversationId
      ? await getOwnedConversationFn(conversationId, notebook._id, req.user._id)
      : null;

    if (conversationId && !conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    const recentMessages = conversation
      ? await notebookMessageModel
          .find({
            notebook: notebook._id,
            user: req.user._id,
            conversation: conversation._id,
          })
          .select({ role: 1, content: 1 })
          .sort({ createdAt: -1 })
          .limit(8)
          .lean()
      : [];

    const result = await runPythonPipelineFn("chat", {
      notebookId: notebook._id.toString(),
      notebookName: notebook.name,
      query: message,
      history: recentMessages
        .reverse()
        .map((entry) => ({ role: entry.role, content: entry.content })),
    });

    if (!conversation) {
      conversation = await notebookConversationModel.create({
        notebook: notebook._id,
        user: req.user._id,
        title: "New chat",
      });
    }

    const userMessage = await notebookMessageModel.create({
      notebook: notebook._id,
      conversation: conversation._id,
      user: req.user._id,
      role: "user",
      content: message,
    });

    const assistantMessage = await notebookMessageModel.create({
      notebook: notebook._id,
      conversation: conversation._id,
      user: req.user._id,
      role: "assistant",
      content: result.answer,
      citations: result.citations,
    });

    if (!conversation.lastMessageAt && conversation.title === "New chat") {
      conversation.title = buildConversationTitle(message);
    }

    conversation.lastMessageAt = assistantMessage.createdAt;
    await conversation.save();

    notebook.lastMessageAt = assistantMessage.createdAt;
    await notebook.save();

    res.json({
      conversation: serializeConversation(conversation),
      userMessage: serializeMessage(userMessage),
      assistantMessage: serializeMessage(assistantMessage),
    });
  };
}

const sendNotebookChat = createSendNotebookChat();

async function deleteNotebook(req, res) {
  const notebook = await getOwnedNotebook(req.params.notebookId, req.user._id);

  if (!notebook) {
    return res.status(404).json({ message: "Notebook not found." });
  }

  await deleteNotebookData(notebook);

  res.json({
    deletedNotebookId: req.params.notebookId,
    message: "Notebook deleted.",
  });
}

export {
  createSendNotebookChat,
  createConversation,
  createNotebook,
  deleteConversation,
  deleteNotebook,
  getNotebook,
  listNotebooks,
  renameConversation,
  renameNotebook,
  sendNotebookChat,
};
