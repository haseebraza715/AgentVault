import json
import os
import tempfile
import time
import unittest
from contextlib import contextmanager

from fastapi import HTTPException

from app.main import JOB_TTL_MINUTES, diff_note, maybe_cleanup_job, vault_store
from app import vault_processor
from app.vault_processor import process_vault


class DummyBackgroundTasks:
    def __init__(self) -> None:
        self.tasks: list[tuple[object, tuple[object, ...], dict[str, object]]] = []

    def add_task(self, fn: object, *args: object, **kwargs: object) -> None:
        self.tasks.append((fn, args, kwargs))


@contextmanager
def patched_llm(return_body: str):
    original = vault_processor.rewrite_with_llm_rate_limited
    original_openai = os.environ.get("OPENAI_API_KEY")
    os.environ["OPENAI_API_KEY"] = "test-key"

    def fake_rewrite(_content: str, _limiter: object, _light_mode: bool) -> tuple[str, int, bool]:
        return return_body, 0, False

    vault_processor.rewrite_with_llm_rate_limited = fake_rewrite
    try:
        yield
    finally:
        vault_processor.rewrite_with_llm_rate_limited = original
        if original_openai is None:
            os.environ.pop("OPENAI_API_KEY", None)
        else:
            os.environ["OPENAI_API_KEY"] = original_openai


class PolicyAndDiffTests(unittest.TestCase):
    def test_rewrite_false_forces_skip(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            note_path = os.path.join(tmp, "note.md")
            original = (
                "---\n"
                "rewrite: false\n"
                "title: Policy Test\n"
                "---\n\n"
                + ("A" * 450)
            )
            with open(note_path, "w", encoding="utf-8") as handle:
                handle.write(original)

            result = process_vault(tmp, vault_id="test-vault", started_at="2026-01-01T00:00:00Z")
            with open(note_path, "r", encoding="utf-8") as handle:
                processed = handle.read()

            self.assertEqual(original, processed)
            self.assertIsNotNone(result.report_path)
            with open(str(result.report_path), "r", encoding="utf-8") as handle:
                report = json.load(handle)
            self.assertEqual(report["counts"]["skipped_notes"], 1)
            self.assertEqual(report["counts"]["rewritten_notes"], 0)
            self.assertEqual(report["per_note"][0]["reason"], "rewrite_false")

    def test_templates_and_categories_are_unchanged(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            template_path = os.path.join(tmp, "Templates", "Book Template.md")
            category_path = os.path.join(tmp, "Categories", "Books.md")
            os.makedirs(os.path.dirname(template_path), exist_ok=True)
            os.makedirs(os.path.dirname(category_path), exist_ok=True)
            template_content = "---\ntitle: T\n---\n\n#Title\n-Item  \n"
            category_content = "#Tag\n\n![[Books.base]]\n"
            with open(template_path, "w", encoding="utf-8") as handle:
                handle.write(template_content)
            with open(category_path, "w", encoding="utf-8") as handle:
                handle.write(category_content)

            result = process_vault(tmp, vault_id="policy-test", started_at="2026-01-01T00:00:00Z")
            with open(template_path, "r", encoding="utf-8") as handle:
                template_after = handle.read()
            with open(category_path, "r", encoding="utf-8") as handle:
                category_after = handle.read()

            self.assertEqual(template_after, template_content)
            self.assertEqual(category_after, category_content)
            with open(str(result.report_path), "r", encoding="utf-8") as handle:
                report = json.load(handle)
            reasons = {row["reason"] for row in report["per_note"]}
            self.assertIn("path_policy_skip", reasons)

    def test_frontmatter_is_preserved_when_llm_returns_frontmatter(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            note_path = os.path.join(tmp, "note.md")
            original_frontmatter = (
                "---\n"
                "title: Frontmatter Test\n"
                "genre: \"[[Sci-fi]]\"\n"
                "---\n\n"
            )
            body = (
                "## Overview\n\n"
                "![[Movies.base]]\n\n"
                "- [x] Keep checked\n\n"
                + ("Long body text " * 40)
            )
            with open(note_path, "w", encoding="utf-8") as handle:
                handle.write(original_frontmatter + body)

            with patched_llm(
                "---\ntitle: Wrong\n---\n\n"
                "## Overview\n\n"
                "[[Movies.base]]\n\n"
                "- [x] Keep checked\n"
            ):
                process_vault(tmp, vault_id="fm-test", started_at="2026-01-01T00:00:00Z")

            with open(note_path, "r", encoding="utf-8") as handle:
                processed = handle.read()
            self.assertTrue(processed.startswith(original_frontmatter))
            self.assertIn("![[Movies.base]]", processed)
            self.assertIn("- [x] Keep checked", processed)
            self.assertIn("# Overview", processed)

    def test_entities_merge_original_and_processed_links(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            note_path = os.path.join(tmp, "note.md")
            body = "## Heading\n\n" + ("Alpha beta gamma " * 40) + "[[LostLink]]\n"
            with open(note_path, "w", encoding="utf-8") as handle:
                handle.write(body)

            with patched_llm("# Heading\n\nRewritten content without links.\n"):
                result = process_vault(tmp, vault_id="entity-test", started_at="2026-01-01T00:00:00Z")

            self.assertIn("LostLink", result.entities)
            self.assertIn("note.md", result.entity_refs.get("LostLink", []))

    def test_diff_path_traversal_blocked(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            original_root = os.path.join(tmp, "orig")
            processed_root = os.path.join(tmp, "proc")
            os.makedirs(original_root, exist_ok=True)
            os.makedirs(processed_root, exist_ok=True)
            vault_store["traversal-test"] = {
                "status": "done",
                "original_vault_dir": original_root,
                "vault_dir": processed_root,
            }
            try:
                with self.assertRaises(HTTPException) as ctx:
                    diff_note("traversal-test", "../secret.md")
                self.assertEqual(ctx.exception.status_code, 400)
            finally:
                vault_store.pop("traversal-test", None)

    def test_maybe_cleanup_job_uses_ttl_or_download_completion(self) -> None:
        tasks = DummyBackgroundTasks()
        old_last_access = time.time() - ((JOB_TTL_MINUTES * 60) + 5)
        vault_store["ttl-cleanup"] = {
            "temp_dir": "/tmp/a",
            "completed_at": time.time() - 10,
            "created_at": time.time() - 20,
            "last_access": old_last_access,
            "downloaded_zip": False,
            "downloaded_preview": False,
        }
        try:
            maybe_cleanup_job("ttl-cleanup", tasks)
            self.assertNotIn("ttl-cleanup", vault_store)
            self.assertEqual(len(tasks.tasks), 1)
        finally:
            vault_store.pop("ttl-cleanup", None)

        tasks = DummyBackgroundTasks()
        vault_store["download-cleanup"] = {
            "temp_dir": "/tmp/b",
            "completed_at": time.time(),
            "created_at": time.time(),
            "last_access": time.time(),
            "downloaded_zip": True,
            "downloaded_preview": True,
        }
        try:
            maybe_cleanup_job("download-cleanup", tasks)
            self.assertNotIn("download-cleanup", vault_store)
            self.assertEqual(len(tasks.tasks), 1)
        finally:
            vault_store.pop("download-cleanup", None)


if __name__ == "__main__":
    unittest.main()
