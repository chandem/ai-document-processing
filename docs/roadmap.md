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
- [x] **Camera scan** (device camera, multi-page PDF, OCR enhance)
- [x] Background processing after persist
- [x] Processing job history + retry for failed docs
- [x] Extracted-text size limits

## Phase 3 — AI
- [x] AI provider interface
- [x] Local document classification baseline
- [x] Local extractive summary baseline
- [x] LLM summarization (OpenAI)
- [x] Structured field extraction (OpenAI JSON mode)
- [x] Confidence and source references (heuristic + LLM)
- [x] Question answering over a document (API + UI)
- [x] Structured data returned in API + UI
- [x] Source citations / snippets with answers

## Phase 4 — AI workspace
- [x] Document dashboard (basic)
- [x] Document detail dialog with summary + text + Q&A
- [x] Ask questions about a document (API + UI)
- [x] Processing status polling / history UI
- [x] Retry failed documents from UI
- [x] Document search / filter controls (category + status)
- [x] JSON export
- [x] CSV export (list + single document)
- [x] Conversation history (API + persistence + UI thread)
- [ ] Human correction workflow
- [ ] Side-by-side original file preview

## Phase 5 — SaaS
- [x] Supabase Auth (email/password + recovery)
- [x] Usage tracking (in-memory quotas + usage_events table)
- [x] Free-tier daily limits (uploads / asks / exports)
- [x] Quota chip in UI
- [ ] Payments/subscriptions
- [ ] Team workspaces
- [ ] API keys
- [ ] Public API rate limiting (IP / edge)
- [ ] Native Excel (.xlsx) export

## Deployment
- [x] Render configuration
- [x] Vercel configuration
- [x] Docker image with Tesseract + Poppler
- [x] Capability health endpoint (`/api/v1/health`)
- [ ] Dedicated Supabase project (production)
- [ ] Production environment variables checklist
- [ ] Production smoke tests
