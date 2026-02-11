## AgentVault

AgentVault takes an Obsidian-style vault (zip of markdown files), rewrites every note with your LLM, and returns a cleaned vault plus a full markdown preview.

---

## Product Flow
- Upload vault zip
- LLM rewrites all notes, preserving links and code
- Generates `index.md` and `entities.md`
- Download cleaned zip or preview markdown in-browser

---

## Project Docs
- Development plan: `docs/DEVELOPMENT_PLAN.md`
- Assumptions & decisions: `docs/ASSUMPTIONS.md`
- Tech stack: `docs/TECH_STACK.md`
- Deployment: `docs/DEPLOYMENT.md`

---

## Local Development

Frontend
- `cd frontend`
- `npm install`
- `npm run dev`

Backend
- `cd backend`
- `python -m venv .venv`
- `source .venv/bin/activate`
- `pip install -r requirements.txt`
- `uvicorn app.main:app --reload`

Environment
- Copy `frontend/.env.example` to `frontend/.env`
- Copy `backend/.env.example` to `backend/.env`

---

## Required Environment Variables

Frontend
- `NEXT_PUBLIC_API_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GITHUB_ID`, `GITHUB_SECRET`
- `GOOGLE_ID`, `GOOGLE_SECRET`

Backend
- `CORS_ALLOW_ORIGINS`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `MAX_UPLOAD_MB`
- `MAX_FILES`
- `DAILY_JOB_LIMIT`
- `RATE_LIMIT_PER_MINUTE`
- `LLM_MAX_WORKERS`
- `LLM_REQUESTS_PER_MINUTE`
- `JOB_TTL_MINUTES`

---

## E2E Test

Requires backend venv at `backend/.venv`.

Run:
- `python3 scripts/e2e_test.py --zip /path/to/vault.zip`
