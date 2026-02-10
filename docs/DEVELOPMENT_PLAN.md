## AgentVault Development Plan

AgentVault is a web app that takes an Obsidian-style vault (zip of markdown files), rewrites and structures the notes to be more agent-friendly, and returns a cleaned vault. This document captures the phased development plan with clear milestones and timelines.

---

## Phase 0 – Scaffold & Config (2–3 days)

**Goal**: Have repos, basic tooling, and local dev workflow ready so later phases focus purely on product logic.

- **Frontend scaffold**
  - Initialize Next.js app with TypeScript: `npx create-next-app@latest agentvault --typescript`.
  - Add Tailwind CSS and Shadcn/UI (or Radix) for components.
  - Set up basic pages:
    - `/` – marketing/landing with short pitch and CTA to sign in / go to dashboard.
    - `/dashboard` – placeholder layout for upload & processing UI (no real logic yet).
  - Add basic layout shell (navbar, footer, main content area).

- **Backend scaffold**
  - Create Python project for FastAPI backend (e.g., `backend/` or `server/`).
  - Install core deps: `fastapi`, `uvicorn[standard]`, `pydantic`, `python-multipart`.
  - Create initial `app/main.py` with a simple health-check endpoint.

- **Shared configuration**
  - Decide local ports (e.g., frontend `3000`, backend `8000`) and CORS rules.
  - Add `.env.example` files for both frontend and backend.
  - Configure basic logging on backend.

- **Outcome / Milestone**
  - Both frontend and backend run locally (`npm run dev`, `uvicorn app.main:app --reload`).
  - Visiting the dashboard page confirms connection can be made to the backend health endpoint.

---

## Phase 1 – MVP Pipeline (1–2 weeks)

**Goal**: Upload a zip, process **one** markdown file end‑to‑end on the backend, and download a cleaned zip.

- **Backend MVP pipeline**
  - Implement `POST /upload-vault`:
    - Accept a zip file via multipart form-data.
    - Store it in a temp directory.
    - Unzip into a dedicated temp folder (one per request).
  - Implement a simple processing function:
    - Find markdown files (`.md`) via `os.walk`.
    - Pick the first valid note (skip `.obsidian`, hidden folders, etc.).
    - Apply a minimal transformation (e.g., add YAML frontmatter if missing, normalize headings).
      - This transformation must be real logic, not placeholder; it should actually modify content in a meaningful way.
  - Implement `GET /download/{vault_id}` (or similar):
    - Zip the processed folder back up.
    - Stream the zip file to the client.

- **Frontend MVP UX**
  - On `/dashboard`, add:
    - Drag-and-drop or file picker for vault zip.
    - Upload button that calls `POST /upload-vault`.
    - When the backend is done, provide a download link/button for the cleaned zip.
  - Use React Hook Form or a simple controlled form for the upload.
  - Use TanStack Query (or plain React state initially) to manage API calls.

- **Outcome / Milestone**
  - You can take a small zip (3–5 markdown files), upload it, and receive a new zip where at least one note is meaningfully improved.

---

## Phase 2 – Full Vault Processing (2–3 weeks)

**Goal**: Process **all** relevant markdown files with real transformations, including LLM-powered rewriting and simple global indexes.

- **Vault processor service**
  - Create `vault_processor.py` (or similar) with a service class or functions responsible for:
    - Recursively scanning the unzipped vault, skipping `.obsidian` and hidden/system dirs.
    - For each `.md` file:
      - Read the content.
      - Parse YAML frontmatter (using `PyYAML`), adding defaults if missing.
      - Optionally, use `markdown-it-py`/`mistune` to understand document structure.
  - Integrate `spaCy` for entity extraction:
    - Load `en_core_web_sm`.
    - For each note, extract named entities (e.g., people, orgs, dates, concepts).
    - Store these in frontmatter or in a separate data structure for later indexing.

