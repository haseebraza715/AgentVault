---
name: agentvault-llm-integration
description: Explains how AgentVault integrates with OpenRouter LLMs for rewriting notes, including model selection, prompting, and safety considerations.
---

# AgentVault LLM Integration

## Instructions

- **OpenRouter setup**
  - Read the OpenRouter API key from an environment variable (e.g., `OPENROUTER_API_KEY`).
  - Use `requests` or a small HTTP client to call the OpenRouter API.
  - Configure sensible timeouts and minimal retries to avoid hanging processing jobs.

- **Model selection**
  - Default to high-quality models such as `anthropic/claude-3.5-sonnet` for rewriting and structuring notes.
  - Optionally, provide a way to switch to cheaper models (e.g., strong open-source models served via OpenRouter) when cost is a concern.

- **Prompt design**
  - Prompts should instruct the model to:
    - Preserve original meaning and nuance.
    - Keep code blocks and links intact.
    - Enhance clarity and structure for downstream AI agents.
  - Include explicit instructions not to add fabricated details or hallucinate content.

- **Usage pattern**
  - For each note body:
    - Build a prompt that includes relevant context (frontmatter, headings) without exceeding token limits.
    - Send a single request per note, or small batches, to OpenRouter.
  - Use async concurrency where appropriate, but respect rate limits and error responses.

- **Safety and privacy**
  - Never log raw prompts or responses that contain user note content.
  - Log only high-level metadata, such as:
    - Number of tokens used.
    - Model names.
    - Success/failure statuses.

## Examples

- Given a markdown note body and frontmatter, outline:
  - How to build a prompt string tailored to AgentVault’s use case.
  - How to construct the OpenRouter API request.
  - How to incorporate the LLM’s response back into the final markdown file.

