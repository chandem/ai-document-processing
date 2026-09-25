# Supabase setup

Follow this once per project (local or production).

## 1. Create a project

1. Open [Supabase](https://supabase.com) → New project.  
2. Copy **Project URL**, **anon/public key**, and **service_role** key into:
   - `backend/.env` → `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `frontend/.env` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

## 2. Apply schema

In **SQL Editor**, run in order:

1. Entire file: [`supabase/schema.sql`](../supabase/schema.sql)  
2. Each file under [`supabase/migrations/`](../supabase/migrations/) sorted by filename:
   - `20260924110000_add_processing_history_and_recovery.sql`
   - `20260924120000_align_processing_jobs_columns.sql`
   - `20260924130000_conversations_usage.sql`

These create (among others):

- `documents` — metadata, status, summary, structured_data, error_message  
- `processing_jobs` — stage history and retries  
- `conversations` / `messages` — Q&A history with citations  
- `usage_events` — optional durable quota events  

## 3. Storage bucket

1. **Storage** → New bucket  
2. Name: `documents`  
3. **Private** (not public)  
4. Ensure the service role can upload/read/delete (default for service role)

## 4. Auth

Enable **Email** provider under Authentication.  
For local password recovery, set redirect URL to your frontend origin (e.g. `http://localhost:5173`).

## 5. Verify

```bash
# Backend health (with env loaded)
curl -s http://127.0.0.1:8000/api/v1/health
```

Sign up in the UI, upload a file, then confirm a row appears in `documents` and an object in the `documents` bucket.
