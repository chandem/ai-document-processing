# Standalone Python package (`src/ai_document_processing`)

This folder is an **optional offline / CLI-oriented** document pipeline.  
The **web product** (API + React UI) lives in `backend/` and `frontend/` and does not depend on this package at runtime.

Use this package if you want a simple importable library or example scripts without running FastAPI or Supabase.

```bash
# from repo root, with package on PYTHONPATH or installed editable
python examples/run_pipeline.py path/to/file.pdf
```

For the full workspace (auth, storage, Q&A, camera scan, quotas), use **backend + frontend** instead.
