# AgentVault — Improvement Plan

## Status: ✅ ALL PHASES COMPLETE

All 23 planned improvements have been implemented and verified.

---

## Completed Items (23/23)

### Phase 1 — Critical Bugs ✅
- [x] 1.1 Fix empty `entities.md` — merged original + processed entity extraction
- [x] 1.2 Fix duplicate `maybe_cleanup_job` — single function with TTL + download check
- [x] 1.3 Fix template/category skip — robust folder-part matching in `should_rewrite_with_llm()`
- [x] 1.4 Add `python-dotenv` to requirements.txt
- [x] 1.5 Fix `test_sanitizer.py` — `sanitize_markdown` function now exists

### Phase 2 — Processing Quality ✅
- [x] 2.1 Stub/metadata-only note detection — skip LLM for <100 char / embed-only notes
- [x] 2.2 Frontmatter preservation — prepend original, strip LLM-generated, detect echo
- [x] 2.3 Heading hierarchy — `_promote_headings_if_first_h2()` normalizes levels
- [x] 2.4 LLM retry with backoff — `rewrite_with_llm_with_retries()` (max 2 retries, exponential)
- [x] 2.5 Token-aware chunking — `_split_for_llm_context()` splits by H2 sections
- [x] 2.6 Index.md grouped by folder with counts
- [x] 2.7 Entities.md with bidirectional refs grouped by folder

### Phase 3 — Backend Architecture ✅
- [x] 3.1 SQLite job store — `job_store.py` replaces in-memory `vault_store`
- [x] 3.2 Report.json included in downloaded zip

### Phase 4 — Frontend Improvements ✅
- [x] 4.1 Summary stats cards (total, rewritten, skipped, unchanged, fallback, stubs)
- [x] 4.2 Color-coded action pills in report table
- [x] 4.3 Filter bar with action type buttons + search by path
- [x] 4.4 Size delta column (Δ %) with color coding
- [x] 4.5 Close button on diff viewer + Original/Processed labels
- [x] 4.6 Sticky table headers, rounded borders, consistent warm-cream theme

### Phase 5 — Testing & CI ✅
- [x] 5.1 Backend tests pass (10 tests: sanitizer, policy, frontmatter, entities, diff, cleanup)
- [x] 5.2 GitHub Actions CI pipeline (`.github/workflows/ci.yml`)
- [x] 5.3 Strengthened LLM prompt (wikilinks, embeds, checkboxes, no-invention rules)

### Guard Rails Added
- Wikilink loss guard (80% threshold)
- Embed loss guard (strict — no loss allowed)
- Task checkbox loss guard
- Code fence mismatch guard
- Over-shortening guard (55% of original length)
- `_strip_llm_frontmatter()` — removes LLM-generated YAML
- `_restore_embed_prefixes()` — fixes `![[embed]]` → `[[embed]]` conversion
- `_strip_frontmatter_metadata_echo()` — strips duplicated frontmatter fields in body

---

## Future Work (not in current scope)
- Task queue (Celery/arq) for background processing
- Server-Sent Events for real-time progress
- Request authentication for job endpoints
- Drag-and-drop upload, progress bar, diff highlighting
- Multi-model fallback chain
- Cost tracking and billing
- Horizontal scaling with Redis/PostgreSQL

---

## Executive Summary

AgentVault's core pipeline works: it accepts a vault zip, runs notes through an LLM, and returns a cleaned vault. However, a detailed comparison of the original vs. processed output reveals **serious data-loss issues** alongside several quality and architecture gaps.

### Key Findings from Output Comparison

| Metric | Original | Processed | Change |
|--------|----------|-----------|--------|
| Markdown files | 103 | 103 | ✅ Same |
| Total characters | 35,993 | 44,846 | +24.6% (LLM added prose) |
| Wikilinks (non-embed) | 148 | 95 | **-35.8% LOST** |
| Embeds (`![[...]]`) | 61 | 39 | **-36.1% LOST** |
| Notes with YAML frontmatter | 98 | 0 | **100% STRIPPED** |
| Notes with H1 heading | 1 | 84 | ✅ Improved |
| Notes starting with H2 (no H1) | N/A | 13 | ⚠️ Inconsistent |
| Checked task items `[x]` | 3 | 0 | **LOST** |
| All 103 notes changed | — | 103/103 | ⚠️ Even templates/categories |
| `entities.md` populated | — | Empty | **BUG** |

