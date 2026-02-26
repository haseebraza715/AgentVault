import os
import re
import time
import json
import difflib
from collections import Counter
from dataclasses import dataclass
from typing import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
import yaml
from datetime import datetime, timezone

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
    entity_refs: dict[str, list[str]]
    deterministic_clean_notes: int = 0
    report_path: str | None = None


_NLP_MODEL = None
_NLP_MODEL_LOCK = threading.Lock()
WIKILINK_RE = re.compile(r"\[\[[^\]]+\]\]")
EMBED_RE = re.compile(r"!\[\[[^\]]+\]\]")
CODE_FENCE_RE = re.compile(r"```")
TASK_CHECKBOX_RE = re.compile(r"(?mi)^[ \t]*[-*]\s+\[(?:x|X| )\]\s+")
H2_SECTION_SPLIT_RE = re.compile(r"(?m)(?=^##\s+)")


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
    if not content.startswith("---\n"):
        return {}, content
    match = re.match(r"^---\n(.*?)\n---\n?", content, flags=re.DOTALL)
    if not match:
        return {}, content
    raw = match.group(1).strip()
    body = content[match.end() :]
    try:
        data = yaml.safe_load(raw) or {}
    except yaml.YAMLError:
        data = {}
    return data, body


def extract_frontmatter_block(content: str) -> tuple[str, dict, str]:
    if not content.startswith("---\n"):
        return "", {}, content
    match = re.match(r"^---\n(.*?)\n---\n?", content, flags=re.DOTALL)
    if not match:
        return "", {}, content
    block = content[: match.end()]
    raw = match.group(1).strip()
    body = content[match.end() :]
    try:
        data = yaml.safe_load(raw) or {}
    except yaml.YAMLError:
        data = {}
    if not isinstance(data, dict):
        data = {}
    return block, data, body


def dump_frontmatter(data: dict) -> str:
    return "---\n" + yaml.safe_dump(data, sort_keys=False).strip() + "\n---\n\n"


def _line_starts_fence(line: str) -> bool:
    return line.lstrip().startswith("```")


def _normalize_compare_whitespace(text: str) -> str:
    return "\n".join(part.strip() for part in text.strip().splitlines())


def _extract_top_frontmatter_range(text: str) -> tuple[int, int, str]:
    if not text.startswith("---\n"):
        return -1, -1, ""
    match = re.match(r"^---\n(.*?)\n---\n?", text, flags=re.DOTALL)
    if not match:
        return -1, -1, ""
    return 0, match.end(), text[: match.end()]


def ensure_frontmatter(content: str, title: str) -> str:
    data, body = parse_frontmatter(content)
    if "title" not in data:
        data["title"] = title
    return dump_frontmatter(data) + body


def should_rewrite_with_llm(rel_path: str) -> bool:
    normalized = rel_path.replace("\\", "/").lower()
    parts = [part for part in normalized.split("/") if part]
    if "templates" in parts:
        return False
    if "categories" in parts:
        return False
    return True


def _count_task_checkboxes(text: str) -> int:
    return len(TASK_CHECKBOX_RE.findall(text))


def _strip_llm_frontmatter(text: str) -> str:
    if not text.startswith("---\n"):
        return text
    match = re.match(r"^---\n.*?\n---\n?", text, flags=re.DOTALL)
    if not match:
        return text
    return text[match.end() :]


def _restore_embed_prefixes(original: str, rewritten: str) -> str:
    embed_targets = {match.group(1) for match in re.finditer(r"!\[\[([^\]]+)\]\]", original)}
    if not embed_targets:
        return rewritten
    restored = rewritten
    for target in embed_targets:
        escaped = re.escape(target)
        restored = re.sub(rf"(?<!!)\[\[{escaped}\]\]", f"![[{target}]]", restored)
    return restored


def _strip_frontmatter_metadata_echo(text: str, frontmatter_data: dict) -> str:
    if not frontmatter_data:
        return text
    keys = {str(key).strip().lower() for key in frontmatter_data.keys() if str(key).strip()}
    if not keys:
        return text
    lines = text.split("\n")
    out: list[str] = []
    removed_any = False
    in_fence = False
    for idx, line in enumerate(lines):
        if _line_starts_fence(line):
            in_fence = not in_fence
            out.append(line)
            continue
        if in_fence:
            out.append(line)
            continue
        if idx > 20:
            out.extend(lines[idx:])
            break
        stripped = line.strip()
        if not stripped:
            out.append(line)
            continue
        key_match = re.match(r"^\**([A-Za-z0-9 _-]{1,48})\**\s*:\s+.+$", stripped)
        if key_match and key_match.group(1).strip().lower() in keys:
            removed_any = True
            continue
        out.append(line)
    if not removed_any:
        return text
    return "\n".join(out).lstrip("\n")


