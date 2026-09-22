# AI Document Processing Backend

FastAPI backend for the AI Document Processing SaaS.

## Local development

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Health check:

```
GET /health
```

Document processing:

```
POST /api/v1/documents/upload
```

The MVP extracts text from PDF, DOCX and common text files. OCR, LLM processing and persistent storage are the next layers.
