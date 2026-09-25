# Production checklist

Use this before pointing real users at the stack.

## Infrastructure

- [ ] Dedicated Supabase project (not the local/dev project)
- [ ] Schema + all migrations applied (see [setup-supabase.md](setup-supabase.md))
- [ ] Private Storage bucket `documents`
- [ ] Backend hosted (e.g. Render) with Docker image that includes Tesseract + Poppler
- [ ] Frontend hosted (e.g. Vercel) over **HTTPS**

## Backend environment

```env
APP_ENV=production
PORT=8000
MAX_UPLOAD_SIZE_MB=20
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # server only — never expose to the browser
FRONTEND_URL=https://your-app.vercel.app
FRONTEND_URLS=https://your-app.vercel.app
```

- [ ] `APP_ENV=production` (CORS restricted to `FRONTEND_URL` / `FRONTEND_URLS`)
- [ ] Service role key only on the server
- [ ] OpenAI key set if you need LLM quality beyond heuristics

## Frontend environment (build-time)

```env
VITE_API_BASE_URL=https://YOUR-API-HOST/api/v1
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

- [ ] API URL is **HTTPS** when the site is HTTPS (no mixed content)
- [ ] Same Supabase project as the backend

## Smoke tests

1. `GET https://YOUR-API-HOST/health` → `status: ok`  
2. `GET https://YOUR-API-HOST/api/v1/health` → capabilities for OCR / AI  
3. Sign up / sign in on the frontend  
4. Upload a small PDF and wait until status is `completed`  
5. Open document → **Original** opens a signed URL  
6. Ask a question → answer + citations  
7. Export JSON and CSV  
8. Camera scan on a phone (HTTPS required for camera)  
9. Confirm `GET /api/v1/documents/usage` increments

## Security notes

- Never commit `.env` files  
- Rotate Supabase service role if it was ever exposed  
- Keep the Storage bucket private; only use signed URLs or the service role on the server  