def _promote_headings_if_first_h2(text: str) -> str:
    lines = text.split("\n")
    in_fence = False
    first_heading: str | None = None
    for line in lines:
        if _line_starts_fence(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if re.match(r"^#{1,6}\s+", line):
            first_heading = line
            break
    if first_heading is None or not first_heading.startswith("## "):
        return text
    out: list[str] = []
    in_fence = False
    for line in lines:
        if _line_starts_fence(line):
            in_fence = not in_fence
            out.append(line)
            continue
        if in_fence:
            out.append(line)
            continue
        match = re.match(r"^(#{2,6})(\s+.*)$", line)
        if match:
            out.append("#" * (len(match.group(1)) - 1) + match.group(2))
            continue
        out.append(line)
    return "\n".join(out)


def is_embed_only_note(body: str) -> bool:
    stripped = body.strip()
    if not stripped:
        return False
    in_fence = False
    has_embed_line = False
    for raw_line in body.split("\n"):
        line = raw_line.strip()
        if _line_starts_fence(raw_line):
            in_fence = not in_fence
            return False
        if in_fence or not line:
            continue
        if re.match(r"^#{1,6}\s+", line):
            continue
        if re.fullmatch(r"!\[\[[^\]]+\]\]", line):
            has_embed_line = True
            continue
        return False
    return has_embed_line


def is_metadata_only_note(body: str) -> bool:
    return len(body.strip()) < 50


def _split_for_llm_context(content: str, max_context_tokens: int) -> list[str]:
    token_estimate = len(content) / 4
    token_threshold = max_context_tokens * 0.8
    if token_estimate <= token_threshold:
        return [content]
    sections = [part for part in H2_SECTION_SPLIT_RE.split(content) if part.strip()]
    if len(sections) <= 1:
        return [content]
    chunk_limit_chars = int(token_threshold * 4)
    chunks: list[str] = []
    current = ""
    for section in sections:
        if len(current) + len(section) <= chunk_limit_chars or not current:
            current += section
        else:
            chunks.append(current)
            current = section
    if current:
        chunks.append(current)
    return chunks if len(chunks) > 1 else [content]


def validate_rewrite(original: str, rewritten: str) -> bool:
    return not rewrite_guard_failures(original, rewritten)


def rewrite_guard_failures(original: str, rewritten: str) -> list[str]:
    failures: list[str] = []
    original_wikilinks = len(WIKILINK_RE.findall(original))
    rewritten_wikilinks = len(WIKILINK_RE.findall(rewritten))
    original_embeds = len(EMBED_RE.findall(original))
    rewritten_embeds = len(EMBED_RE.findall(rewritten))
    original_fences = len(CODE_FENCE_RE.findall(original))
    rewritten_fences = len(CODE_FENCE_RE.findall(rewritten))
    original_tasks = _count_task_checkboxes(original)
    rewritten_tasks = _count_task_checkboxes(rewritten)
    original_len = len(original.strip())
    rewritten_len = len(rewritten.strip())

    if rewritten_len == 0:
        failures.append("empty_output")
    if original_fences != rewritten_fences:
        failures.append("code_fence_mismatch")
    if rewritten_embeds < original_embeds:
        failures.append("embed_loss")
    if original_wikilinks >= 2 and rewritten_wikilinks < max(1, int(original_wikilinks * 0.8)):
        failures.append("wikilink_loss")
    if rewritten_tasks < original_tasks:
        failures.append("task_checkbox_loss")
    if original_len >= 400 and rewritten_len < int(original_len * 0.55):
        failures.append("over_shortening")
    if "_posts/" in rewritten and "_posts/" not in original:
        failures.append("invented_path")
    return failures


def sanitize_markdown(text: str) -> tuple[str, list[str], bool]:
    findings: list[str] = []
    original_text = text
    original_wikilinks = len(WIKILINK_RE.findall(text))
    original_embeds = len(EMBED_RE.findall(text))

    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    if normalized != text:
        findings.append("normalize_line_endings")
    text = normalized

    lines = text.split("\n")
    out_lines: list[str] = []
    in_fence = False
    blank_run = 0
    for line in lines:
        if _line_starts_fence(line):
            in_fence = not in_fence
            blank_run = 0
            out_lines.append(line)
            continue
        if in_fence:
            out_lines.append(line)
            continue
        trimmed = line.rstrip(" \t")
        if trimmed != line:
            findings.append("strip_trailing_whitespace")
        if trimmed == "":
            blank_run += 1
            if blank_run <= 2:
                out_lines.append(trimmed)
            else:
                findings.append("collapse_blank_lines")
            continue
        blank_run = 0
        out_lines.append(trimmed)
    text = "\n".join(out_lines)

    fm_start, fm_end, top_frontmatter = _extract_top_frontmatter_range(text)
    if fm_start == 0:
        top_norm = _normalize_compare_whitespace(top_frontmatter)
        span_lines = text.split("\n")
        fence_state_by_line: list[bool] = []
        in_fence = False
        for line in span_lines:
            fence_state_by_line.append(in_fence)
            if _line_starts_fence(line):
                in_fence = not in_fence
        remove_spans: list[tuple[int, int]] = []
        for match in re.finditer(r"(?m)^---\n.*?\n---\n?", text[fm_end:], flags=re.DOTALL):
            start = fm_end + match.start()
            line_no = text[:start].count("\n")
            if line_no < len(fence_state_by_line) and fence_state_by_line[line_no]:
                continue
            block = match.group(0)
            if _normalize_compare_whitespace(block) == top_norm:
                remove_spans.append((start, fm_end + match.end()))
        if remove_spans:
            rebuilt: list[str] = []
            cursor = 0
            for start, end in remove_spans:
                rebuilt.append(text[cursor:start])
                cursor = end
            rebuilt.append(text[cursor:])
            text = "".join(rebuilt)
            findings.append("duplicate_frontmatter_removed")

    fm_start, fm_end, _ = _extract_top_frontmatter_range(text)
    if fm_start != 0:
        wrapper_lines = text.split("\n")
        idx = 0
        while idx < len(wrapper_lines):
            candidate = wrapper_lines[idx].strip()
            if candidate == "":
                idx += 1
                continue
            if (
                "[[" not in candidate
                and "![[" not in candidate
                and re.match(r"(?i)^(note:\s*frontmatter|here is.*frontmatter|sure!?\s*here is.*frontmatter)", candidate)
            ):
                idx += 1
                continue
            break
        if idx > 0:
            maybe = "\n".join(wrapper_lines[idx:])
            if _extract_top_frontmatter_range(maybe)[0] == 0:
                text = maybe
                findings.append("frontmatter_wrapper_removed")

    fm_start, fm_end, top_frontmatter = _extract_top_frontmatter_range(text)
    body_start = fm_end if fm_start == 0 else 0
    body = text[body_start:]
    if re.sub(r"\s+", "", body):
        duplicate_cut = -1
        if top_frontmatter:
            second_with_fm = text.find(top_frontmatter, max(fm_end, 1))
            if second_with_fm != -1:
                candidate = text[second_with_fm:]
                compare_a = re.sub(r"\s+", "", (top_frontmatter + body))
                compare_b = re.sub(r"\s+", "", candidate)
                ratio = difflib.SequenceMatcher(a=compare_a, b=compare_b).ratio()
                if ratio >= 0.92:
                    duplicate_cut = second_with_fm
        if duplicate_cut == -1:
            first_non_empty = ""
            for raw_line in body.split("\n"):
                stripped_line = raw_line.strip()
                if stripped_line:
                    first_non_empty = stripped_line
                    break
            if first_non_empty:
                anchor = first_non_empty
                first_anchor_pos = body.find(anchor)
                search_pos = body.find(anchor, first_anchor_pos + len(anchor))
                while search_pos != -1:
                    prefix = body[:search_pos]
                    suffix = body[search_pos:]
                    compare_a = re.sub(r"\s+", "", prefix)
                    compare_b = re.sub(r"\s+", "", suffix)
                    ratio = difflib.SequenceMatcher(a=compare_a, b=compare_b).ratio()
                    if (
                        search_pos >= int(len(body) * 0.35)
                        and compare_a
                        and compare_b
                        and ratio >= 0.92
                    ):
                        duplicate_cut = body_start + search_pos
                        break
                    search_pos = body.find(anchor, search_pos + 1)
        if duplicate_cut != -1:
            text = text[:duplicate_cut].rstrip("\n") + "\n"
            findings.append("duplicate_document_removed")

    lines = text.split("\n")
    out_lines = []
    i = 0
    in_fence = False
    while i < len(lines):
        line = lines[i]
        if _line_starts_fence(line):
            in_fence = not in_fence
            out_lines.append(line)
            i += 1
            continue
        if in_fence:
            out_lines.append(line)
            i += 1
            continue
        if line.startswith("<<<<<<<"):
            sep = i + 1
            while sep < len(lines) and not lines[sep].startswith("======="):
                sep += 1
            end = sep + 1
            while end < len(lines) and not lines[end].startswith(">>>>>>>"):
                end += 1
            if sep < len(lines) and end < len(lines):
                upper = lines[i + 1 : sep]
                lower = lines[sep + 1 : end]
                upper_joined = "\n".join(upper)
                lower_joined = "\n".join(lower)
                choose_lower = upper_joined != lower_joined and len(lower_joined) > len(upper_joined)
                chosen = lower if choose_lower else upper
                out_lines.extend(chosen)
                findings.append("conflict_markers_resolved_lower" if choose_lower else "conflict_markers_resolved_upper")
                i = end + 1
                continue
        out_lines.append(line)
        i += 1
    text = "\n".join(out_lines)

    lines = text.split("\n")
    in_fence = False
    lead_idx = 0
    trailing_idx = len(lines)
    wrapper_re = re.compile(r"(?i)^(sure!?\s*here is\b|here is the rewritten version\b|note:)")
    while lead_idx < len(lines):
        line = lines[lead_idx]
        if _line_starts_fence(line):
            break
        stripped = line.strip()
        if stripped == "":
            break
        if "[[" in line or "![[" in line:
            break
        if wrapper_re.match(stripped):
            lead_idx += 1
            continue
        break
    while trailing_idx > lead_idx:
        line = lines[trailing_idx - 1]
        if _line_starts_fence(line):
            break
        stripped = line.strip()
        if stripped == "":
            break
        if "[[" in line or "![[" in line:
            break
        if wrapper_re.match(stripped):
            trailing_idx -= 1
            continue
        break
    if lead_idx > 0 or trailing_idx < len(lines):
        lines = lines[lead_idx:trailing_idx]
        findings.append("wrapper_line_removed")

    out_lines = []
    in_fence = False
    for line in lines:
        if _line_starts_fence(line):
            in_fence = not in_fence
            out_lines.append(line)
            continue
        if in_fence:
            out_lines.append(line)
            continue
        fixed = re.sub(r"^(#{1,6})([^ #\t])", r"\1 \2", line)
        if fixed != line:
            findings.append("fix_heading_spacing")
        list_fixed = re.sub(r"^([ \t]*[-*])([^\s*\-].*)$", r"\1 \2", fixed)
        if list_fixed != fixed:
            findings.append("fix_list_spacing")
        out_lines.append(list_fixed)
    text = "\n".join(out_lines)

    if len(CODE_FENCE_RE.findall(text)) % 2 != 0:
        findings.append("unbalanced_code_fence")

    new_wikilinks = len(WIKILINK_RE.findall(text))
    new_embeds = len(EMBED_RE.findall(text))
    if (
        (new_wikilinks < original_wikilinks or new_embeds < original_embeds)
        and "duplicate_document_removed" not in findings
    ):
        text = original_text
        findings.append("reverted_due_to_link_loss")

    unique_findings = sorted(set(findings))
    changed = text != original_text
    return text, unique_findings, changed


def extract_entities(content: str) -> list[str]:
    from_links = [match.strip() for match in re.findall(r"\[\[([^#\]|]+)", content)]

    if from_links:
        return from_links
    if spacy is None:
        return []
    global _NLP_MODEL
    try:
        with _NLP_MODEL_LOCK:
            if _NLP_MODEL is None:
                _NLP_MODEL = spacy.load("en_core_web_sm")
    except Exception:
        return []
    doc = _NLP_MODEL(content)
    return [ent.text for ent in doc.ents]


def maybe_parse_markdown(content: str) -> None:
    if MarkdownIt is None:
        return
    md = MarkdownIt()
    md.parse(content)


class LLMRequestError(RuntimeError):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code

    @property
    def retryable(self) -> bool:
        return self.status_code == 429 or 500 <= self.status_code <= 599


def rewrite_with_llm(content: str, light_mode: bool = False) -> str:
    if requests is None:
        raise RuntimeError("requests is required for processing.")

    openai_api_key = (os.getenv("OpenAI_API_KEY") or os.getenv("OPENAI_API_KEY") or "").strip()
    openrouter_api_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()

    if not openai_api_key and not openrouter_api_key:
        raise RuntimeError("Set OPENAI_API_KEY or OPENROUTER_API_KEY for processing.")

    base_rules = (
        "Rules:\n"
        "- Return markdown body only (no YAML frontmatter).\n"
        "- Preserve ALL [[wikilinks]] exactly as-is. Never convert them to plain text, italics, or bold.\n"
        "- Preserve ALL ![[embeds]] exactly as-is. Keep the ! prefix.\n"
        "- Preserve ALL task checkboxes: - [x] and - [ ] must remain unchanged.\n"
        "- Preserve all code fences and URLs.\n"
        "- Do not invent content.\n"
        "- If the note body is empty or only contains embeds, return it exactly as-is.\n"
        "- Do not duplicate metadata that belongs in frontmatter.\n"
    )
    if light_mode:
        prompt = (
            "Light rewrite only.\n"
            f"{base_rules}"
            "- Make minimal edits for grammar/clarity.\n"
            "- Keep wording and structure very close to original.\n"
            "- Do not add/remove sections.\n"
        )
    else:
        prompt = (
            "Rewrite the note body for clarity and agent-friendliness.\n"
            f"{base_rules}"
            "- Keep structure close to the original; improve wording and readability.\n"
        )
    seed = int(os.getenv("LLM_SEED", "42"))

    if openai_api_key:
        model = (os.getenv("OpenAI_MODEL") or os.getenv("OPENAI_MODEL") or "gpt-4o").strip()
        payload = {
            "model": model,
            "temperature": 0,
            "seed": seed,
            "messages": [
                {"role": "system", "content": "You are a helpful editor."},
                {"role": "user", "content": f"{prompt}\n\nNOTE BODY:\n{content}"},
            ],
        }
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {openai_api_key}"},
            json=payload,
            timeout=60,
        )
    else:
        model = (os.getenv("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet")).strip()
        payload = {
            "model": model,
            "temperature": 0,
            "seed": seed,
            "messages": [
                {"role": "system", "content": "You are a helpful editor."},
                {"role": "user", "content": f"{prompt}\n\nNOTE BODY:\n{content}"},
            ],
        }
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {openrouter_api_key}"},
            json=payload,
            timeout=60,
        )

    if response.status_code != 200:
        raise LLMRequestError(response.status_code, f"LLM request failed: {response.status_code}")

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


