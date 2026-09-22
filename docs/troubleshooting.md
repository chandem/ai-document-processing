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

## OCR not working

Install system packages:

```bash
# Debian/Ubuntu
sudo apt-get install -y tesseract-ocr poppler-utils
```

Or use the backend Docker image (includes both).

---

## Classification always "other" / weak summaries

Set `OPENAI_API_KEY` on the backend. Without it, only keyword heuristics run.

---

## 401 Invalid or expired access token

Sign out and sign in again. Ensure backend `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` match the same project as the frontend.
