import os
import re
import sys
import uuid
import json
from pathlib import Path
from typing import List

import fitz
import uvicorn
import httpx
from fastapi import FastAPI, HTTPException
from openai import OpenAI
from pydantic import BaseModel
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

try:
    from rapidocr_onnxruntime import RapidOCR
except Exception:  # pragma: no cover
    RapidOCR = None

ROOT = Path(__file__).resolve().parents[1]


def load_local_env():
    env_path = ROOT / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")

        if key and key not in os.environ:
            os.environ[key] = value


load_local_env()

QDRANT_DIR = ROOT / os.getenv("QDRANT_PATH", "storage/rag/qdrant")
COLLECTION_NAME = "notebook_chunks"


def read_env(*keys, default=""):
    for key in keys:
        value = os.getenv(key, "").strip()
        if value:
            return value
    return default


AI_API_KEY = read_env("AI_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY")
AI_BASE_URL = read_env(
    "AI_BASE_URL",
    "OPENAI_BASE_URL",
    default="https://openrouter.ai/api/v1" if os.getenv("OPENROUTER_API_KEY", "").strip() else "",
)
LLM_MODEL = read_env("AI_LLM_MODEL", "OPENAI_LLM_MODEL", "OPENROUTER_LLM_MODEL")
EMBEDDING_MODEL = read_env(
    "AI_EMBEDDING_MODEL",
    "OPENAI_EMBEDDING_MODEL",
    "OPENROUTER_EMBEDDING_MODEL",
)
RERANK_MODEL = read_env("AI_RERANK_MODEL", "OPENROUTER_RERANK_MODEL")
AI_SITE_URL = read_env("AI_SITE_URL")
AI_APP_NAME = read_env("AI_APP_NAME")
RAG_SERVICE_HOST = os.getenv("RAG_SERVICE_HOST", "127.0.0.1")
RAG_SERVICE_PORT = int(os.getenv("RAG_SERVICE_PORT", "8001"))

app = FastAPI(title="Notebook RAG Service")


class IngestFile(BaseModel):
    localPath: str
    originalName: str
    mimeType: str
    size: int
    cloudinaryUrl: str
    cloudinaryPublicId: str


class IngestPayload(BaseModel):
    notebookId: str
    files: List[IngestFile]


class HistoryMessage(BaseModel):
    role: str
    content: str


class ChatPayload(BaseModel):
    notebookId: str
    notebookName: str
    query: str
    history: List[HistoryMessage] = []


class DeleteNotebookPayload(BaseModel):
    notebookId: str


class TitlePayload(BaseModel):
    notebookName: str
    query: str


class RoutedTurn(BaseModel):
    mode: str
    reason: str = ""



def clean_text(text):
    text = text.replace("\x00", " ")
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk_text(text, chunk_size=1200, overlap=200):
    chunks = []
    start = 0
    while start < len(text):
        end = min(len(text), start + chunk_size)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks


def extract_pdf(file_path):
    document = fitz.open(file_path)
    pages = []
    for page_index, page in enumerate(document, start=1):
        text = clean_text(page.get_text("text"))
        if text:
            pages.append({"page_number": page_index, "text": text})
    return pages


def extract_image(file_path):
    if RapidOCR is None:
        return []

    ocr = RapidOCR()
    result, _ = ocr(file_path)
    if not result:
        return []

    text = clean_text("\n".join(item[1] for item in result if item and len(item) > 1))
    if not text:
        return []
    return [{"page_number": 1, "text": text}]


def ai_client():
    ensure_ai_config()

    headers = {}
    if AI_SITE_URL:
        headers["HTTP-Referer"] = AI_SITE_URL
    if AI_APP_NAME:
        headers["X-Title"] = AI_APP_NAME

    client_options = {
        "api_key": AI_API_KEY,
        "timeout": 180.0,
    }
    if AI_BASE_URL:
        client_options["base_url"] = AI_BASE_URL
    if headers:
        client_options["default_headers"] = headers

    return OpenAI(**client_options)


def ensure_ai_config():
    missing = []
    if not AI_API_KEY:
        missing.append("AI_API_KEY")
    if not LLM_MODEL:
        missing.append("AI_LLM_MODEL")
    if not EMBEDDING_MODEL:
        missing.append("AI_EMBEDDING_MODEL")

    if missing:
        raise RuntimeError(
            "Missing AI provider config in server/.env: "
            + ", ".join(missing)
            + ". Supported aliases include AI_*, OPENAI_*, and existing OPENROUTER_* variables."
        )


