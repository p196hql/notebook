import "dotenv/config";

const readEnv = (key, fallback = "") => {
  const value = process.env[key];
  if (typeof value !== "string") return fallback;
  return value.trim() || fallback;
};

const readNumber = (key, fallback) => {
  const raw = readEnv(key, String(fallback));
  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${key} in server/.env`);
  }

  return value;
};

export const env = {
  nodeEnv: readEnv("NODE_ENV", "development"),
  port: readNumber("PORT", 4000),
  mongoUri: readEnv("MONGO_URI"),
  jwtSecret: readEnv("JWT_SECRET", "dev-secret"),
  clientUrl: readEnv("CLIENT_URL", "http://localhost:5173"),
  clientUrls: readEnv("CLIENT_URL", "http://localhost:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  cloudinary: {
    cloudName: readEnv("CLOUDINARY_CLOUD_NAME"),
    apiKey: readEnv("CLOUDINARY_API_KEY"),
    apiSecret: readEnv("CLOUDINARY_API_SECRET"),
  },
  uploadStorage: readEnv("UPLOAD_STORAGE", "cloudinary"),
  localUploadsBasePath: readEnv("LOCAL_UPLOADS_BASE_PATH", "/uploads"),
  aiProvider: {
    apiKey: readEnv("AI_API_KEY", readEnv("OPENAI_API_KEY", readEnv("OPENROUTER_API_KEY"))),
    baseUrl: readEnv(
      "AI_BASE_URL",
      readEnv(
        "OPENAI_BASE_URL",
        readEnv("OPENROUTER_API_KEY") ? "https://openrouter.ai/api/v1" : ""
      )
    ),
    llmModel: readEnv(
      "AI_LLM_MODEL",
      readEnv("OPENAI_LLM_MODEL", readEnv("OPENROUTER_LLM_MODEL"))
    ),
    rerankModel: readEnv("AI_RERANK_MODEL", readEnv("OPENROUTER_RERANK_MODEL")),
    embeddingModel: readEnv(
      "AI_EMBEDDING_MODEL",
      readEnv("OPENAI_EMBEDDING_MODEL", readEnv("OPENROUTER_EMBEDDING_MODEL"))
    ),
    appName: readEnv("AI_APP_NAME"),
    siteUrl: readEnv("AI_SITE_URL"),
  },
  qdrantPath: readEnv("QDRANT_PATH", "storage/rag/qdrant"),
  uploadsPath: readEnv("UPLOADS_PATH", "storage/rag/uploads"),
  ragServiceUrl: readEnv("RAG_SERVICE_URL", "http://127.0.0.1:8001"),
  ragServiceTimeoutMs: readNumber("RAG_SERVICE_TIMEOUT_MS", 120000),
};

if (!env.mongoUri) {
  throw new Error("Missing MONGO_URI in server/.env");
}

if (env.nodeEnv === "production" && env.jwtSecret === "dev-secret") {
  throw new Error("JWT_SECRET must be set to a strong value in production.");
}
