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
│   ├── app/
│   │   ├── ai/              # OpenAI provider + interfaces
│   │   ├── api/             # Auth + documents routes
│   │   ├── core/            # Settings, Supabase client
│   │   ├── schemas/
│   │   └── services/        # OCR, extraction, intelligence
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                # React + TypeScript + Vite + MUI
│   ├── src/
│   │   ├── App.tsx
│   │   └── services/        # API + Supabase clients
│   └── package.json
├── docs/                    # Architecture, roadmap, data model
├── supabase/                # SQL schema
├── src/                     # Original standalone Python package (CLI/pipeline)
└── examples/
```

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# System packages for OCR (Ubuntu/Debian)
# sudo apt-get install -y tesseract-ocr poppler-utils

cp .env.example .env
# Fill in:
#   OPENAI_API_KEY=sk-...
#   SUPABASE_URL=...
#   SUPABASE_SERVICE_ROLE_KEY=...
#   SUPABASE_PUBLISHABLE_KEY=...
#   FRONTEND_URL=http://localhost:5173

uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...
# VITE_API_URL=http://localhost:8000

npm run dev
```

Open http://localhost:5173

### 3. Supabase

Apply `supabase/schema.sql` in the SQL editor of your project. Create a private Storage bucket named `documents`.

## API overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/documents/upload` | No | Extract text only |
| `POST` | `/api/v1/documents/analyze` | No | Classify + summarize |
| `POST` | `/api/v1/documents/ask` | No | Upload + ask a question |
| `POST` | `/api/v1/documents/persist` | Yes | Store file + run full analysis |
| `GET`  | `/api/v1/documents` | Yes | List user documents |
| `GET`  | `/api/v1/documents/{id}` | Yes | Document detail |
| `POST` | `/api/v1/documents/{id}/ask` | Yes | Q&A on stored document |
| `DELETE` | `/api/v1/documents/{id}` | Yes | Delete document + storage object |

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
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=http://localhost:8000
```

Without `OPENAI_API_KEY` the system falls back to keyword classification and extractive summaries. OCR works as long as Tesseract + Poppler are installed.

## Docker (backend)

```bash
cd backend
docker build -t ai-doc-backend .
docker run -p 8000:8000 --env-file .env ai-doc-backend
```

The image installs Tesseract and Poppler so OCR works out of the box.

## Standalone Python package

The original `src/ai_document_processing` package (CLI + pipeline) remains available for offline / batch use:

```bash
pip install -e .
python -m src.ai_document_processing.cli process invoice.pdf -o result.json
```

## Roadmap

See [docs/roadmap.md](docs/roadmap.md) for detailed phase progress.

Next priorities:
- Richer document detail view + in-app Q&A UI
- Conversation history & citations
- Usage limits / billing
- Export to CSV / Excel / JSON

## License

MIT — see [LICENSE](LICENSE)