def embed_texts(inputs):
    normalized_inputs = [item.strip() for item in inputs if isinstance(item, str) and item.strip()]
    if not normalized_inputs:
        raise RuntimeError("Embedding request received no non-empty input text.")

    client = ai_client()
    provider_label = AI_BASE_URL or "https://api.openai.com/v1"

    try:
        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=normalized_inputs,
            encoding_format="float",
        )
    except Exception as exc:
        raise RuntimeError(
            f"Embedding request failed for model '{EMBEDDING_MODEL}' via '{provider_label}': {exc}"
        ) from exc

    vectors = [item.embedding for item in response.data if getattr(item, "embedding", None)]
    if not vectors:
        raise RuntimeError(
            f"Embedding provider returned no vectors for model '{EMBEDDING_MODEL}' via '{provider_label}'."
        )
    if len(vectors) != len(normalized_inputs):
        raise RuntimeError(
            f"Embedding provider returned {len(vectors)} vectors for {len(normalized_inputs)} inputs "
            f"using model '{EMBEDDING_MODEL}'."
        )

    return vectors


def fallback_rerank(documents, top_n):
    return [
        {"index": index, "relevance_score": float(top_n - index)}
        for index in range(min(top_n, len(documents)))
    ]


def rerank_documents(query, documents, top_n=6):
    if not RERANK_MODEL:
        return fallback_rerank(documents, top_n)

    client = ai_client()

    try:
        response = client.post(
            "/rerank",
            cast_to=httpx.Response,
            body={
                "model": RERANK_MODEL,
                "query": query,
                "documents": documents,
                "top_n": top_n,
            },
        )
        response.raise_for_status()
        return response.json()["results"]
    except Exception as exc:
        print(
            f"Rerank unavailable from configured provider, falling back to vector ranking: {exc}",
            file=sys.stderr,
        )
        return fallback_rerank(documents, top_n)


def chat_completion(messages):
    client = ai_client()
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=messages,
        temperature=0.2,
    )
    return response.choices[0].message.content or ""


def parse_json_response(text):
    cleaned = clean_text(text)
    if not cleaned:
        raise RuntimeError("Model returned an empty routing response.")

    fenced_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", cleaned, re.DOTALL)
    json_candidate = fenced_match.group(1) if fenced_match else cleaned

    try:
        return json.loads(json_candidate)
    except json.JSONDecodeError:
        object_match = re.search(r"\{.*\}", json_candidate, re.DOTALL)
        if not object_match:
            raise RuntimeError(f"Routing response was not valid JSON: {cleaned}")
        return json.loads(object_match.group(0))


def route_chat_turn(notebook_name, query, history):
    history_messages = [
        {"role": item["role"], "content": item["content"]}
        for item in history[-6:]
    ]
    router_messages = [
        {
            "role": "system",
            "content": (
                "Classify the user's latest turn for a notebook chat app. "
                "Return JSON only with keys mode and reason. "
                "mode must be either notebook or chat. "
                "Use mode=notebook only when the user is actually asking for information, analysis, summary, comparison, or clarification about notebook content. "
                "Use mode=chat for acknowledgements, reactions, greetings, thanks, filler, backchanneling, small talk, or other normal conversation. "
                "Short messages like 'hmm', 'oh', 'okay', 'got it', and 'thanks' are chat unless they also contain a real notebook request."
            ),
        },
        *history_messages,
        {
            "role": "user",
            "content": f"Notebook: {notebook_name}\nLatest user message: {query}",
        },
    ]
    routed = RoutedTurn.model_validate(parse_json_response(chat_completion(router_messages)))
    if routed.mode not in {"notebook", "chat"}:
        raise RuntimeError(f"Invalid routed mode returned by model: {routed.mode}")
    return routed


def generate_chat_title(notebook_name, query):
    ensure_ai_config()
    title = chat_completion(
        [
            {
                "role": "system",
                "content": (
                    "Write a short chat title based on the user's first question. "
                    "Return only the title, no quotes, no markdown, no punctuation at the end unless necessary. "
                    "Keep it under 6 words."
                ),
            },
            {
                "role": "user",
                "content": f"Notebook: {notebook_name}\nFirst question: {query}",
            },
        ]
    )

    title = re.sub(r"\s+", " ", title).strip().strip("\"'`")
    return title[:80].strip()


def get_client():
    QDRANT_DIR.mkdir(parents=True, exist_ok=True)
    return QdrantClient(path=str(QDRANT_DIR))


