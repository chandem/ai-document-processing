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
- [x] Image upload support in frontend

## Phase 3 — AI
- [x] AI provider interface
- [x] Local document classification baseline
- [x] Local extractive summary baseline
- [x] LLM summarization (OpenAI)
- [x] Structured field extraction (OpenAI JSON mode)
- [x] Confidence and source references (heuristic + LLM)
- [x] Question answering over a document (API + UI)

## Phase 4 — AI workspace
- [x] Document dashboard (basic)
- [x] Document detail dialog with summary + text + Q&A
- [x] Ask questions about a document (API + UI)
- [ ] Conversation history
- [ ] Citations / source snippets
- [ ] Human correction workflow
- [ ] Display structured_data in UI

## Phase 5 — SaaS
- [x] Supabase Auth (email/password + recovery)
- [ ] Usage tracking
- [ ] Free/pro limits
- [ ] Payments/subscriptions
- [ ] Team workspaces
- [ ] API keys
- [ ] Public API rate limiting
- [ ] Export to CSV/Excel/JSON

## Deployment
- [x] Render configuration
- [x] Vercel configuration
- [x] Docker image with Tesseract + Poppler
- [ ] Dedicated Supabase project (production)
- [ ] Production environment variables
- [ ] Production smoke tests
