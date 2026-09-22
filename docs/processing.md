# Document Processing

## Pipeline

1. Receive a multipart upload.
2. Enforce a configurable size limit (`MAX_UPLOAD_SIZE_MB`).
3. Detect format from extension / content type.
4. Extract text:
   - **Digital PDF** → PyMuPDF
   - **Scanned PDF / images** → Tesseract OCR (via pdf2image for multi-page)
   - **DOCX** → python-docx
   - **TXT / MD / CSV / JSON** → UTF-8 decode
5. Run intelligence layer:
   - **Classification** — OpenAI when `OPENAI_API_KEY` is set, otherwise keyword heuristics
   - **Summarization** — OpenAI or extractive first-sentences fallback
   - **Structured extraction** — OpenAI JSON mode (when configured)
6. Optionally persist file to Supabase Storage and metadata to Postgres.
7. Optional Q&A against the extracted text.

## Supported formats

| Format | Digital text | OCR |
|--------|--------------|-----|
| PDF | ✅ | ✅ (when little digital text) |
| DOCX | ✅ | — |
| PNG / JPG / TIFF / WEBP / BMP | — | ✅ |
| TXT / MD / CSV / JSON | ✅ | — |

## Provider behaviour

- **No `OPENAI_API_KEY`** → heuristic classification + extractive summary. Q&A returns a clear configuration message.
- **OCR missing** (no Tesseract / Pillow) → scanned PDFs and images return a 422 explaining how to enable OCR.
- **Docker image** installs `tesseract-ocr` and `poppler-utils` so OCR works out of the box.

## API entry points

- `POST /api/v1/documents/upload` — extract text only
- `POST /api/v1/documents/analyze` — classify + summarize
- `POST /api/v1/documents/ask` — upload + question
- `POST /api/v1/documents/persist` — store + full analysis (auth required)
- `POST /api/v1/documents/{id}/ask` — Q&A on a stored document
