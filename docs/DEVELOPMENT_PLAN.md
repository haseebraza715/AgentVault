## AgentVault Development Plan (Improved)

This plan is designed for fast iteration and low-risk delivery. Each phase has deliverables, acceptance criteria, risks, and explicit exit checks.

---

## Phase 0 - Repo & Dev Loop (2-3 days)

**Goal**: a stable, repeatable local dev loop with clear boundaries between frontend and backend.

**Deliverables**
- Frontend scaffold: Next.js (TypeScript), `/` and `/dashboard` routes, layout shell.
- Backend scaffold: FastAPI app with `/health` and basic logging.
- CORS config and shared env conventions.
- `.env.example` for both services.
- Minimal README update (how to run frontend/backend).

**Acceptance Criteria**
- `npm run dev` serves frontend without errors.
- `uvicorn app.main:app --reload` serves backend without errors.
- `/dashboard` can fetch `/health` successfully.

**Exit Checks**
- One command to run frontend, one to run backend.
- Explicit base URL documented.

**Risks**
- CORS misconfiguration.
- Mismatched base URLs across environments.

---

## Phase 1 - MVP Upload/Download (1-2 weeks)

**Goal**: upload a zip, process at least one markdown file deterministically, download cleaned zip.

**Deliverables**
- `POST /upload-vault` accepts zip (multipart/form-data).
- Safe unzip into temp folder (per request, randomized path).
- Markdown discovery: skip `.obsidian`, hidden dirs, non-md files.
- Deterministic transform on first valid `.md` file:
  - Add YAML frontmatter if missing.
  - Normalize headings and spacing.
- `GET /download/{vault_id}` returns processed zip.
- Frontend upload UI with status and download link.

**Acceptance Criteria**
- 3-5 file vault returns a modified zip.
- At least one file is changed by deterministic rule.
- Temp folder is deleted after response.

**Exit Checks**
- Upload -> download roundtrip works 3 times in a row.
- Error responses are JSON with clear messages.

**Risks**
- Zip traversal / unsafe paths.
- Temp folder permission issues.
- Memory spikes for large zips.

---

## Phase 2 - Full Vault Processing (2-3 weeks)

**Goal**: process all markdown files, add metadata, output indexes.

**Deliverables**
- Full vault traversal with clear skip rules.
- YAML frontmatter parsing and defaults.
- Optional markdown parsing for structure.
- Entity extraction (spaCy) and aggregation.
- LLM rewrite pipeline:
  - Prompt template with strict preservation rules.
  - Batching and rate-limit handling.
  - Retry and fallback model handling.
- Output `index.md` and `entities.md` to root.
- UI progress indicator with polling.

**Acceptance Criteria**
- ~100 note vault completes end-to-end.
- Output includes rewritten notes + index files.
- Progress UI updates at least every 5-10 seconds.

**Exit Checks**
- LLM calls are mocked in tests.
- Rate limit handling tested with stub failures.

**Risks**
- LLM latency and cost spikes.
- Token limit overruns on large notes.
- Over-aggressive rewriting that breaks links.

---

## Phase 3 - Production Readiness (1-2 weeks)

**Goal**: auth, limits, and deployable service.

**Deliverables**
- NextAuth with Google/GitHub.
- Usage limits (file count + size + daily jobs).
- Basic rate limiting on backend.
- Zip content validation and file type blocking.
- Stripe billing hooks (stub allowed).
- Deployment targets decided (Vercel + Render/Fly).
- Observability basics (request logs + error tracking).

**Acceptance Criteria**
- Authenticated users can run jobs.
- Limits enforced with clear errors.
- Production env vars documented.

**Exit Checks**
- Load test with 3 concurrent jobs.
- Memory and timeouts remain stable.

**Risks**
- Auth + CORS/session cookie issues across domains.
- Cold starts and memory spikes in backend.

---

## Phase 4 - Launch & Feedback (1 week)

**Goal**: launch and learn from real users.

**Deliverables**
- Landing page polish and clear CTA.
- Demo video and screenshots.
- Feedback form.
- Basic analytics or logging counters.

**Acceptance Criteria**
- Public landing page and demo available.
- Feedback loop established with at least 5 data points.

**Risks**
- Low initial feedback volume.

---

## Testing Plan
- Unit tests for markdown parsing, frontmatter, entity extraction.
- Integration test: upload -> process -> download.
- Fixtures: small vault (5 files), medium vault (50-100 files).
- LLM calls mocked by default.

## Definition of Done
- Phase deliverables met.
- Acceptance criteria met.
- Exit checks passed.
- Known risks documented with mitigations.
