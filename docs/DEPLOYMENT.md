# Deployment

## Frontend (Vercel)

Project root: `frontend`

Environment variables:
- `NEXT_PUBLIC_API_URL` (Fly backend URL)
- `NEXTAUTH_URL` (Vercel URL)
- `NEXTAUTH_SECRET`
- `GITHUB_ID`, `GITHUB_SECRET` (optional)
- `GOOGLE_ID`, `GOOGLE_SECRET` (optional)

Build command:
- `npm run build`

---

## Backend (Fly)

Project root: `backend`

Build:
- Dockerfile-based (see `backend/Dockerfile`)

Set secrets (example):
- `fly secrets set OPENROUTER_API_KEY=... OPENROUTER_MODEL=arcee-ai/trinity-large-preview:free`
- `fly secrets set CORS_ALLOW_ORIGINS=https://your-app.vercel.app`
- `fly secrets set LLM_MAX_WORKERS=12 LLM_REQUESTS_PER_MINUTE=120`
- `fly secrets set JOB_TTL_MINUTES=60`

Deploy:
- `fly launch` (one time, or edit `backend/fly.toml` first)
- `fly deploy`
