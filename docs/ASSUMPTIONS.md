## AgentVault Assumptions & Decisions

This document captures key assumptions and decisions behind AgentVault so future work stays aligned.

---

## Scope & Target Users

- **Initial scope**
  - Focus on Obsidian-style markdown vaults (folder structures of `.md` files, zipped).
  - Assume reasonably well-formed markdown with common Obsidian patterns (frontmatter, links, tags).
  - Exclude Notion exports and other formats in v1; plan to support them in later versions.

- **Target users**
  - Power users of Obsidian/markdown who want their personal knowledge bases to work better with AI agents.
  - Developers and knowledge workers who care about privacy and structure but are willing to use an external service if it is transparent and safe.

---

## Privacy & Data Handling

- **Processing model**
  - All processing is done in-memory and on ephemeral storage on the backend.
  - No long-term storage of raw vault content; only short-lived temp directories and files are used.
  - Any logs must **never** contain full note content; logs should only include non-sensitive metadata (e.g., file counts, processing durations, anonymized error messages).

- **File handling**
  - Uploads are accepted as zip files and immediately extracted to a unique temp directory.
  - After processing and serving the cleaned zip, temp directories and files are deleted.
  - Large or suspicious files (e.g., executables inside the zip) are rejected.

---

## LLM Usage

- **Primary use**
  - Use LLMs specifically for rewriting and restructuring notes:
    - Improve clarity and structure (headings, lists, sections).
    - Preserve meaning, code blocks, and links.
    - Make notes easier for AI agents to parse and reason over.

- **Models**
  - Default to high-quality models via OpenRouter, such as:
    - `anthropic/claude-3.5-sonnet` for structure and reasoning.
  - Consider cheaper fallbacks for cost-sensitive flows, such as:
    - `meta-llama/llama-3.1-70b` or similar strong open-source models behind OpenRouter.

- **Non-LLM tasks**
  - Prefer rule-based or library-based solutions for:
    - Parsing markdown (e.g., `markdown-it-py`, `mistune`).
    - YAML frontmatter handling (`PyYAML`).
    - Entity extraction (`spaCy`).
  - Reserve LLM tokens for tasks where large language models add clear value.

---

## Architecture & Tech Stack

- **Frontend**
  - Next.js with TypeScript.
  - Tailwind CSS for styling.
  - Shadcn/UI or Radix for accessible components.
  - TanStack Query for data fetching/state where appropriate.
  - NextAuth.js (or similar) for authentication (Google/GitHub).

- **Backend**
  - FastAPI as the main web framework.
  - `uvicorn` as the ASGI server.
  - `pydantic` for request/response models and validation.
  - `python-multipart` for file upload handling.
  - Supporting libraries:
    - `markdown-it-py` or `mistune` for markdown parsing.
    - `PyYAML` for YAML frontmatter.
    - `spaCy` with `en_core_web_sm` for entity extraction.
    - `requests` or a thin OpenRouter client for LLM calls.

- **Infrastructure**
  - Frontend hosted on Vercel.
  - Backend hosted on Render, Heroku, or Fly.io (pick based on simplicity and cost).
  - Domain such as `agentvault.app`.

---

## Security & Auth

- All user-facing endpoints must be served over HTTPS in production.
- Use JWT-based or session-based auth behind NextAuth for authenticated endpoints.
- Do not store vault content in a database; at most, keep:
  - Aggregated metrics (counts, sizes, durations).
  - Minimal user identifiers required for auth and billing.
- Validate and sanitize all inputs:
  - Zip file structure and contents.
  - Query parameters and paths.

---

## Cost & Limits

- **LLM costs**
  - OpenRouter costs are expected to be in the range of ~$0.01–0.05 per 1k tokens.
  - Target development and early launch to stay under **$50/month** in LLM costs.

- **Operational limits**
  - Impose file-count and size limits on uploads (e.g., default free tier: 50 files, 100 MB).
  - Consider global caps per user per day to avoid abuse.
  - Provide clear error messages when limits are exceeded.

---

## Testing & Quality

- Use your own “messy” vault and public example vaults (e.g., from GitHub) as test inputs.
- Implement:
  - Unit tests for backend parsing and transformation logic (with LLMs mocked out).
  - Integration tests for upload → process → download workflow.
  - Manual QA on UI flows and edge-case vaults (weird characters, emojis, code-heavy notes).

---

## Non-Goals for v1

- Rich collaboration features (multi-user vaults, sharing, comments).
- Editing and authoring notes directly inside AgentVault.
- Deep analytics or full-blown graph visualizations (beyond simple indexes and entities).
- First-class support for non-markdown sources such as Notion exports, Google Docs, etc. (v2+).

