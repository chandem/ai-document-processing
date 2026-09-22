# Roadmap

## Phase 1 — Foundation
- [x] GitHub repository
- [x] Frontend scaffold
- [x] FastAPI scaffold
- [x] Environment configuration
- [x] Backend CI
- [x] Frontend CI

## Phase 2 — Document engine
- [x] Upload API
- [x] File-size validation
- [x] PDF text extraction
- [x] DOCX text extraction
- [x] Text/CSV/JSON extraction
- [x] Document statistics
- [x] Processing tests
- [x] OCR provider interface
- [x] OCR implementation for scanned PDFs/images (Tesseract + pdf2image)
- [x] Persistent file storage (Supabase Storage)
- [x] Document metadata persistence
- [x] Document list / detail / delete

## Phase 3 — AI
- [x] AI provider interface
- [x] Local document classification baseline
- [x] Local extractive summary baseline
- [x] LLM summarization (OpenAI)
- [x] Structured field extraction (OpenAI JSON mode)
- [x] Confidence and source references (heuristic + LLM)
- [x] Question answering over a document

## Phase 4 — AI workspace
- [ ] Document dashboard
- [ ] Document detail page
- [x] Ask questions about a document (API)
- [ ] Conversation history
- [ ] Citations/source snippets
- [ ] Human correction workflow

## Phase 5 — SaaS
- [ ] Supabase Auth (partial – JWT helper present)
- [ ] Usage tracking
- [ ] Free/pro limits
- [ ] Payments/subscriptions
- [ ] Team workspaces
- [ ] API keys
- [ ] Public API
- [ ] Export to CSV/Excel/JSON

## Deployment
- [x] Render configuration
- [x] Vercel configuration
- [ ] Dedicated Supabase project
- [ ] Production environment variables
- [ ] Production smoke tests