def rewrite_with_llm_with_retries(
    content: str,
    rate_limiter: RateLimiter,
    light_mode: bool,
) -> tuple[str, int]:
    retries_used = 0
    max_retries = 2
    for attempt in range(max_retries + 1):
        rate_limiter.wait()
        try:
            return rewrite_with_llm(content, light_mode=light_mode), retries_used
        except LLMRequestError as exc:
            if attempt >= max_retries or not exc.retryable:
                raise
            retries_used += 1
            time.sleep(2**retries_used)
    raise RuntimeError("Unreachable retry loop termination.")


def rewrite_with_llm_rate_limited(
    content: str,
    rate_limiter: RateLimiter,
    light_mode: bool,
) -> tuple[str, int, bool]:
    max_context_tokens = int(os.getenv("LLM_CONTEXT_WINDOW", "128000"))
    chunks = _split_for_llm_context(content, max_context_tokens)
    retries_total = 0
    rewritten_parts: list[str] = []
    for chunk in chunks:
        rewritten_chunk, retries_used = rewrite_with_llm_with_retries(
            chunk, rate_limiter, light_mode
        )
        retries_total += retries_used
        if len(chunks) == 1:
            rewritten_parts.append(rewritten_chunk)
        else:
            rewritten_parts.append(rewritten_chunk.strip())
    if len(chunks) == 1:
        return rewritten_parts[0], retries_total, False
    return "\n\n".join(part for part in rewritten_parts if part), retries_total, True


