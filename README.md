# AgentVault

AgentVault processes Obsidian-style vaults (`.zip` of markdown files), rewrites notes with LLM guardrails, and provides a review-first Studio workflow before export.

## Key Features
- Upload and process a vault from the Studio interface.
- Inspect per-note actions, reasons, and diffs before downloading output.
- Export `index.md`, `entities.md`, `preview.md`, and `report.json`.
- Preserve critical markdown structure with rewrite guardrails.
- Use resilient job tracking (SQLite with in-memory fallback).

## Architecture
- `frontend/`: Next.js 16 + React 19 Studio and feedback UI.
- `backend/`: FastAPI API, job lifecycle, vault processing pipeline.
- `docs/`: product assumptions, deployment, and technical decisions.
- `scripts/`: evaluation and local test helpers.

## Local Setup

### 1) Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

### 2) Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000/studio`.

## Environment Variables

### Frontend (`frontend/.env.local`)
- `NEXT_PUBLIC_API_URL`: backend base URL (default local: `http://localhost:8000`)
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GITHUB_ID`, `GITHUB_SECRET` (optional)
- `GOOGLE_ID`, `GOOGLE_SECRET` (optional)

### Backend (`backend/.env`)
- `CORS_ALLOW_ORIGINS`
- `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` (or `OPENAI_API_KEY` / `OpenAI_API_KEY`, optional `OPENAI_MODEL` / `OpenAI_MODEL`)
- `MAX_UPLOAD_MB`
- `MAX_FILES`
- `DAILY_JOB_LIMIT`
- `RATE_LIMIT_PER_MINUTE`
- `LLM_MAX_WORKERS`
- `LLM_REQUESTS_PER_MINUTE`
- `JOB_TTL_MINUTES`

## Core API
- `GET /health`: service health.
- `POST /upload-vault`: upload and start async processing.
- `GET /status/{vault_id}`: processing progress and status.
- `GET /download/{vault_id}`: processed vault zip.
- `GET /preview/{vault_id}`: compiled markdown preview.
- `GET /report/{vault_id}`: structured processing report.
- `GET /diff/{vault_id}?path=...`: original vs processed note diff data.
- `POST /feedback`: feedback ingestion endpoint.
- `GET /metrics`: lightweight usage counters.

## Verification

### Backend tests
```bash
cd backend
.venv/bin/python -m unittest discover -s tests -q
```

### Frontend checks
```bash
cd frontend
npm run lint
npm run build
```

## Documentation
- [Assumptions](docs/ASSUMPTIONS.md)
- [Tech Stack](docs/TECH_STACK.md)
- [Deployment](docs/DEPLOYMENT.md)
