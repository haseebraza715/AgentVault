---
name: agentvault-file-handling
description: Describes how AgentVault handles vault zip uploads, temp directories, size limits, and creation of cleaned vault zips on the backend.
---

# AgentVault File Handling

## Instructions

- **Upload behavior**
  - The frontend sends vaults as zip files via multipart form-data.
  - The backend exposes an endpoint like `POST /upload-vault` that:
    - Validates the file size and type (rejects overly large or non-zip files).
    - Writes the zip to a unique temp file on disk.
    - Extracts the contents into a per-request temp directory.

- **Temp directories**
  - Use a dedicated temp root (e.g., under the system temp directory) with one subdirectory per job or vault.
  - Naming can include a random or UUID suffix to avoid collisions.
  - All subsequent processing (markdown scanning, LLM calls, index generation) operates against this temp folder.

- **File discovery**
  - Use `os.walk` or equivalent to discover `.md` files.
  - Skip hidden directories (starting with `.`) and `.obsidian` configuration folders.
  - Keep relative paths so the final cleaned vault mirrors the original structure.

- **Limits and safety**
  - Enforce:
    - Maximum zip size (e.g., 100 MB for free tier).
    - Maximum number of markdown files (e.g., 500) per job.
  - Inspect the zip contents briefly to ensure there are no executable or obviously malicious files.

- **Output zipping**
  - After processing, write all transformed files into a new output directory.
  - Zip that directory into a cleaned vault zip.
  - Stream the cleaned zip back via a `GET /download/{vault_id}` (or equivalent) endpoint.

- **Cleanup**
  - Once the response is served (or after a short TTL), remove:
    - The original uploaded zip.
    - The unzipped vault directory.
    - The output directory and cleaned zip.
  - Avoid leaving user data on disk beyond what is necessary for processing.

## Examples

- Outline a typical flow:
  1. Receive vault upload.
  2. Save to temp file and unzip to temp directory.
  3. Call the vault processing service on that directory.
  4. Zip processed output and return it to the client.
  5. Clean up all temp data.