def process_vault(
    vault_dir: str,
    vault_id: str | None = None,
    started_at: str | None = None,
    progress_cb: Callable[[int, int], None] | None = None,
) -> ProcessResult:
    files = collect_markdown_files(vault_dir)
    total = len(files)
    processed = 0
    entity_counts: dict[str, int] = {}
    entity_ref_sets: dict[str, set[str]] = {}
    deterministic_clean_notes = 0
    rewritten_notes = 0
    skipped_notes = 0
    llm_skipped_notes = 0
    failed_validation_notes = 0
    llm_error_notes = 0
    deterministic_sanitized_notes = 0
    duplicate_document_removed_count = 0
    duplicate_frontmatter_removed_count = 0
    conflict_markers_resolved_count = 0
    metadata_only_notes = 0
    stub_notes = 0
    unchanged_original_notes = 0
    frontmatter_preservation_fallbacks = 0
    llm_retry_attempts = 0
    llm_chunked_notes = 0
    per_note: list[dict[str, object]] = []

    prepared: list[dict[str, object]] = []
    formatting_and_dup_findings = {
        "normalize_line_endings",
        "strip_trailing_whitespace",
        "collapse_blank_lines",
        "fix_heading_spacing",
        "fix_list_spacing",
        "duplicate_document_removed",
        "duplicate_frontmatter_removed",
        "frontmatter_wrapper_removed",
        "wrapper_line_removed",
    }
    for path in files:
        with open(path, "r", encoding="utf-8") as handle:
            original_content = handle.read()

        rel_path = os.path.relpath(path, vault_dir)
        original_frontmatter_block, data, original_body = extract_frontmatter_block(original_content)
        full_has_no_rewrite_tag = bool(re.search(r"(?<!\S)#no-rewrite\b", original_content))
        rewrite_disabled = data.get("rewrite") is False
        allowed_for_llm = should_rewrite_with_llm(rel_path)
        rewrite_mode = str(data.get("rewrite_mode", "")).strip().lower()
        light_mode = rewrite_mode == "light"
        skip_reason = ""
        if rewrite_disabled:
            skip_reason = "rewrite_false"
        elif full_has_no_rewrite_tag:
            skip_reason = "tag_no_rewrite"
        elif not allowed_for_llm:
            skip_reason = "path_policy_skip"
        if skip_reason in {"rewrite_false", "tag_no_rewrite", "path_policy_skip"}:
            skipped_notes += 1
            llm_skipped_notes += 1
            deterministic_clean_notes += 1
            unchanged_original_notes += 1
            per_note.append(
                {
                    "path": rel_path,
                    "action": "unchanged_original",
                    "reason": skip_reason,
                    "before_chars": len(original_body),
                    "after_chars": len(original_body),
                    "findings": [],
                    "requires_llm": False,
                    "guards_failed": [],
                }
            )
            prepared.append(
                {
                    "path": path,
                    "rel_path": rel_path,
                    "original_content": original_content,
                    "original_frontmatter_block": original_frontmatter_block,
                    "frontmatter_block": original_frontmatter_block,
                    "frontmatter_data": data,
                    "original_body": original_body,
                    "input_body": original_body,
                    "fallback_body": original_body,
                    "use_llm": False,
                    "rewrite_mode": "light" if light_mode else "default",
                    "findings": [],
                    "sanitization_reverted": False,
                    "exact_original": True,
                    "skip_reason": skip_reason,
                }
            )
            continue

        sanitized_full, findings, changed = sanitize_markdown(original_content)
        _, _, sanitized_body = extract_frontmatter_block(sanitized_full)
        if not original_frontmatter_block:
            sanitized_body = sanitized_full
        sanitization_reverted = "reverted_due_to_link_loss" in findings
        if changed:
            deterministic_sanitized_notes += 1
        if "duplicate_document_removed" in findings:
            duplicate_document_removed_count += 1
        if "duplicate_frontmatter_removed" in findings:
            duplicate_frontmatter_removed_count += 1
        if any(item.startswith("conflict_markers_resolved_") for item in findings):
            conflict_markers_resolved_count += 1

        findings_set = set(findings)
        paragraphs = [p.strip() for p in re.split(r"\n{2,}", sanitized_body) if p.strip()]
        has_long_paragraph = any(len(p) > 200 for p in paragraphs)
        only_formatting_or_dup = bool(findings_set) and findings_set.issubset(formatting_and_dup_findings)
        metadata_only = is_metadata_only_note(sanitized_body)
        embed_only = is_embed_only_note(sanitized_body)
        stub_note = len(sanitized_body.strip()) < 100 or embed_only
        skip_reason = ""
        if metadata_only:
            skip_reason = "metadata_only"
        elif stub_note:
            skip_reason = "stub_note"
        elif "unbalanced_code_fence" in findings_set:
            skip_reason = "deterministic_clean"
        elif (only_formatting_or_dup and len(sanitized_body) < 500) or not has_long_paragraph:
            skip_reason = "deterministic_clean"

        final_input_body = sanitized_body
        fallback_body = original_body if sanitization_reverted else sanitized_body
        maybe_parse_markdown(final_input_body)
        use_llm = skip_reason == ""
        if skip_reason in {"deterministic_clean", "metadata_only", "stub_note"}:
            deterministic_clean_notes += 1
            if skip_reason == "metadata_only":
                metadata_only_notes += 1
            if skip_reason == "stub_note":
                stub_notes += 1
        if not use_llm:
            skipped_notes += 1
            llm_skipped_notes += 1
            per_note.append(
                {
                    "path": rel_path,
                    "action": "sanitized_only",
                    "reason": skip_reason,
                    "before_chars": len(original_body),
                    "after_chars": len(final_input_body),
                    "findings": findings,
                    "requires_llm": False,
                    "guards_failed": [],
                }
            )
        prepared.append(
            {
                "path": path,
                "rel_path": rel_path,
                "original_content": original_content,
                "original_frontmatter_block": original_frontmatter_block,
                "frontmatter_block": original_frontmatter_block,
                "frontmatter_data": data,
                "original_body": original_body,
                "input_body": final_input_body,
                "fallback_body": fallback_body,
                "use_llm": use_llm,
                "rewrite_mode": "light" if light_mode else "default",
                "findings": findings,
                "sanitization_reverted": sanitization_reverted,
                "exact_original": False,
                "skip_reason": skip_reason,
            }
        )

    llm_enabled = bool(
        (os.getenv("OpenAI_API_KEY") or "").strip()
        or (os.getenv("OPENAI_API_KEY") or "").strip()
        or (os.getenv("OPENROUTER_API_KEY") or "").strip()
    ) and requests is not None
    llm_tasks = sum(1 for item in prepared if bool(item["use_llm"]))
    max_workers = int(os.getenv("LLM_MAX_WORKERS", "4"))
    max_per_minute = int(os.getenv("LLM_REQUESTS_PER_MINUTE", "20"))

    if llm_tasks > 0 and not llm_enabled:
        raise RuntimeError("LLM processing is required. Set OPENAI_API_KEY or OPENROUTER_API_KEY.")

    def finalize(note: dict[str, object], body: str | None = None, use_original: bool = False) -> None:
        nonlocal processed, frontmatter_preservation_fallbacks
        path = str(note["path"])
        rel_path = str(note["rel_path"])
        original_content = str(note["original_content"])
        if use_original:
            content = original_content
        else:
            frontmatter = str(note["frontmatter_block"] or "")
            output_body = str(body if body is not None else note["input_body"])
            if frontmatter:
                content = frontmatter + output_body
            else:
                content = output_body
            original_frontmatter = str(note["original_frontmatter_block"] or "")
            if original_frontmatter and not content.startswith("---\n"):
                frontmatter_preservation_fallbacks += 1
                content = original_frontmatter + output_body

        original_entity_counts = Counter(extract_entities(original_content))
        processed_entity_counts = Counter(extract_entities(content))
        merged_entities = set(original_entity_counts) | set(processed_entity_counts)
        for entity in merged_entities:
            count = max(original_entity_counts.get(entity, 0), processed_entity_counts.get(entity, 0))
            if count <= 0:
                continue
            entity_counts[entity] = entity_counts.get(entity, 0) + count
            refs = entity_ref_sets.setdefault(entity, set())
            refs.add(rel_path)

        with open(path, "w", encoding="utf-8") as handle:
            handle.write(content)
        processed += 1
        if progress_cb:
            progress_cb(processed, total)
        time.sleep(0.01)

    limiter = RateLimiter(max_per_minute)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map: dict[object, dict[str, object]] = {}
        for note in prepared:
            if note["use_llm"]:
                future = executor.submit(
                    rewrite_with_llm_rate_limited,
                    str(note["input_body"]),
                    limiter,
                    str(note["rewrite_mode"]) == "light",
                )
                future_map[future] = note
            else:
                finalize(note, use_original=bool(note["exact_original"]))

        for future in as_completed(future_map):
            note = future_map[future]
            rel_path = str(note["rel_path"])
            sanitized_body = str(note["input_body"])
            fallback_body = str(note["fallback_body"])
            findings = list(note["findings"])
            sanitization_reverted = bool(note["sanitization_reverted"])
            guard_failures: list[str] = []
            retry_count = 0
            chunked = False
            try:
                rewritten, retry_count, chunked = future.result()
            except Exception:
                llm_error_notes += 1
                rewritten = fallback_body
                fallback_action = "fallback_original" if sanitization_reverted else "fallback_sanitized"
                per_note.append(
                    {
                        "path": rel_path,
                        "action": fallback_action,
                        "reason": "llm_error",
                        "before_chars": len(sanitized_body),
                        "after_chars": len(rewritten),
                        "findings": findings,
                        "requires_llm": True,
                        "guards_failed": [],
                        "retry_count": retry_count,
                        "chunked": chunked,
                    }
                )
                finalize(note, rewritten)
                continue
            llm_retry_attempts += retry_count
            if chunked:
                llm_chunked_notes += 1
            rewritten = _strip_llm_frontmatter(rewritten)
            rewritten = _restore_embed_prefixes(sanitized_body, rewritten)
            rewritten = _strip_frontmatter_metadata_echo(rewritten, dict(note["frontmatter_data"]))
            rewritten = _promote_headings_if_first_h2(rewritten)
            maybe_parse_markdown(rewritten)
            guard_failures = rewrite_guard_failures(sanitized_body, rewritten)
            if len(WIKILINK_RE.findall(sanitized_body)) >= 2:
                wikilink_drop = len(WIKILINK_RE.findall(rewritten)) < max(
                    1, int(len(WIKILINK_RE.findall(sanitized_body)) * 0.8)
                )
                if wikilink_drop and "wikilink_loss" not in guard_failures:
                    guard_failures.append("wikilink_drop_gt20")
            if guard_failures:
                failed_validation_notes += 1
                rewritten = fallback_body
                fallback_action = "fallback_original" if sanitization_reverted else "fallback_sanitized"
                per_note.append(
                    {
                        "path": rel_path,
                        "action": fallback_action,
                        "reason": "guard_failed",
                        "before_chars": len(sanitized_body),
                        "after_chars": len(rewritten),
                        "findings": findings,
                        "requires_llm": True,
                        "guards_failed": guard_failures,
                        "retry_count": retry_count,
                        "chunked": chunked,
                    }
                )
            else:
                rewritten_notes += 1
                per_note.append(
                    {
                        "path": rel_path,
                        "action": "llm_rewrite",
                        "reason": "ok",
                        "before_chars": len(sanitized_body),
                        "after_chars": len(rewritten),
                        "findings": findings,
                        "requires_llm": True,
                        "guards_failed": [],
                        "retry_count": retry_count,
                        "chunked": chunked,
                    }
                )
            finalize(note, rewritten)

    report_started = started_at or datetime.now(timezone.utc).isoformat()
    report_finished = datetime.now(timezone.utc).isoformat()
    summary = (
        f"{rewritten_notes} rewritten, {skipped_notes} skipped, "
        f"{failed_validation_notes + llm_error_notes} fallback"
    )
    report = {
        "vault_id": vault_id or "",
        "started_at": report_started,
        "finished_at": report_finished,
        "counts": {
            "total_notes": total,
            "rewritten_notes": rewritten_notes,
            "skipped_notes": skipped_notes,
            "llm_skipped_notes": llm_skipped_notes,
            "failed_validation_notes": failed_validation_notes,
            "llm_error_notes": llm_error_notes,
            "deterministic_sanitized_notes": deterministic_sanitized_notes,
            "duplicate_document_removed_count": duplicate_document_removed_count,
            "duplicate_frontmatter_removed_count": duplicate_frontmatter_removed_count,
            "conflict_markers_resolved_count": conflict_markers_resolved_count,
            "metadata_only_notes": metadata_only_notes,
            "stub_notes": stub_notes,
            "unchanged_original_notes": unchanged_original_notes,
            "frontmatter_preservation_fallbacks": frontmatter_preservation_fallbacks,
            "llm_retry_attempts": llm_retry_attempts,
            "llm_chunked_notes": llm_chunked_notes,
        },
        "per_note": per_note,
        "summary": summary,
    }
    report_path = os.path.join(vault_dir, "report.json")
    with open(report_path, "w", encoding="utf-8") as report_handle:
        json.dump(report, report_handle, indent=2)

    return ProcessResult(
        total_files=total,
        processed_files=processed,
        entities=entity_counts,
        entity_refs={key: sorted(value) for key, value in entity_ref_sets.items()},
        deterministic_clean_notes=deterministic_clean_notes,
        report_path=report_path,
    )


