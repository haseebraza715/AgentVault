import argparse
import json
import re
from pathlib import Path

import yaml


WIKILINK_RE = re.compile(r"\[\[[^\]]+\]\]")
EMBED_RE = re.compile(r"!\[\[[^\]]+\]\]")


def parse_frontmatter(text: str) -> tuple[bool, dict]:
    if not text.startswith("---\n"):
        return False, {}
    match = re.match(r"^---\n(.*?)\n---\n?", text, flags=re.DOTALL)
    if not match:
        return False, {}
    try:
        data = yaml.safe_load(match.group(1)) or {}
        return True, data if isinstance(data, dict) else {}
    except yaml.YAMLError:
        return False, {}


def run() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, help="Processed vault root")
    args = parser.parse_args()

    root = Path(args.root)
    files = sorted(root.rglob("*.md"))
    findings: list[str] = []

    frontmatter_ok = 0
    template_with_frontmatter = 0
    empty_entities = False
    short_notes = 0
    total_wikilinks = 0
    total_embeds = 0

    for path in files:
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(root).as_posix()
        has_frontmatter, _ = parse_frontmatter(text)
        if has_frontmatter:
            frontmatter_ok += 1
        if "/Templates/" in rel and has_frontmatter:
            template_with_frontmatter += 1
        if len([line for line in text.splitlines() if line.strip()]) < 5:
            short_notes += 1

        total_wikilinks += len(WIKILINK_RE.findall(text))
        total_embeds += len(EMBED_RE.findall(text))

        if rel == "entities.md":
            lines = [line for line in text.splitlines() if line.strip()]
            if len(lines) <= 1:
                empty_entities = True

        if "_posts/" in text:
            findings.append(f"Unexpected path pattern in {rel}: contains _posts/")
        if text.startswith("NOTE:\n---"):
            findings.append(f"Non-standard leading NOTE marker in {rel}")

    metrics = {
        "md_files": len(files),
        "frontmatter_ok_files": frontmatter_ok,
        "template_files_with_frontmatter": template_with_frontmatter,
        "short_notes_lt5_nonempty_lines": short_notes,
        "total_wikilinks": total_wikilinks,
        "total_embeds": total_embeds,
        "entities_empty": empty_entities,
        "findings": findings[:50],
    }
    print(json.dumps(metrics, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