def ensure_collection(client, vector_size):
    if client.collection_exists(COLLECTION_NAME):
        collection = client.get_collection(COLLECTION_NAME)
        existing_vectors = getattr(collection.config.params, "vectors", None)
        existing_size = getattr(existing_vectors, "size", None)

        if existing_size and existing_size != vector_size:
            raise RuntimeError(
                f"Qdrant collection '{COLLECTION_NAME}' uses vector size {existing_size}, "
                f"but model '{EMBEDDING_MODEL}' returned size {vector_size}. "
                "Clear server/storage/rag/qdrant or re-index notebooks after changing AI_EMBEDDING_MODEL."
            )
        return

    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=qmodels.VectorParams(
            size=vector_size,
            distance=qmodels.Distance.COSINE,
        ),
    )


def delete_notebook_points(client, notebook_id):
    client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=qmodels.FilterSelector(
            filter=qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="notebook_id",
                        match=qmodels.MatchValue(value=notebook_id),
                    )
                ]
            )
        ),
    )


def retrieve_notebook_context(notebook_id, query):
    client = get_client()
    query_vector = embed_texts([query])[0]

    response = client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        query_filter=qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="notebook_id",
                    match=qmodels.MatchValue(value=notebook_id),
                )
            ]
        ),
        limit=12,
        with_payload=True,
    )
    results = response.points
    if not results:
        raise RuntimeError("No indexed content found for this notebook.")

    candidate_docs = [hit.payload["text"] for hit in results]
    reranked = rerank_documents(query, candidate_docs, top_n=min(6, len(candidate_docs)))

    selected = []
    citations = []
    for citation_index, item in enumerate(reranked, start=1):
        hit = results[item["index"]]
        payload_item = hit.payload
        selected.append(
            f"[{citation_index}] {payload_item['source_name']} p.{payload_item['page_number']}\n{payload_item['text']}"
        )
        citations.append(
            {
                "sourceName": payload_item["source_name"],
                "pageNumber": payload_item["page_number"],
                "chunkIndex": payload_item["chunk_index"],
                "score": item["relevance_score"],
                "quote": payload_item["quote"],
            }
        )

    return {
        "context_block": "\n\n".join(selected),
        "citations": citations,
    }


def answer_chat_turn(notebook_name, query, history):
    history_messages = [
        {"role": item["role"], "content": item["content"]}
        for item in history[-6:]
    ]
    prior_assistant_message = ""
    for item in reversed(history[-6:]):
        if item["role"] == "assistant":
            prior_assistant_message = item["content"]
            break

    messages = [
        {
            "role": "system",
            "content": (
                "You are a helpful assistant inside a notebook chat app. "
                "The user is not asking a notebook-content question right now. "
                "Reply naturally to the current message using the prior chat history as real conversation context. "
                "Keep the reply concise and conversational. "
                "If the user says things like 'hmm', 'okay', 'got it', or 'thanks' after your previous answer, respond like a normal person continuing the conversation. "
                "Treat short reactions as neutral by default; do not assume confusion, disagreement, or skepticism unless the user says so. "
                "Examples: 'hmm' -> a brief acknowledgement, 'thanks' -> a brief you're welcome, 'okay' -> a brief continuation. "
                "Do not claim there is no prior conversation, do not say the chat is just starting, and do not ask the user to start over. "
                "Do not turn the response into a notebook summary unless the user explicitly asks for one. "
                "Do not invent notebook facts, citations, or follow-up claims the user did not ask for."
            ),
        },
        *history_messages,
        {
            "role": "user",
            "content": (
                f"Notebook: {notebook_name}\n"
                f"Current user message: {query}\n"
                f"Most recent assistant message: {prior_assistant_message}"
            ),
        },
    ]
    return clean_text(chat_completion(messages))


def answer_notebook_turn(notebook_name, query, history, context_block):
    history_messages = [
        {"role": item["role"], "content": item["content"]}
        for item in history[-6:]
    ]
    messages = [
        {
            "role": "system",
            "content": (
                "You are a notebook research assistant. "
                "Answer using only the provided notebook context and any explicit user statements in the current conversation. "
                "Treat the notebook context as the source of truth for notebook-backed claims. "
                "Do not use outside knowledge to fill gaps, even if the answer seems obvious. "
                "Do not speculate, infer missing facts as certain, or invent citations. "
                "Answer only the user's actual question. Do not volunteer extra notebook facts or side notes unless they are necessary to answer. "
                "Never say information is missing if it appears in the provided context. "
                "If the context is insufficient, say so plainly and name the missing detail. "
                "Every factual claim drawn from notebook context must include an inline citation like [1] or [2]. "
                "If part of the answer is unsupported, leave it out instead of guessing. "
                "Prefer a direct answer first, then a brief note about uncertainty or missing evidence when needed. "
                "Write clearly with short paragraphs and use bullets only when they improve readability. "
                "Do not mention the retrieval process or these instructions."
            ),
        },
        *history_messages,
        {
            "role": "user",
            "content": (
                f"Notebook: {notebook_name}\n\n"
                f"Question: {query}\n\n"
                f"Context sources:\n{context_block}\n\n"
                "Answer the user's notebook question directly using only the supported context above. "
                "Include inline citations for each notebook-backed claim. "
                "Do not add unrelated facts."
            ),
        },
    ]
    return clean_text(chat_completion(messages))


