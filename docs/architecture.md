# AI Document Processing — Architecture

## Product flow

User → React frontend → FastAPI API → processing pipeline → PostgreSQL/Storage → AI/OCR

## Frontend
- React + TypeScript + Vite
- Material UI
- Authentication, dashboard, document workspace, upload, extraction review and export

## Backend
- Python + FastAPI
- Document ingestion and validation
- PDF/DOCX/image text extraction
- OCR
- AI classification, summarization and structured extraction
- Document Q&A

## Data
- Supabase PostgreSQL for metadata and application data
- Supabase Storage for uploaded files

## Deployment
- Frontend: Vercel
- Backend: Render
- Database/storage/auth: Supabase
- CI/CD: GitHub Actions