### Most Critical Problems

1. **All YAML frontmatter stripped** — 98 out of 103 original notes had frontmatter with structured metadata (categories, author, rating, dates, etc.). All of it is gone in the processed output. The frontmatter_block is stored during processing but the LLM rewrites replace it or it's not being re-prepended correctly.

2. **35.8% of wikilinks lost** — 134 of 209 original wikilinks lived inside YAML frontmatter (`"[[People]]"`, `"[[Movies]]"`, etc.). Since frontmatter is stripped, these wikilinks vanish. The remaining losses are in body text where the LLM converted `[[Out of Control]]` to `*Out of Control*` (plain italics) and `![[embed]]` to `[[embed]]` (embed → plain link) or dropped them entirely.

3. **36.1% of embeds lost** — Obsidian embeds like `![[Books.base]]`, `![[Daily.base]]`, `![[Trips.base#Location]]` are being dropped or converted to plain links. These are critical for vault functionality.

4. **Templates and Categories were rewritten** despite the skip policy — The `should_rewrite_with_llm()` function should skip `/templates/` and `/categories/` paths, but all 53 template notes and 21 category notes were modified. The Book Template went from useful structured YAML to a meaningless 3-line stub.

5. **LLM invents content** — For metadata-only notes (e.g., Blade Runner had an empty body with all data in frontmatter), the LLM fabricated a movie description. For Fushimi Inari (just coordinates + metadata), it wrote a tourist description. This invented content pollutes the vault.

---

## Phase 1 — Critical Data-Loss Bugs

These issues cause actual data destruction and must be fixed before any vault is processed again.

### 1.1 Frontmatter is Being Stripped from Output

**Observed:** 98 notes had YAML frontmatter originally. Zero processed notes have frontmatter. The code in `vault_processor.py` calls `extract_frontmatter_block()` which returns `(frontmatter_block, data, body)`, and `finalize()` writes `frontmatter + body`. However, the evidence shows frontmatter is not surviving.

**Root Cause Investigation:**
- Check if `frontmatter_block` is actually the raw `---\n...\n---\n` string or empty
- Check if the LLM response includes frontmatter that then gets double-stripped by `sanitize_body_artifacts()`
- Check if `finalize()` is writing `content = frontmatter + body` where `frontmatter` is the original block

