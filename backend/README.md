# AI Document Processing — Backend

FastAPI service for document upload, OCR, classification, summarization, Q&A, and Supabase persistence.

## Quick start

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# System OCR (Ubuntu/Debian)
# sudo apt-get install -y tesseract-ocr poppler-utils

cp .env.example .env
# Fill SUPABASE_* and optionally OPENAI_API_KEY

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Health: http://127.0.0.1:8000/health  
- OpenAPI: http://127.0.0.1:8000/docs  

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | For auth/storage | Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | For JWT verify | Anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | For DB/storage | Service role key |
| `OPENAI_API_KEY` | Optional | Enables LLM classify/summary/Q&A |
| `FRONTEND_URL` | CORS | e.g. `http://localhost:5173` |
| `FRONTEND_URLS` | Optional | Extra comma-separated origins |
| `APP_ENV` | Optional | `development` opens CORS fully |
| `MAX_UPLOAD_SIZE_MB` | Optional | Default `20` |

## Tests

```bash
pip install -r requirements.txt
pytest -q
```

## Docker

```bash
docker build -t ai-doc-backend .
docker run -p 8000:8000 --env-file .env ai-doc-backend
```

The image includes Tesseract + Poppler for OCR.

## Main routes

See [docs/api.md](../docs/api.md).
