# Notebook AI

Small full-stack notebook chat app.

- `web/`: React + Vite frontend
- `server/`: Express API
- `server/rag/`: Python RAG service
- `server/storage/rag/`: RAG runtime state (`qdrant/`, temporary uploads)

## Setup

Requirements:

- Node.js
- Python 3
- MongoDB running locally

Install frontend deps:

```bash
cd web
npm install
```

Install server deps:

```bash
cd server
npm install
```

Install Python deps:

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Configure environment:

- Copy or edit `server/.env`
- Set `MONGO_URI`
- Set the Cloudinary values
- Set the AI provider values
- Optional: override `QDRANT_PATH` and `UPLOADS_PATH` if you want different RAG storage locations

## Run

Start the Python RAG service:

```bash
cd server
source .venv/bin/activate
python rag/app.py
```

Start the Express API:

```bash
cd server
npm run dev
```

Start the frontend:

```bash
cd web
npm run dev
```

Frontend default URL: `http://localhost:5173`

## Test

Server tests:

```bash
cd server
npm test
```

Reset only the local RAG storage:

```bash
cd server
npm run rag:wipe
```

## AI Provider Config

The Python RAG service now uses the official OpenAI Python SDK with a configurable `base_url`, so it can target OpenAI-compatible providers like OpenRouter.

Preferred variables:

```env
AI_API_KEY=...
AI_BASE_URL=https://openrouter.ai/api/v1
AI_LLM_MODEL=openai/gpt-4.1-mini
AI_EMBEDDING_MODEL=text-embedding-3-small
AI_RERANK_MODEL=...
AI_APP_NAME=Notebook 2
AI_SITE_URL=http://localhost:5173
QDRANT_PATH=storage/rag/qdrant
UPLOADS_PATH=storage/rag/uploads
```

Notes:

- `AI_RERANK_MODEL` is optional. If your provider does not support `/rerank`, the app falls back to the vector search ordering.
- Existing `OPENROUTER_*` variables still work as backward-compatible aliases.
- `OPENAI_API_KEY` and `OPENAI_BASE_URL` are also accepted as aliases.