**Fix:**
- Ensure `frontmatter_block` (the raw YAML string) is always preserved and prepended to the final output
- After LLM rewrite, explicitly strip any frontmatter the LLM may have added (it's told not to, but sometimes does)
- Add a validation step: if original had frontmatter, output must have frontmatter
- Add a test: process a note with frontmatter → assert frontmatter is preserved in output

### 1.2 Wikilinks Lost in Frontmatter and Body

**Observed:** 53 wikilinks lost. 134 of 209 original wikilinks lived in YAML frontmatter values like `categories: ["[[People]]"]`. When frontmatter is stripped, these vanish. Additionally, body wikilinks like `[[Out of Control]]` were converted to `*Out of Control*` by the LLM.

**Fix:**
- Fixing frontmatter preservation (1.1) recovers the 134 frontmatter wikilinks automatically
- Strengthen the LLM prompt: add explicit instruction "NEVER convert [[wikilinks]] to plain text or italics"
- Add post-processing validation: compare wikilink count before/after, flag if >20% drop
- In `validate_rewrite()`, tighten the wikilink loss threshold from 60% to 80%

### 1.3 Embeds (`![[...]]`) Dropped or Converted

**Observed:** 22 embeds lost across 15 files. Examples:
- `![[Books.base]]` → removed entirely (Categories/Books.md)
- `![[Trips.base#Location]]` → `[[Trips.base#Location]]` (embed → plain link, Kyoto.md)
- `![[Clippings.base#Author]]` → `[[Clippings.base#Author]]` (Steph Ango.md)
- `![[Products.base#Cost per use]]` → wrapped in a code fence (Product usage.md)

**Fix:**
- Strengthen prompt: "NEVER remove or modify `![[embed]]` syntax. Keep the `!` prefix."
- Add post-processing: scan for `[[...]]` that were `![[...]]` in original, restore the `!` prefix
- In `validate_rewrite()`: fail if embed count decreases at all (current check only fails if `rewritten_embeds < original_embeds`, which should catch this — investigate why it's not triggering)

### 1.4 Task Checkboxes Lost

**Observed:** Minimal Theme note had `- [x] Color schemes`, `- [x] E-ink mode`, `- [x] Mobile support` (checked tasks). Output has plain `- Color schemes` bullets. The completion status information is destroyed.

**Fix:**
- Add checkbox pattern to the preservation rules in the LLM prompt
- Add a guard: count `[x]` and `[ ]` patterns before/after, fail if reduced

### 1.5 Templates and Categories Rewritten Despite Skip Policy

**Observed:** All 53 template files and 21 category files were modified. The `should_rewrite_with_llm()` function checks for `/templates/` and `/categories/` in lowercase path. The actual vault paths are `kepano-obsidian-main/Templates/` and `kepano-obsidian-main/Categories/`. The function does `.lower()` on the path, so `Templates` → `templates` should match.

**Root Cause:** The skip policy prevents LLM rewriting, but the deterministic preprocessing still runs. The `preprocess_note()` function modifies the body, and then `finalize()` writes the modified content even for skipped notes. For template notes that are pure frontmatter (empty body), the frontmatter loss (bug 1.1) destroys all content.

**Fix:**
- For notes with `skip_reason` in `{"rewrite_false", "tag_no_rewrite", "path_policy_skip"}`, write the **exact original content** unchanged — do not run preprocessing
- Add test: process a vault with Templates/ and Categories/ folders → assert those files are byte-for-byte identical to originals

### 1.6 `entities.md` Always Empty

**Observed:** The file is generated but contains only the heading `# Entities` and nothing else.

**Root Cause:** `extract_entities()` finds wikilinks via regex `\[\[([^#\]|]+)` in the processed content. But since frontmatter is stripped (bug 1.1), the wikilinks that were in frontmatter are gone. And the LLM converts many body wikilinks to plain text. So entity_counts ends up empty.

**Fix:**
- Fix frontmatter preservation (1.1) — this alone restores most entities
- Additionally: run `extract_entities()` on the **original** full content (frontmatter + body) as a baseline, then merge with entities from processed content
- Add test: process a note with `[[wikilinks]]` → assert entities.md contains them

### 1.7 Duplicate `maybe_cleanup_job` Function

**Observed:** `main.py` defines `maybe_cleanup_job` twice (lines 145 and 162). The second definition silently shadows the first. The TTL-based cleanup is dead code.

**Fix:**
- Merge both strategies: clean up if (TTL expired) OR (both zip + preview downloaded)
- Remove the duplicate
- Add test

### 1.8 `python-dotenv` Missing from `requirements.txt`

**Observed:** `main.py` does `from dotenv import load_dotenv` but `python-dotenv` is not in `requirements.txt`.

**Fix:** Add `python-dotenv` to `requirements.txt`.

### 1.9 `test_sanitizer.py` Imports Nonexistent Function

**Observed:** Tests import `sanitize_markdown` from `app.vault_processor` — this function doesn't exist. Tests are broken.

**Fix:** Either implement `sanitize_markdown` wrapping existing logic, or update tests to use `preprocess_note` and `sanitize_body_artifacts`.

---

## Phase 2 — Output Quality Improvements

These address quality issues visible in the processed output that don't cause data loss but reduce usefulness.

### 2.1 LLM Invents Content for Metadata-Only Notes

**Observed:**
- **Blade Runner** (original: empty body, all data in frontmatter) → LLM wrote a 5-sentence movie description that doesn't exist in the original vault
- **Fushimi Inari** (original: empty body) → LLM wrote a tourist description about "thousands of vermilion torii gates"
- **Obsidian** (original: empty body) → LLM wrote "Obsidian is a knowledge management app that helps users organize..."
- **Futurama** (original: empty body) → LLM added title and metadata fields as body text

**Fix:**
- Add a `is_metadata_only_note()` check: if the body is empty or <50 chars after stripping whitespace, skip LLM — only preserve frontmatter
- For notes where body is just embeds, skip LLM entirely
- Add to the prompt: "If the note body is empty or only contains embeds, return it exactly as-is. Do NOT add descriptions or summaries."

### 2.2 Frontmatter Metadata Duplicated into Body

**Observed:** After LLM rewrite, many notes have metadata from frontmatter duplicated as body text:
- Blade Runner: frontmatter had `genre: "[[Sci-fi]]"` → body now has `**Genre:** [[Sci-fi]]`
- Steph Ango: frontmatter had `twitter: kepano` → body now has `## Social\n- Twitter: kepano`
- Meeting note: frontmatter had `people: "[[Steph Ango]]"` → body has `**Participants**: Steph Ango` (and lost the wikilink!)

**Fix:**
- The LLM is told to "Return markdown body only (no YAML frontmatter)" but it's seeing frontmatter data in the NOTE section of the prompt and reproducing it
- Change the prompt to send ONLY the body text (after frontmatter extraction), not the full note
- Verify that `rewrite_with_llm()` is called with `body` only, not `frontmatter + body`
- Post-processing: detect metadata-like lines at the top of LLM output (bold key: value patterns) and remove them if they duplicate frontmatter fields

### 2.3 Inconsistent Heading Levels

**Observed:** 13 processed notes start with `##` instead of `#` as the first heading. Examples: Well Made, Kevin Kelly, Catan, several templates, some categories. Meanwhile 84 notes correctly have H1.

**Fix:**
- Add post-processing: if first heading in body is `##`, promote all headings by one level
- Ensure the title is always an H1 heading

### 2.4 Over-Summarization of Short Notes

**Observed:**
- **Product usage analysis** (original: 2 lines + 1 embed) → LLM expanded to 8 lines with an "Overview" section and invented a "Related Notes" section including `[[Products.base]]` which was an embed reference, not a standalone link
- **Categories/Books** (original: 1 tag + 1 embed) → LLM wrote 8 lines of description prose
- **Daily notes** (original: 1 heading + 1 embed each) → LLM added titles, sections, and reformatted inconsistently between the two identical notes

**Fix:**
- Skip LLM for notes with body < 100 chars
- Skip LLM for notes that are purely embed references
- Mark these as `reason: "stub_note"` in the report

### 2.5 Inconsistent Processing of Identical Notes

**Observed:** The two Daily notes (`2023-09-12` and `2023-09-30`) have identical original content (`## Notes\n\n![[Daily.base]]`) but different processed output:
- 2023-09-12 → `# Daily Notes for September 12, 2023\n\n## Summary\n\n![[Daily.base]]`
- 2023-09-30 → `# Note for 2023-09-30\n\n## Daily Notes\n\n- [[Daily.base]]` (embed lost!)

**Fix:**
- Use `temperature: 0` (already set) but also set a `seed` parameter for deterministic output
- For short/identical notes, the stub-skip from 2.4 would prevent this entirely

### 2.6 Improve `index.md` with Folder Grouping

**Observed:** `index.md` is a flat list of 105 entries including templates and categories. Hard to navigate.

**Fix:**
- Group entries by folder (Notes, References, Clippings, Templates, Categories, Daily)
- Add note counts per group
- Mark templates and categories as a separate section
- Add a "Summary" line at the top: "X notes, Y references, Z templates"

### 2.7 Enrich `entities.md`

**Observed:** Even when populated, entities.md would just be a flat list of `- EntityName: count`.

**Fix:**
- Group entities by folder of the note they appear in
- Sort by frequency within groups
- Add back-references: which notes reference each entity

---

## Phase 3 — Processing Pipeline Improvements

### 3.1 LLM Prompt Improvements

Current prompt is too permissive. Based on observed output, add:

```
Rules:
- Return markdown body only (no YAML frontmatter).
- Preserve ALL [[wikilinks]] exactly as-is. Never convert them to plain text, italics, or bold.
- Preserve ALL ![[embeds]] exactly as-is. Keep the ! prefix.
- Preserve ALL task checkboxes: - [x] and - [ ] must remain unchanged.
- Do not invent content. If the note body is empty, return it empty.
- Do not duplicate metadata that belongs in frontmatter.
- Keep structure close to the original; improve wording and readability.
- Preserve all code fences and URLs.
```

### 3.2 Add LLM Retry with Exponential Backoff

**Current:** One attempt. Failure → fallback to original.

**Fix:**
- Max 2 retries with 2s/4s backoff
- Only retry on 429 (rate limit) and 5xx (server error)
- Log retry attempts per note in the report

### 3.3 Token-Aware Processing

**Current:** No protection against context window overflow.

**Fix:**
- Estimate tokens (~4 chars per token)
- If note exceeds 80% of model context window, split by H2 sections
- Process each section separately and reassemble

### 3.4 Add Processing Report to Output Zip

**Current:** `report.json` is only accessible via `/report/{vault_id}` API. Not included in the downloaded zip.

**Fix:**
- Include `report.json` in the output zip alongside `index.md` and `entities.md`
- Makes the output self-documenting

---

## Phase 4 — Backend Architecture

### 4.1 Replace In-Memory `vault_store` with SQLite

**Current:** Plain Python dict. Lost on restart. No multi-worker support.

**Fix:**
- Use SQLite file-based DB for job metadata
- Table: `jobs (vault_id, status, processed, total, error, temp_dir, created_at, completed_at)`
- Periodic cleanup sweep for expired jobs

### 4.2 Replace `threading.Thread` with Task Queue

**Current:** Daemon threads. No retries, no monitoring, no cancellation.

**Fix:**
- Use `arq` or `huey` (lightweight) for background processing
- Benefits: retries, monitoring, concurrency control, job cancellation

### 4.3 Add Per-Job Auth Tokens

**Current:** Any client who knows a UUID can access any job.

**Fix:**
- Generate short-lived access token per job on upload
- Return alongside `vault_id`
- Require on all subsequent endpoints

### 4.4 Stream Progress via SSE

**Current:** Frontend polls every 2 seconds.

**Fix:**
- Add `GET /stream/{vault_id}` SSE endpoint
- Push updates as they happen
- Frontend uses `EventSource`

### 4.5 Increase Fly.io Memory

**Current:** 512MB. Too low for spaCy + concurrent LLM processing.

**Fix:** `memory_mb = 1024` in `fly.toml`

---

## Phase 5 — Frontend Improvements

### 5.1 Drag-and-Drop Upload
Replace plain `<input type="file">` with a dropzone component. Show file info before upload.

### 5.2 Visual Progress Bar
Show `processed/total` as an animated bar with ETA. Currently just text.

### 5.3 Improved Diff Viewer
Use `react-diff-viewer` for inline/unified diff with syntax highlighting. Current viewer is raw text side-by-side.

### 5.4 Report Summary Dashboard
Add summary cards ("X rewritten, Y skipped, Z fallback"), pie chart, filter/sort on table.

### 5.5 Toast Notifications
Use `sonner` or `react-hot-toast` for upload success, processing complete, errors.

### 5.6 Fix Feedback Page Styling
Match the warm cream palette. Currently plain white/zinc.

### 5.7 Use NextAuth on Protected Routes
Auth is set up but never used. Protect `/studio` with session check.

---

## Phase 6 — Testing

### 6.1 Fix and Expand Backend Tests

**Current:** 2 test files, one of which is broken (`test_sanitizer.py` imports nonexistent function).

**Add tests for:**
- Entity extraction with wikilinks in frontmatter + body
- `validate_rewrite` / `rewrite_guard_failures` with all edge cases
- `RateLimiter` concurrency behavior
- `unzip_safe` with malicious inputs (path traversal, zip bombs)
- Frontmatter parsing with malformed YAML
- `preprocess_note` with all transformation paths
- Full `process_vault` integration test with LLM mocked
- Template/Category skip policy with nested folders
- Frontmatter preservation through full pipeline

### 6.2 Add Frontend Tests
Component tests with React Testing Library. E2E with Playwright.

### 6.3 Improve `output_eval.py`
Add checks for: frontmatter preservation, heading hierarchy, embed preservation, wikilink count, no LLM artifacts.

### 6.4 Add GitHub Actions CI
Backend: pytest + lint. Frontend: build + test + lint. Run on push/PR.

---

## Phase 7 — New Features (Future)

### 7.1 Per-Note Processing Controls
After upload, show note list with checkboxes. Let users toggle on/off.

### 7.2 Custom LLM Prompts
Prompt customization field in Studio UI. Store in report for reproducibility.

### 7.3 Multi-Model Support with Fallback
Configure model chain. Auto-fallback on 429/5xx. Log which model per note.

### 7.4 Export Formats
PDF, HTML static site, JSON structured data.

### 7.5 API/CLI Mode
API key auth for headless usage. CLI script for automation.

### 7.6 Cost Tracking
Track token usage per job. Show cost in report. Stripe integration.

### 7.7 Job History
PostgreSQL for metadata. Object storage for reports. History page in UI.

---

## Priority Matrix

| Priority | ID | Issue | Impact |
|----------|----|-------|--------|
| 🔴 P0 | 1.1 | Frontmatter stripped from all output | **Data destruction** |
| 🔴 P0 | 1.2 | 35.8% wikilinks lost | **Data destruction** |
| 🔴 P0 | 1.3 | 36.1% embeds lost | **Data destruction** |
| 🔴 P0 | 1.4 | Task checkboxes lost | **Data destruction** |
| 🔴 P0 | 1.5 | Templates/Categories rewritten | **Data destruction** |
| 🔴 P0 | 1.6 | entities.md empty | **Broken feature** |
| 🟠 P1 | 1.7 | Duplicate maybe_cleanup_job | Dead code / memory leak |
| 🟠 P1 | 1.8 | python-dotenv missing | Deployment failure |
| 🟠 P1 | 1.9 | Broken test imports | CI failure |
| 🟡 P2 | 2.1 | LLM invents content | Quality |
| 🟡 P2 | 2.2 | Frontmatter duplicated in body | Quality |
| 🟡 P2 | 2.3 | Inconsistent heading levels | Quality |
| 🟡 P2 | 2.4 | Over-summarization | Quality |
| 🟡 P2 | 2.5 | Inconsistent processing | Quality |
| 🟢 P3 | 2.6–2.7 | Index/entity improvements | Polish |
| 🟢 P3 | 3.1–3.4 | Pipeline improvements | Reliability |
| 🟢 P3 | 4.1–4.5 | Architecture | Scale |
| 🔵 P4 | 5.1–5.7 | Frontend UX | Polish |
| 🔵 P4 | 6.1–6.4 | Testing | Quality assurance |
| ⚪ P5 | 7.1–7.7 | New features | Growth |

---

## Appendix: Side-by-Side Comparison Highlights

### Good Rewrites

| Note | Verdict | Why |
|------|---------|-----|
| 68 Bits of Unsolicited Advice | ✅ Excellent | Flat bullet list → organized sections. All content preserved. |
| Buy Wisely | ✅ Excellent | Long-form prose → structured sections with proper table. |
| Brown butter nectarine tart | ✅ Excellent | Recipe preserved perfectly. Directions sub-sectioned properly. |
| In good hands | ✅ Good | Short prose preserved with minimal changes. H1 added. |
| Evergreen notes | ✅ Good | Wikilinks preserved. Sections added. Minor wikilink loss (15→9). |
| Readme | ✅ Good | H1 added. Structure improved slightly. |

### Bad Rewrites

| Note | Verdict | Why |
|------|---------|-----|
| Blade Runner | ❌ Bad | Empty body → LLM fabricated a movie description. Frontmatter metadata duplicated as body. |
| Fushimi Inari | ❌ Bad | Empty body → LLM invented tourist description. All embeds lost. |
| Obsidian | ❌ Bad | Empty body → LLM wrote generic description. |
| Book Template | ❌ Bad | Structured YAML template → meaningless 3-line stub. All content destroyed. |
| Categories/Books | ❌ Bad | `![[Books.base]]` embed → prose wrapper with embed in code fence. |
| Meeting with Steph | ❌ Bad | `[[Out of Control]]` → `*Out of Control*`. All 6 wikilinks lost. |
| Daily/2023-09-30 | ❌ Bad | `![[Daily.base]]` → `[[Daily.base]]` (embed → plain link). |
| Kyoto | ❌ Bad | 3 embeds completely removed. Metadata duplicated from frontmatter. |
| Steph Ango | ❌ Bad | 2 embeds converted to plain links. Frontmatter metadata inlined. |
| Minimal Theme | ⚠️ Mixed | Good restructuring but `[x]` checkboxes lost. Frontmatter duplicated. |
| Product usage | ⚠️ Mixed | Embed wrapped in code fence (broken). LLM invented "Related Notes". |
| Kevin Kelly | ⚠️ Mixed | H2 as first heading. Embeds got bullet prefixes. |
