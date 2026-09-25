# Troubleshooting

## "Failed to fetch" on page refresh

This means the browser could not complete a request to the API (network, CORS, or backend down).

### Checklist

1. **Backend running?**  
   Open `http://127.0.0.1:8000/health` — expect `{"status":"ok",...}`.

2. **Local frontend env** (`frontend/.env`):
   ```env
   VITE_API_BASE_URL=/api/v1
   ```
   Restart `npm run dev` after changing env. The Vite proxy forwards `/api` → `http://127.0.0.1:8000`.

3. **Production frontend** (Vercel):
   ```env
   VITE_API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com/api/v1
   ```
   Backend must use HTTPS if the site is HTTPS (no mixed content).

4. **CORS**  
   Backend `APP_ENV=development` allows all origins.  
   Production: set `FRONTEND_URL=https://your-app.vercel.app` and optional `FRONTEND_URLS=...`.

5. **Supabase keys**  
   Missing keys return **503** with a clear message instead of a silent network failure.

### After the latest UI changes

Network errors show as a **yellow warning** with a **Retry** button and the API base URL, not a hard crash.

---

## Camera scan issues

| Symptom | Fix |
|---------|-----|
| Permission denied | Allow camera in the browser site settings; use HTTPS or `localhost`. |
| No camera found | Plug in / enable a webcam; try **Flip** for front vs back. |
| Multi-page PDF fails to build | Update to latest `CameraScanDialog` (Blob/ArrayBuffer typing fix). Prefer single-page JPEG if needed. |
| OCR quality low | Enable **Enhance for OCR** before capture; use good lighting and a flat page. |

---

## OCR not working

Install system packages:

```bash
# Debian/Ubuntu
sudo apt-get install -y tesseract-ocr poppler-utils
```

Or use the backend Docker image (includes both).

Check capabilities: `GET /api/v1/health` → `capabilities.ocr`.

---

## Classification always "other" / weak summaries

Set `OPENAI_API_KEY` on the backend. Without it, only keyword heuristics run.

---

## 401 Invalid or expired access token

Sign out and sign in again. Ensure backend `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` match the same project as the frontend.

---

## 429 Daily quota exceeded

Free-tier limits apply per calendar day (uploads / asks / exports). Check `GET /api/v1/documents/usage`. Limits reset at UTC midnight (see backend usage service).

---

## Q&A history empty / conversation errors

Apply migration `supabase/migrations/20260924130000_conversations_usage.sql` in the Supabase SQL editor. Without `conversations` / `messages` tables, history cannot persist.

---

## Frontend TypeScript build fails on Blob / Uint8Array

Use latest `main`. Multi-page PDF generation copies bytes into a plain `ArrayBuffer` before `new Blob([ab])` to satisfy TypeScript 5.9 `BlobPart` typing.

---

## npm audit high severity

From `frontend/`, run `npm audit` for details. Prefer dependency upgrades over `npm audit fix --force` (force can introduce breaking changes). Track upstream Vite / plugin releases.