def _strip_common_root(paths: list[str]) -> tuple[list[str], str]:
    first_parts = {path.split("/", 1)[0] for path in paths if "/" in path}
    if len(first_parts) != 1:
        return paths, ""
    root = next(iter(first_parts))
    stripped = [path[len(root) + 1 :] if path.startswith(root + "/") else path for path in paths]
    return stripped, root


def _group_for_path(path: str) -> str:
    normalized = path.replace("\\", "/")
    parts = [part for part in normalized.split("/") if part]
    if not parts:
        return "Notes"
    top = parts[0].lower()
    if top == "references":
        return "References"
    if top == "clippings":
        return "Clippings"
    if top == "templates":
        return "Templates"
    if top == "categories":
        return "Categories"
    if top == "daily":
        return "Daily"
    if top == "notes":
        return "Notes"
    return "Notes"


def write_index_files(
    vault_dir: str,
    entities: dict[str, int],
    entity_refs: dict[str, list[str]] | None = None,
) -> None:
    index_path = os.path.join(vault_dir, "index.md")
    entities_path = os.path.join(vault_dir, "entities.md")
    files = sorted(os.path.relpath(path, vault_dir).replace("\\", "/") for path in collect_markdown_files(vault_dir))
    display_paths, common_root = _strip_common_root(files)
    grouped_paths: dict[str, list[tuple[str, str]]] = {}
    for original_path, display_path in zip(files, display_paths):
        group = _group_for_path(display_path)
        grouped_paths.setdefault(group, []).append((original_path, display_path))

    notes_count = len(grouped_paths.get("Notes", []))
    references_count = len(grouped_paths.get("References", []))
    templates_count = len(grouped_paths.get("Templates", []))
    categories_count = len(grouped_paths.get("Categories", []))
    clippings_count = len(grouped_paths.get("Clippings", []))
    daily_count = len(grouped_paths.get("Daily", []))

    note_lines: list[str] = ["# Vault Index", ""]
    if common_root:
        note_lines.append(f"- Root folder: `{common_root}`")
    note_lines.append(
        f"- Summary: {notes_count} notes, {references_count} references, "
        f"{clippings_count} clippings, {daily_count} daily, {templates_count} templates, {categories_count} categories"
    )
    note_lines.append("")

    group_order = ["Notes", "References", "Clippings", "Daily", "Templates", "Categories"]
    for group in group_order:
        rows = grouped_paths.get(group, [])
        if not rows:
            continue
        note_lines.append(f"## {group} ({len(rows)})")
        note_lines.append("")
        for _original, display in rows:
            note_lines.append(f"- {display}")
        note_lines.append("")

    entity_lines: list[str] = ["# Entities", ""]
    refs = entity_refs or {}
    entities_by_group: dict[str, dict[str, list[str]]] = {}
    for entity, paths in refs.items():
        for path in paths:
            display_path = path.replace("\\", "/")
            if common_root and display_path.startswith(common_root + "/"):
                display_path = display_path[len(common_root) + 1 :]
            group = _group_for_path(display_path)
            entities_by_group.setdefault(group, {}).setdefault(entity, []).append(display_path)

    if entities_by_group:
        for group in group_order:
            entity_map = entities_by_group.get(group, {})
            if not entity_map:
                continue
            entity_lines.append(f"## {group}")
            entity_lines.append("")
            for entity, note_paths in sorted(
                entity_map.items(),
                key=lambda item: (-entities.get(item[0], 0), item[0].lower()),
            ):
                unique_refs = sorted(set(note_paths))
                refs_text = ", ".join(unique_refs)
                entity_lines.append(f"- {entity} ({entities.get(entity, 0)}): {refs_text}")
            entity_lines.append("")
    else:
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
