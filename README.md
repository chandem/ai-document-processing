# AI Document Processing

**Full-stack intelligent document workspace** — upload PDFs, DOCX, images or text files, extract content (with OCR for scans), classify, summarize, pull structured data, and ask questions — all backed by Supabase Auth + Storage and optional OpenAI.

[![Backend CI](https://github.com/chandem/ai-document-processing/actions/workflows/backend.yml/badge.svg)](https://github.com/chandem/ai-document-processing/actions/workflows/backend.yml)
[![Frontend CI](https://github.com/chandem/ai-document-processing/actions/workflows/frontend.yml/badge.svg)](https://github.com/chandem/ai-document-processing/actions/workflows/frontend.yml)

## Features

| Capability | Status |
|---|---|
| PDF / DOCX / TXT / MD / CSV / JSON extraction | ✅ |
| Scanned PDF & image OCR (Tesseract) | ✅ |
| Document classification (LLM + heuristic fallback) | ✅ |
| Summarization (LLM + extractive fallback) | ✅ |
| Structured field extraction (OpenAI JSON mode) | ✅ |
| Question answering over a document | ✅ |
| JSON export of analysis | ✅ |
| User auth (Supabase) | ✅ |
| Persistent storage + document list/detail/delete | ✅ |
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
├── backend/                 # FastAPI application
├── frontend/                # React + TypeScript + Vite + MUI
├── docs/                    # Architecture, API, roadmap, troubleshooting
├── supabase/                # SQL schema
├── src/                     # Standalone Python package (CLI/pipeline)
└── examples/
```

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# OCR system packages (Ubuntu/Debian)
# sudo apt-get install -y tesseract-ocr poppler-utils

cp .env.example .env
# OPENAI_API_KEY, SUPABASE_*, FRONTEND_URL

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

### 3. Supabase

1. Apply [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.  
2. Create a **private** Storage bucket named `documents`.

## API overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/documents/upload` | No | Extract text only |
| `POST` | `/api/v1/documents/analyze` | No | Classify + summarize |
| `POST` | `/api/v1/documents/ask` | No | Upload + ask a question |
| `POST` | `/api/v1/documents/persist` | Yes | Store file + full analysis |
| `GET`  | `/api/v1/documents` | Yes | List documents |
| `GET`  | `/api/v1/documents/{id}` | Yes | Document detail |
| `GET`  | `/api/v1/documents/{id}/export` | Yes | Download analysis JSON |
| `POST` | `/api/v1/documents/{id}/ask` | Yes | Q&A on stored document |
| `DELETE` | `/api/v1/documents/{id}` | Yes | Delete document + file |

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

See **[docs/troubleshooting.md](docs/troubleshooting.md)** for “Failed to fetch”, CORS, OCR, and auth issues.

## Docs

- [Architecture](docs/architecture.md)
- [API](docs/api.md)
- [Processing pipeline](docs/processing.md)
- [Data model](docs/data-model.md)
- [Roadmap](docs/roadmap.md)

## License

MIT — see [LICENSE](LICENSE)
