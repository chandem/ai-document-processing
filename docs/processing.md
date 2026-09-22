# Document Processing

## Current MVP pipeline

1. Receive a multipart upload.
2. Enforce a configurable size limit.
3. Detect the document format from extension/content type.
4. Extract text from PDF, DOCX and common text formats.
5. Return normalized text plus basic statistics.
6. Keep OCR and LLM processing behind provider interfaces so they can be added without changing the API contract.

## Supported now

- PDF with selectable text
- DOCX
- TXT
- Markdown
- CSV
- JSON

## Next processing layers

- OCR for scanned PDFs and images
- Document classification
- Summarization
- Structured field extraction
- Persistent document metadata and file storage
- Q&A with source references

Image OCR intentionally returns a clear 422 response until an OCR provider is configured. This avoids silently producing empty or misleading text.
