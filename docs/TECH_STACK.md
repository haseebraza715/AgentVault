## AgentVault Tech Stack

This document summarizes the technologies and key libraries used (or planned) for AgentVault.

---

## Frontend

- **Framework**
  - **Next.js (TypeScript)** for a modern React-based app with good DX and SSR/ISR options.

- **Styling & UI**
  - **Tailwind CSS** for utility-first styling and rapid iteration.
  - **Shadcn/UI** (or Radix primitives) for accessible, composable components:
    - Buttons, inputs, dialogs, toasts.
    - File upload dropzones and progress indicators.

- **State & Data Fetching**
  - **React Hook Form** (or similar) for upload forms.
  - **TanStack Query** for API calls and handling loading/error states and caching.

- **Auth**
  - **NextAuth.js** (or equivalent) for OAuth logins:
    - Google and GitHub providers initially.
  - Token/session information passed to the backend for authenticated processing where needed.

---

## Backend

- **Web Framework**
  - **FastAPI** for type-hinted, async-friendly APIs.
  - **uvicorn** as the ASGI server (`uvicorn app.main:app --reload` in development).

- **Core Libraries**
  - **pydantic** for defining request/response models and validation.
  - **python-multipart** for handling file uploads via multipart/form-data.
  - **shutil**, **os**, and **zipfile** from the standard library for filesystem work:
    - Unzipping vaults to temp directories.
    - Walking directory trees to find `.md` files.
    - Re-zipping processed vaults.

- **Markdown & YAML**
  - **markdown-it-py** or **mistune** for parsing markdown when structural analysis is needed.
  - **PyYAML** for reading/writing YAML frontmatter safely.

- **NLP / Entity Extraction**
  - **spaCy** with the `en_core_web_sm` model for extracting entities (names, organizations, dates, etc.).
  - Optionally, custom pipelines or simple post-processing to categorize and aggregate entities.

- **LLM Integration**
  - **OpenRouter** as the gateway to multiple LLM providers.
    - Access via `requests` or a lightweight client library.
  - Primary models:
    - `anthropic/claude-3.5-sonnet` for high-quality rewriting and structuring.
    - Potential fallbacks like `meta-llama/llama-3.1-70b` for cost-sensitive paths.
  - All secrets (e.g., `OPENROUTER_API_KEY`) are stored in environment variables or secure config.

---

## Data & Storage

- **Persistent Storage**
  - Minimal relational database (e.g., Postgres via Supabase or a managed provider) for:
    - User accounts and auth metadata.
    - Job records, billing/subscription status.
    - High-level usage metrics (counts, sizes, timestamps).
  - No long-term storage of note/vault content.

- **Ephemeral Storage**
  - Temp directories for:
    - Incoming uploaded zips.
    - Unzipped vaults being processed.
    - Outgoing cleaned vaults before download.
  - Automated cleanup of temp data after each job or after a short TTL.

---

## DevOps & Deployment

- **Frontend**
  - Hosted on **Vercel**:
    - Automatic deployments from main branch.
    - Environment variables for backend API URL and NextAuth secrets.

- **Backend**
  - Hosted on **Render**, **Heroku**, or **Fly.io** (pick the simplest option first).
  - Environment configuration:
    - `OPENROUTER_API_KEY`.
    - Database connection URL.
    - Allowed origins for CORS (Vercel frontend URL).

- **Domain & Certificates**
  - Custom domain (e.g., `agentvault.app`) configured to point to Vercel frontend.
  - HTTPS termination handled by Vercel and hosting provider defaults.

---

## Tooling & Testing

- **Tooling**
  - Node + npm (or pnpm) for frontend.
  - Python 3.10+ for backend.
  - Package managers:
    - `npm`/`pnpm` for JS dependencies.
    - `pip`/`pip-tools` or `poetry` for Python dependencies.

- **Testing**
  - **Frontend**:
    - Testing framework such as Jest/React Testing Library for components.
    - Playwright or Cypress can be added later for E2E UI flows.
  - **Backend**:
    - **pytest** for unit/integration tests.
    - Use test fixtures for sample vault zips.
    - Mock LLM calls when validating processing logic.

---

## Future Additions (v2+)

- Support for Notion exports and other structured data sources.
- More advanced indexing/search (vector databases, embeddings).
- Rich visualizations for entities and relationships across vaults.

