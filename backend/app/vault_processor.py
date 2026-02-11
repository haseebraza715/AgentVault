import os
import time
from dataclasses import dataclass
from typing import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
import yaml

try:
    import spacy
except ImportError:  # pragma: no cover
    spacy = None

try:
    from markdown_it import MarkdownIt
except ImportError:  # pragma: no cover
    MarkdownIt = None

try:
    import requests
except ImportError:  # pragma: no cover
    requests = None


@dataclass
class ProcessResult:
    total_files: int
    processed_files: int
    entities: dict[str, int]


def should_skip_dir(path: str) -> bool:
    if path in (".", ""):
        return False
    parts = path.split(os.sep)
    return (
        any(part.startswith(".") and part not in (".", "") for part in parts)
        or ".obsidian" in parts
    )


def collect_markdown_files(vault_dir: str) -> list[str]:
    files: list[str] = []
    for root, dirs, filenames in os.walk(vault_dir):
        if should_skip_dir(os.path.relpath(root, vault_dir)):
            dirs[:] = []
            continue
        for file_name in filenames:
            if file_name.endswith(".md"):
                files.append(os.path.join(root, file_name))
    return files


def parse_frontmatter(content: str) -> tuple[dict, str]:
    if not content.lstrip().startswith("---"):
        return {}, content
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, content
    raw = parts[1].strip()
    body = parts[2].lstrip("\n")
    try:
        data = yaml.safe_load(raw) or {}
    except yaml.YAMLError:
        data = {}
    return data, body


def dump_frontmatter(data: dict) -> str:
    return "---\n" + yaml.safe_dump(data, sort_keys=False).strip() + "\n---\n\n"


def normalize_headings(content: str) -> str:
    lines = content.splitlines()
    output: list[str] = []
    for i, line in enumerate(lines):
        output.append(line)
        if line.startswith("#"):
            next_line = lines[i + 1] if i + 1 < len(lines) else ""
            if next_line.strip() != "":
                output.append("")
    return "\n".join(output) + "\n"


def ensure_frontmatter(content: str, title: str) -> str:
    data, body = parse_frontmatter(content)
    if "title" not in data:
        data["title"] = title
    return dump_frontmatter(data) + body


def extract_entities(content: str) -> list[str]:
    if spacy is None:
        return []
    try:
        nlp = spacy.load("en_core_web_sm")
    except Exception:
        return []
    doc = nlp(content)
    return [ent.text for ent in doc.ents]


def maybe_parse_markdown(content: str) -> None:
    if MarkdownIt is None:
        return
    md = MarkdownIt()
    md.parse(content)


def rewrite_with_llm(content: str) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key or requests is None:
        raise RuntimeError("OPENROUTER_API_KEY is required for processing.")

    model = os.getenv("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet")

    prompt = (
        "Rewrite the note for clarity and agent-friendliness. "
        "Preserve meaning, code blocks, links, and formatting. "
        "Add helpful headings and lists where appropriate."
    )

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a helpful editor."},
            {"role": "user", "content": f"{prompt}\n\nNOTE:\n{content}"},
        ],
    }

    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}"},
        json=payload,
        timeout=60,
    )

    if response.status_code != 200:
        raise RuntimeError(f"LLM request failed: {response.status_code}")

    data = response.json()
    return data["choices"][0]["message"]["content"]


class RateLimiter:
    def __init__(self, max_per_minute: int) -> None:
        self.max_per_minute = max_per_minute
        self.timestamps: list[float] = []
        self.lock = threading.Lock()

    def wait(self) -> None:
        if self.max_per_minute <= 0:
            return
        while True:
            with self.lock:
                now = time.time()
                self.timestamps = [t for t in self.timestamps if now - t < 60]
                if len(self.timestamps) < self.max_per_minute:
                    self.timestamps.append(now)
                    return
                sleep_for = 60 - (now - self.timestamps[0])
            time.sleep(max(0.1, sleep_for))


def rewrite_with_llm_rate_limited(content: str, rate_limiter: RateLimiter) -> str:
    rate_limiter.wait()
    return rewrite_with_llm(content)


def process_vault(
    vault_dir: str,
    progress_cb: Callable[[int, int], None] | None = None,
) -> ProcessResult:
    files = collect_markdown_files(vault_dir)
    total = len(files)
    processed = 0
    entity_counts: dict[str, int] = {}

    prepared: list[tuple[str, str]] = []
    for path in files:
        with open(path, "r", encoding="utf-8") as handle:
            content = handle.read()

        title = os.path.splitext(os.path.basename(path))[0]
        content = ensure_frontmatter(content, title)
        content = normalize_headings(content)
        maybe_parse_markdown(content)
        prepared.append((path, content))

    llm_enabled = bool(os.getenv("OPENROUTER_API_KEY")) and requests is not None
    max_workers = int(os.getenv("LLM_MAX_WORKERS", "4"))
    max_per_minute = int(os.getenv("LLM_REQUESTS_PER_MINUTE", "20"))

    if not llm_enabled:
        raise RuntimeError("LLM processing is required. Set OPENROUTER_API_KEY.")

    def finalize(path: str, content: str) -> None:
        nonlocal processed
        entities = extract_entities(content)
        for entity in entities:
            entity_counts[entity] = entity_counts.get(entity, 0) + 1
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(content)
        processed += 1
        if progress_cb:
            progress_cb(processed, total)
        time.sleep(0.01)

    limiter = RateLimiter(max_per_minute)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {
            executor.submit(rewrite_with_llm_rate_limited, content, limiter): (path, content)
            for path, content in prepared
        }
        for future in as_completed(future_map):
            path, original = future_map[future]
            try:
                rewritten = future.result()
            except Exception as exc:
                raise RuntimeError(f"LLM processing failed: {exc}") from exc
            finalize(path, rewritten)

    return ProcessResult(total_files=total, processed_files=processed, entities=entity_counts)


def write_index_files(vault_dir: str, entities: dict[str, int]) -> None:
    index_path = os.path.join(vault_dir, "index.md")
    entities_path = os.path.join(vault_dir, "entities.md")

    note_lines: list[str] = ["# Vault Index", ""]
    for path in collect_markdown_files(vault_dir):
        rel = os.path.relpath(path, vault_dir)
        note_lines.append(f"- {rel}")

    entity_lines: list[str] = ["# Entities", ""]
    for entity, count in sorted(entities.items(), key=lambda item: (-item[1], item[0])):
        entity_lines.append(f"- {entity}: {count}")

    with open(index_path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(note_lines) + "\n")

    with open(entities_path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(entity_lines) + "\n")


def write_preview_file(vault_dir: str, preview_path: str) -> None:
    md_files = collect_markdown_files(vault_dir)
    md_files.sort()
    preview_lines: list[str] = ["# AgentVault Preview", ""]

    for path in md_files:
        rel = os.path.relpath(path, vault_dir)
        preview_lines.append("---")
        preview_lines.append(f"## {rel}")
        preview_lines.append("")
        with open(path, "r", encoding="utf-8") as handle:
            preview_lines.append(handle.read().rstrip())
        preview_lines.append("")

    with open(preview_path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(preview_lines) + "\n")
