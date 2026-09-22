# Contributing to AI Document Processing

Thanks for your interest in improving this project!

## Development setup

```bash
git clone https://github.com/chandem/ai-document-processing.git
cd ai-document-processing

# Python package + CLI
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -e .

# Backend (FastAPI)
cd backend
pip install -r requirements.txt
# Optional OCR system packages (Ubuntu/Debian):
#   sudo apt-get install tesseract-ocr poppler-utils
```

## Running tests

```bash
# Package tests
pytest tests/

# Backend tests
cd backend && pytest
```

## Code style

- Prefer type hints and modern Python (3.11+).
- Keep functions focused; extract helpers when logic grows.
- For LLM / OCR code paths, always provide a graceful fallback when keys or system packages are missing.

## Pull requests

1. Open an issue first for larger features.
2. Keep PRs focused and well-described.
3. Add or update tests when you change behavior.
4. Update `docs/roadmap.md` if you complete a planned item.

## Architecture notes

There are two complementary surfaces:

| Surface | Location | Purpose |
|---------|----------|---------|
| Python package + CLI | `src/ai_document_processing/` | Library and batch tooling |
| Full-stack app | `backend/` + `frontend/` | SaaS-style API + UI with Supabase |

Prefer extending the shared patterns (provider interfaces, heuristics + LLM fallback) rather than hard-coding a single vendor.
