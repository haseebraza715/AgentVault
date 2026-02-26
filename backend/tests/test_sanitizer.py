import unittest

from app.vault_processor import sanitize_markdown


class SanitizerTests(unittest.TestCase):
    def test_duplicate_full_document_removed(self) -> None:
        text = (
            "---\n"
            "title: Note\n"
            "---\n\n"
            "# Title\n"
            "Body line\n\n"
            "---\n"
            "title: Note\n"
            "---\n\n"
            "# Title\n"
            "Body line\n"
        )
        clean, findings, changed = sanitize_markdown(text)

        self.assertTrue(changed)
        self.assertIn("duplicate_document_removed", findings)
        self.assertEqual(clean.count("# Title"), 1)
        self.assertEqual(clean.count("title: Note"), 1)

    def test_duplicate_frontmatter_removed(self) -> None:
        text = (
            "---\n"
            "title: Keep Me\n"
            "tags: [a, b]\n"
            "---\n\n"
            "Body\n\n"
            "---\n"
            "title: Keep Me\n"
            "tags: [a, b]\n"
            "---\n\n"
            "Tail\n"
        )
        clean, findings, changed = sanitize_markdown(text)

        self.assertTrue(changed)
        self.assertIn("duplicate_frontmatter_removed", findings)
        self.assertEqual(clean.count("title: Keep Me"), 1)

    def test_fenced_code_block_text_is_not_modified(self) -> None:
        text = (
            "```python\n"
            "#Title\n"
            "-Item  \n"
            "```\n\n"
            "#Title\n"
            "-Item\n"
        )
        clean, findings, changed = sanitize_markdown(text)

        self.assertTrue(changed)
        self.assertIn("fix_heading_spacing", findings)
        self.assertIn("fix_list_spacing", findings)
        self.assertIn("```python\n#Title\n-Item  \n```", clean)
        self.assertIn("# Title", clean)
        self.assertIn("- Item", clean)

    def test_conflict_markers_are_resolved(self) -> None:
        text = (
            "Line one\n"
            "<<<<<<< HEAD\n"
            "short\n"
            "=======\n"
            "this is the longer lower chunk\n"
            ">>>>>>> branch\n"
            "Line two\n"
        )
        clean, findings, changed = sanitize_markdown(text)

        self.assertTrue(changed)
        self.assertTrue(any(item.startswith("conflict_markers_resolved_") for item in findings))
        self.assertNotIn("<<<<<<<", clean)
        self.assertNotIn("=======", clean)
        self.assertNotIn(">>>>>>>", clean)
        self.assertIn("this is the longer lower chunk", clean)


if __name__ == "__main__":
    unittest.main()