- **LLM-powered cleaning**
  - Integrate OpenRouter (via `requests` or a lightweight client).
  - Implement a prompt that:
    - Rewrites the note for clarity and agent-friendliness.
    - Preserves code blocks, links, and overall meaning.
    - Adds helpful headings and lists where appropriate.
  - Start with a strong model such as `anthropic/claude-3.5-sonnet`.
  - Implement batching/parallelism:
    - Process multiple files concurrently with `asyncio` while respecting rate limits.
    - Limit vaults to a max number of files / total token budget for now.

- **Global enhancements**
  - After all files are processed:
    - Generate `index.md` with:
      - List of all notes (by relative path / title).
      - Optional tags or categories derived from frontmatter.
    - Generate `entities.md` summarizing entities across the vault as a starting point for knowledge graphs.

- **Frontend upgrades**
  - Replace simple upload UX with:
    - File count and size validation (e.g., 100 MB, 500-file soft limit).
    - Progress indication (e.g., “Processing 47/312 files” via polling or WebSockets).
    - A small preview section that shows before/after for a few sample notes.

- **Outcome / Milestone**
  - You can upload a ~100-note vault and get back a fully processed vault with:
    - Rewritten notes.
    - `index.md` and `entities.md`.
    - Clear progress feedback in the UI.

---

## Phase 3 – Production Ready Features (1–2 weeks)

**Goal**: Make AgentVault user-friendly, safe, and ready to deploy with basic account features.

- **Agent readiness score**
  - Define a heuristic score per-note and per-vault using:
    - Presence and quality of frontmatter.
    - Number and structure of headings.
    - Entity density and clarity of prose.
  - Optionally, use a cheap LLM call for a 0–100 “agent readiness” rating for each note.
  - Aggregate into an overall vault score and display in the dashboard.

- **Auth & user accounts**
  - Add NextAuth.js (or equivalent) for OAuth login (Google/GitHub).
  - Decide where to store minimal user data:
    - Supabase or a hosted Postgres instance.
    - Keep only what is necessary for history/billing; no long-term note content.

- **Limits, billing, and safety**
  - Enforce per-user limits (e.g., free tier: up to 50 files per vault).
  - Integrate Stripe for paid plans (unlimited or higher caps).
  - Validate uploaded zips to reject executable content.
  - Add basic rate limiting on the backend.

- **Deployment**
  - Frontend: deploy to Vercel.
  - Backend: deploy to Render/Heroku/Fly with environment variables set for:
    - OpenRouter API key.
    - Database URLs.
    - Allowed frontend origins.

- **Outcome / Milestone**
  - Real users can sign in, run vaults end-to-end, see scores, and (optionally) pay for higher limits.

---

## Phase 4 – Launch & Feedback (1 week)

**Goal**: Ship AgentVault, get initial users, and establish a feedback loop.

- **Launch materials**
  - Refine landing copy to clearly state value proposition.
  - Record a short Loom demo:
    - Show messy vault → run through AgentVault → query it with an agent and show improvement.
  - Add screenshots and demo links to the landing page.

- **Promotion**
  - Share on:
    - Obsidian community channels (e.g., r/ObsidianMD).
    - Twitter/X with a dev thread.
    - Product Hunt launch.

- **Feedback loop**
  - Add an in-app feedback form (or link to a simple Google Form or Typeform).
  - Track basic product analytics (e.g., PostHog or simple server-side metrics).
  - Collect examples of where the processing fails or breaks formatting and feed them back into prompt and heuristic improvements.

- **Outcome / Milestone**
  - First cohort of users using AgentVault in real workflows, plus a list of concrete improvements for the next iteration.

---

## High-Level Timeline Summary

- **Weeks 1–2**: Phases 0–1 – scaffolding plus MVP upload → single-file process → download.
- **Weeks 3–5**: Phase 2 – full-vault processing with LLM + indexes and UI progress.
- **Weeks 6–7**: Phase 3 – readiness scores, auth, limits, and deployment.
- **Week 8**: Phase 4 – launch, promotion, and feedback.

