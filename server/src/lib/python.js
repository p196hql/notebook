import { env } from "../config/env.js";

function createPipelineError(message, statusCode = 502) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

export async function runPythonPipeline(command, payload) {
  const url = new URL(`/${command}`, env.ragServiceUrl).toString();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    env.ragServiceTimeoutMs,
  );

  let response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createPipelineError(
        "RAG service timed out while processing the request.",
        504,
      );
    }

    throw createPipelineError(
      `RAG service is unavailable at ${env.ragServiceUrl}. Start the Python service before chatting or processing notebooks.`,
      503,
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : { detail: await response.text() };

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.message ||
      `RAG service request failed with status ${response.status}`;

    throw createPipelineError(message, response.status);
  }

  return data;
}