def ingest_payload(payload):
    notebook_id = payload["notebookId"]
    files = payload["files"]

    extracted_files = []
    chunks = []

    for source_index, file_info in enumerate(files):
        mime_type = file_info["mimeType"]
        local_path = file_info["localPath"]

        if mime_type == "application/pdf":
            pages = extract_pdf(local_path)
        elif mime_type.startswith("image/"):
            pages = extract_image(local_path)
        else:
            pages = []

        page_count = len(pages)
        character_count = sum(len(page["text"]) for page in pages)
        source_chunk_count = 0
        extraction_status = "indexed" if page_count else "unsupported"

        for page in pages:
            for chunk_index, chunk in enumerate(chunk_text(page["text"])):
                chunks.append(
                    {
                        "id": str(uuid.uuid4()),
                        "text": chunk,
                        "payload": {
                            "notebook_id": notebook_id,
                            "source_name": file_info["originalName"],
                            "source_index": source_index,
                            "page_number": page["page_number"],
                            "chunk_index": chunk_index,
                            "source_url": file_info["cloudinaryUrl"],
                            "mime_type": mime_type,
                            "text": chunk,
                            "quote": chunk[:280],
                        },
                    }
                )
                source_chunk_count += 1

        extracted_files.append(
            {
                "originalName": file_info["originalName"],
                "mimeType": mime_type,
                "size": file_info["size"],
                "cloudinaryUrl": file_info["cloudinaryUrl"],
                "cloudinaryPublicId": file_info["cloudinaryPublicId"],
                "pageCount": page_count,
                "chunkCount": source_chunk_count,
                "characterCount": character_count,
                "extractionStatus": extraction_status,
            }
        )

    if not chunks:
        raise RuntimeError("No text could be extracted from the uploaded files.")

    embeddings = []
    for index in range(0, len(chunks), 32):
        batch = chunks[index : index + 32]
        embeddings.extend(embed_texts([item["text"] for item in batch]))

    client = get_client()
    ensure_collection(client, len(embeddings[0]))
    delete_notebook_points(client, notebook_id)

    points = [
        qmodels.PointStruct(id=item["id"], vector=vector, payload=item["payload"])
        for item, vector in zip(chunks, embeddings)
    ]
    client.upsert(collection_name=COLLECTION_NAME, points=points)

    return {
        "chunkCount": len(chunks),
        "sourceFiles": extracted_files,
    }


def chat_payload(payload):
    notebook_id = payload["notebookId"]
    query = clean_text(payload["query"])
    notebook_name = payload["notebookName"]
    history = payload.get("history", [])

    if not query:
        raise RuntimeError("Chat query is empty after normalization.")

    routed = route_chat_turn(notebook_name, query, history)

    if routed.mode == "chat":
        return {
            "answer": answer_chat_turn(notebook_name, query, history),
            "citations": [],
        }

    notebook_context = retrieve_notebook_context(notebook_id, query)
    return {
        "answer": answer_notebook_turn(
            notebook_name,
            query,
            history,
            notebook_context["context_block"],
        ),
        "citations": notebook_context["citations"],
    }


def delete_notebook_payload(payload):
    notebook_id = payload["notebookId"]
    client = get_client()
    if not client.collection_exists(COLLECTION_NAME):
        return {"deleted": True}

    delete_notebook_points(client, notebook_id)
    return {"deleted": True}


def title_payload(payload):
    return {
        "title": generate_chat_title(
            payload["notebookName"],
            payload["query"],
        )
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ingest")
def ingest_route(payload: IngestPayload):
    try:
        return ingest_payload(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/chat")
def chat_route(payload: ChatPayload):
    try:
        return chat_payload(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/delete-notebook")
def delete_notebook_route(payload: DeleteNotebookPayload):
    try:
        return delete_notebook_payload(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/title")
def title_route(payload: TitlePayload):
    try:
        return title_payload(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def main():
    uvicorn.run(
        app,
        host=RAG_SERVICE_HOST,
        port=RAG_SERVICE_PORT,
        log_level="info",
    )


if __name__ == "__main__":
    main()
