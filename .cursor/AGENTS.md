## Agent Instructions for AgentVault

AgentVault is a web app that takes an Obsidian-style vault (zip of markdown files), processes all `.md` files to be more agent-friendly (better structure, frontmatter, indexes), and returns a cleaned vault zip. The focus is on meaningful transformations, not placeholders.

### Project Overview

- **Frontend**: Next.js (TypeScript) with Tailwind CSS and Shadcn/Radix components.
- **Backend**: FastAPI (Python) with endpoints to upload a vault zip, process it, and return a cleaned zip.
- **Processing**:
  - Parse all markdown notes, handle YAML frontmatter, and extract entities (via spaCy).
  - Use LLMs via OpenRouter (e.g., Claude 3.5 Sonnet) to rewrite notes for clarity and agent-friendliness.
  - Generate global indexes such as `index.md` and `entities.md`.
- **Privacy**: Vault content is only stored in temp directories for the duration of processing and is deleted afterwards.

### Conventions and Constraints

- **No placeholder work**
  - Do not add stub functions or comments that do not perform real behavior unless they are immediately followed by a real implementation in the same session.
  - When implementing features, ship fully functional slices that a user could actually use.

- **Testing**
  - Whenever you add or change code that affects behavior, add at least basic tests (unit or integration) and run them if feasible.
  - At minimum, verify locally that the core upload → process → download flow still works after backend changes.

- **File size and complexity**
  - Try to keep individual source files between ~300 and 500 lines.
  - If a module grows much larger, consider extracting helpers or submodules.

### Useful Documentation

- Plan and roadmap: `docs/DEVELOPMENT_PLAN.md`
- Assumptions and decisions: `docs/ASSUMPTIONS.md`
- Tech stack overview: `docs/TECH_STACK.md`

When unsure about direction, prefer aligning with the documented phases in `docs/DEVELOPMENT_PLAN.md` before introducing new concepts.

