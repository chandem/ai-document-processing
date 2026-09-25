# AI Document Processing

**Full-stack intelligent document workspace** — upload or camera-scan PDFs, DOCX, images and text files; extract content (OCR for scans); classify, summarize, extract structured fields; ask questions with citations; export JSON/CSV — backed by Supabase Auth + Storage and optional OpenAI.

[![Backend CI](https://github.com/chandem/ai-document-processing/actions/workflows/backend.yml/badge.svg)](https://github.com/chandem/ai-document-processing/actions/workflows/backend.yml)
[![Frontend CI](https://github.com/chandem/ai-document-processing/actions/workflows/frontend.yml/badge.svg)](https://github.com/chandem/ai-document-processing/actions/workflows/frontend.yml)

## Features

| Capability | Status |
|---|---|
| PDF / DOCX / TXT / MD / CSV / JSON extraction | ✅ |
| Scanned PDF & image OCR (Tesseract) | ✅ |
| **Camera scan** (multi-page → PDF, OCR enhance) | ✅ |
| Document classification (LLM + heuristic fallback) | ✅ |
| Summarization (LLM + extractive fallback) | ✅ |
| Structured field extraction (OpenAI JSON mode) | ✅ |
| Q&A with **source citations** | ✅ |
| **Conversation history** (multi-turn) | ✅ |
| Background processing + **retry** failed jobs | ✅ |
| **JSON + CSV** export (single + bulk) | ✅ |
| Free-tier **daily quotas** (uploads / asks / exports) | ✅ |
| User auth (Supabase) | ✅ |
| React workspace UI | ✅ |
| FastAPI REST API | ✅ |

## Architecture

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  React + MUI │────▶│  FastAPI backend│────▶│ Supabase         │
│  (Vite/TS)   │     │  (Python 3.12)  │     │ Auth + Storage + │
│  Vercel      │     │  Render         │     │ Postgres         │
└──────────────┘     └────────┬────────┘     └──────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │ OCR (Tesseract) │
                     │ LLM (OpenAI)    │
                     └─────────────────┘
```

## Project layout

```
ai-document-processing/
├── backend/          # FastAPI app (primary API)
├── frontend/         # React + TypeScript + Vite + MUI
├── docs/             # Architecture, API, roadmap, troubleshooting
├── supabase/         # schema.sql + ordered migrations
├── src/              # Optional standalone Python package (CLI/pipeline)
└── examples/
```

> **Note:** Production features live under `backend/` + `frontend/`.  
> The `src/ai_document_processing` package is a lighter offline/CLI pipeline and is not required to run the web app.

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# OCR system packages (Ubuntu/Debian)
# sudo apt-get install -y tesseract-ocr poppler-utils

cp .env.example .env
# Fill OPENAI_API_KEY, SUPABASE_*, FRONTEND_URL

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Health: http://127.0.0.1:8000/health  
- API docs: http://127.0.0.1:8000/docs  

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_BASE_URL=/api/v1
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_PUBLISHABLE_KEY=...

npm run dev
```

Open http://localhost:5173  
(`VITE_API_BASE_URL=/api/v1` uses the Vite proxy → no CORS issues in local dev.)

### 3. Supabase schema

Apply SQL in the Supabase SQL editor (in order):

1. [`supabase/schema.sql`](supabase/schema.sql) — base tables  
2. Migrations under [`supabase/migrations/`](supabase/migrations/) (filename order):
   - `20260924110000_add_processing_history_and_recovery.sql`
   - `20260924120000_align_processing_jobs_columns.sql`
   - `20260924130000_conversations_usage.sql` — conversations, messages, usage_events  

Also create a **private** Storage bucket named `documents`.

Without the conversations/usage migration, Q&A history and usage tracking may fail or no-op depending on your backend configuration.

## API overview

All paths below are under `/api/v1`. Auth: `Authorization: Bearer <supabase_access_token>` where marked 🔒.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Health + OCR/AI capabilities |
| `GET` | `/documents/usage` | 🔒 | Today’s quota usage |
| `POST` | `/documents/upload` | No | Extract text only |
| `POST` | `/documents/analyze` | No | Classify + summarize |
| `POST` | `/documents/ask` | No | Upload + ask (+ citations) |
| `POST` | `/documents/persist` | 🔒 | Store file + background analysis |
| `GET` | `/documents` | 🔒 | List documents |
| `GET` | `/documents/export.csv` | 🔒 | Export all as CSV |
| `GET` | `/documents/{id}` | 🔒 | Document detail |
| `GET` | `/documents/{id}/history` | 🔒 | Processing jobs |
| `GET` | `/documents/{id}/conversations` | 🔒 | Q&A threads |
| `GET` | `/documents/{id}/conversations/{cid}/messages` | 🔒 | Messages + citations |
| `POST` | `/documents/{id}/ask` | 🔒 | Q&A (citations + optional history) |
| `POST` | `/documents/{id}/retry` | 🔒 | Retry failed processing |
| `GET` | `/documents/{id}/export` | 🔒 | Download analysis JSON |
| `GET` | `/documents/{id}/export.csv` | 🔒 | Download CSV |
| `DELETE` | `/documents/{id}` | 🔒 | Delete document + file |

Full reference: [docs/api.md](docs/api.md)

## Environment variables

**Backend** (`backend/.env`):

```env
APP_ENV=development
PORT=8000
MAX_UPLOAD_SIZE_MB=20
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
FRONTEND_URL=http://localhost:5173
# Optional: FRONTEND_URLS=https://app.example.com,http://localhost:5173
```

**Frontend** (`frontend/.env`):

```env
VITE_API_BASE_URL=/api/v1
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

Without `OPENAI_API_KEY`, classification and summary fall back to heuristics. OCR needs Tesseract + Poppler (or the Docker image).

## Docker (backend)

```bash
cd backend
docker build -t ai-doc-backend .
docker run -p 8000:8000 --env-file .env ai-doc-backend
```

## Troubleshooting

See **[docs/troubleshooting.md](docs/troubleshooting.md)** for “Failed to fetch”, CORS, OCR, camera scan, quotas, and auth issues.

## Docs

- [Architecture](docs/architecture.md)
- [API](docs/api.md)
- [Processing pipeline](docs/processing.md)
- [Data model](docs/data-model.md)
- [Roadmap](docs/roadmap.md)

## License

MIT — see [LICENSE](LICENSE)
