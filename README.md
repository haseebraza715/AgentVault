## AgentVault

AgentVault is a web app that takes an Obsidian-style vault (zip of markdown files), processes all `.md` notes to be more agent-friendly (better structure, frontmatter, and indexes), and returns a cleaned vault zip.

This repository currently contains the project plan and context; implementation will follow the documented phases.

---

## Project Docs

- **Development plan**: see `docs/DEVELOPMENT_PLAN.md` for phases, milestones, and timelines.
- **Assumptions & decisions**: see `docs/ASSUMPTIONS.md` for scope, privacy, LLM usage, and architecture assumptions.
- **Tech stack**: see `docs/TECH_STACK.md` for a summary of frontend, backend, and deployment technologies.

---

## Cursor Configuration

Project-specific guidance for agents is stored under `.cursor/`:

- `AGENTS.md` – High-level overview and conventions (no placeholder code, testing, file size targets).
- `rules/` – Project rules:
  - `agentvault-project.mdc` – Always-apply project-level conventions.
  - `backend-fastapi.mdc` – Backend-specific patterns for FastAPI and OpenRouter.
  - `frontend-nextjs.mdc` – Frontend-specific patterns for Next.js and upload UX.
- `skills/` – Project skills used by Cursor agents:
  - `agentvault-vault-processing/SKILL.md`
  - `agentvault-file-handling/SKILL.md`
  - `agentvault-llm-integration/SKILL.md`

These files help keep future development aligned with the plan and avoid re-discussing core choices.

