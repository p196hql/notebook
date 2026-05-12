const buckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
}

function rateLimit({ keyPrefix, windowMs, maxRequests, message }) {
  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const key = `${keyPrefix}:${getClientIp(req)}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });

      return next();
    }

    if (current.count >= maxRequests) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000),
      );

      res.setHeader("Retry-After", retryAfterSeconds.toString());
      return res.status(429).json({ message });
    }

    current.count += 1;
    return next();
  };
}

const authRateLimit = rateLimit({
  keyPrefix: "auth",
  windowMs: 10 * 60 * 1000,
  maxRequests: 20,
  message: "Too many authentication attempts. Try again shortly.",
});

const chatRateLimit = rateLimit({
  keyPrefix: "chat",
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: "Too many chat requests. Slow down and try again in a minute.",
});

const notebookWriteRateLimit = rateLimit({
  keyPrefix: "notebook-write",
  windowMs: 10 * 60 * 1000,
  maxRequests: 20,
  message: "Too many notebook changes. Try again shortly.",
});

function clearRateLimitBuckets() {
  buckets.clear();
}

export {
  authRateLimit,
  chatRateLimit,
  clearRateLimitBuckets,
  notebookWriteRateLimit,
};
