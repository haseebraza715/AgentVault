---
name: agentvault-vault-processing
description: Guides the agent through processing Obsidian-style vaults in AgentVault, including scanning markdown files, handling frontmatter, extracting entities with spaCy, and invoking OpenRouter LLMs for rewriting notes.
---

# AgentVault Vault Processing

## Instructions

- **Vault structure**
  - Treat the uploaded vault as a zip containing folders of `.md` files.
  - Ignore `.obsidian` and other hidden/system directories.
  - Work against a per-request temp directory, not the original zip.

- **Markdown handling**
  - For each markdown file:
    - Read the file content as UTF-8.
    - Detect and parse YAML frontmatter using `PyYAML`.
      - If frontmatter is missing, create a minimal one with at least `title` and `tags` keys.
    - Optionally, use `markdown-it-py` or `mistune` to understand headings and sections before rewriting.

- **Entity extraction with spaCy**
  - Load the `en_core_web_sm` model once at startup or in a shared context.
  - For each note body (excluding frontmatter):
    - Run `doc = nlp(text)` and collect `doc.ents` (e.g., names, organizations, dates).
    - Store relevant entities either in frontmatter fields (e.g., `entities`, `people`, `places`) or in a separate data structure used to build `entities.md`.

- **LLM-powered rewriting via OpenRouter**
  - Use OpenRouter with models like `anthropic/claude-3.5-sonnet` to rewrite notes.
  - Prompt guidelines:
    - Preserve meaning, code blocks, and links exactly.
    - Improve structure with clear headings, lists, and sections.
    - Make the note more explicit and self-contained for AI agents.
  - Implement batching or concurrency (e.g., with `asyncio`) while respecting rate limits and timeouts.

- **Global artifacts**
  - After processing all notes:
    - Create an `index.md` that lists all notes by title and relative path, optionally grouped or tagged.
    - Create an `entities.md` summarizing entities across the vault; group them by type (people, organizations, etc.).

- **Output**
  - Write all transformed notes and global index files into a new directory, mirroring the original structure.
  - The backend will zip this directory to produce the cleaned vault for download.

## Examples

- **Example tasks this skill should handle**
  - Given an unzipped vault directory, produce a list of all `.md` files to process.
  - For a given markdown file, show how to:
    - Parse YAML frontmatter.
    - Extract entities with spaCy.
    - Prepare a prompt and call the OpenRouter API to rewrite the body.
  - Given a collection of processed notes, outline how to build `index.md` and `entities.md`.

