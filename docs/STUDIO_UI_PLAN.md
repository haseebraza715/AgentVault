# AgentVault — Studio UI Improvement Plan

## Current State

The Studio page (`/studio`) uses `DashboardView.tsx` — a single ~350-line component that handles upload, polling, downloads, report table, and diff viewer. The design uses a warm-cream palette (Fraunces display + Space Grotesk body), rounded cards, and `SectionCard` wrappers. It works but has significant UX gaps across upload flow, progress feedback, report exploration, and overall polish.

### Pages reviewed

| Page | File | Issues |
|------|------|--------|
| Landing `/` | `app/page.tsx` | Clean but static, no animation or interactivity |
| Studio `/studio` | `DashboardView.tsx` | Monolithic, no progress bar, basic upload input, flat report table |
| Feedback `/feedback` | `app/feedback/page.tsx` | Completely different design language (white bg, zinc colors, black button) |
| Dashboard `/dashboard` | Same as Studio | Duplicate route, confusing |

### Components reviewed

| Component | Issues |
|-----------|--------|
| `UploadCard` | Plain `<input type="file">`, no drag-and-drop, no file validation preview |
| `DownloadCard` | Minimal — just two links, no visual feedback on completion |
| `PreviewPanel` | Works well, collapsible sections with markdown rendering |
| `StudioHero` | Static header, no processing state awareness |
| `SectionCard` | Good wrapper, but all sections look identical — no visual hierarchy |
| `FooterStatus` | Tiny dot + text, easy to miss |
| `StatusPill` | Only used in `HealthStatusCard`, not in Studio |

---

## Phase 1 — Upload Experience (High Priority)

### 1.1 Drag-and-drop upload zone

**Problem:** Upload is a bare `<input type="file">` inside a dashed border box. No drag-and-drop, no visual feedback on hover/drag.

**Fix:**
- Replace with a proper dropzone that accepts drag-and-drop
- Show a prominent drop target with icon (upload cloud icon)
- Animate border color on drag-over
- Show file name, size, and type after selection
- Validate `.zip` extension and show inline error before upload
- No new dependencies needed — use native `onDragOver`/`onDrop` events

### 1.2 File validation preview

**Problem:** User selects a file and clicks upload with no preview of what they're uploading. If it fails, they get a text error.

**Fix:**
- After file selection, show: file name, size (formatted), zip icon
- Add a "Remove" button to deselect
- Disable upload button until a valid file is selected (already done, but add visual disabled state)

### 1.3 Upload button states

**Problem:** Button shows "Uploading..." text but no spinner or animation. No success state.

**Fix:**
- Add a small spinner animation during upload
- Show brief success state ("Uploaded ✓") before transitioning to processing
- Use the accent green color for success state

---

## Phase 2 — Processing Progress (High Priority)

### 2.1 Visual progress bar

**Problem:** Progress shows as text: `processing (12/105)`. No visual indicator, hard to gauge at a glance.

**Fix:**
- Add an animated progress bar below the upload card
- Show percentage, processed/total count, and estimated time remaining
- Use a smooth CSS transition between poll updates (every 2s)
- Color: accent green (`#1f4d45`) fill on cream (`#e2d7ca`) track

### 2.2 Processing stage indicators

**Problem:** User only sees "processing" — no idea what stage they're in.

**Fix:**
- Show step indicators: Upload → Processing → Done
- Highlight current step with accent color
- Show checkmarks on completed steps
- Integrate into `StudioHero` or as a standalone component below it

### 2.3 Hero adapts to state

**Problem:** `StudioHero` is static — shows the same description whether idle, processing, or done.

**Fix:**
- Idle: "Upload a vault to begin" (current)
- Processing: "Processing your vault... (45/103 notes)"
- Done: "Your vault is ready! Download below."
- Error: "Something went wrong. Try again."
- Add a subtle pulse animation during processing

---

## Phase 3 — Report & Diff Viewer (Medium Priority)

### 3.1 Report summary visualization

**Problem:** Summary stats are just number cards. No visual proportion or quick understanding of outcomes.

**Fix:**
- Add a horizontal stacked bar showing the proportion: rewritten (green) / skipped (gray) / fallback (amber) / unchanged (light)
- Keep the number cards but make the bar the visual anchor
- Clicking a bar segment filters the table to that action type

### 3.2 Sortable report table

**Problem:** Table can be filtered by action and searched by path, but columns aren't sortable.

**Fix:**
- Add sort on click for: Path (alpha), Action, Reason, Δ Size (numeric)
- Show sort direction arrow in header
- Default sort: by action (rewritten first), then path

### 3.3 Improved diff viewer

**Problem:** Diff shows raw text side-by-side. No syntax highlighting, no change highlighting, hard to spot what changed.

**Fix:**
- Add line-by-line diff highlighting (green for additions, red for removals)
- Use a simple character-diff algorithm (no new dependency — compute inline)
- Add line numbers to both panels
- Add a "Copy" button on each panel
- Make diff panels resizable or full-screen toggleable

### 3.4 Expandable note detail row

**Problem:** To see details about a note, user must click "View diff" which loads from the server. Findings and guard failures aren't visible.

**Fix:**
- Make table rows expandable (click row to expand)
- Show in expanded view: findings list, guards failed, before/after char count, retry count, chunked flag
- Keep "View diff" as a secondary action within the expanded row

---

## Phase 4 — Downloads & Completion (Medium Priority)

### 4.1 Download card redesign

**Problem:** Download card has two plain links. No visual reward for completion, no context about what's in the zip.

**Fix:**
- Show a success banner/animation when processing completes
- Display file count and zip size
- Add icons for zip download vs markdown preview
- Add "Download Report (JSON)" as a third download option
- Style as prominent call-to-action buttons, not text links

### 4.2 Toast notifications

**Problem:** All feedback is inline text. Easy to miss completion or errors.

**Fix:**
- Add a lightweight toast system (custom — no dependency needed)
- Show toasts for: upload success, processing complete, download started, errors
- Position: bottom-right, auto-dismiss after 4s
- Match the warm-cream palette

---

## Phase 5 — Feedback Page & Navigation (Low Priority)

### 5.1 Fix feedback page design

**Problem:** Feedback page uses completely different colors (`bg-white`, `text-zinc-900`, `bg-black` button). Looks like a different app.

**Fix:**
- Wrap in `PageLayout`
- Use `SectionCard` for the form
- Match button style to accent green (`#1f4d45`)
- Add textarea and input styling consistent with Studio
- Add "← Back to Studio" link

### 5.2 Remove duplicate route

**Problem:** Both `/studio` and `/dashboard` render the exact same `DashboardView`. Confusing.

**Fix:**
- Keep `/studio` as the primary route
- Make `/dashboard` redirect to `/studio` (or remove it)
- Update any links pointing to `/dashboard`

### 5.3 Add consistent navigation

**Problem:** No persistent nav. "Back to landing" is a small pill in `StudioHero`. No way to reach feedback from Studio without going back to landing.

**Fix:**
- Add a minimal top nav bar: Logo/name (left) → Studio / Feedback (right)
- Use the same warm-cream styling, no heavy chrome
- Highlight active route
- Keep it simple — 1-line height, no hamburger menu needed

---

## Phase 6 — Polish & Micro-interactions (Low Priority)

### 6.1 Loading skeletons

**Problem:** Page loads blank then pops in. Health check runs with no visual indication.

**Fix:**
- Add skeleton placeholders for SectionCards during initial load
- Show pulse animation while health check is pending
- Use CSS `@keyframes` — no dependency needed

### 6.2 Smooth transitions

**Problem:** Sections appear/disappear instantly (report section, diff panel). Jarring.

**Fix:**
- Add `transition-all` with `opacity` and `max-height` for section reveal
- Animate report table filter changes
- Animate progress bar smoothly between poll updates

### 6.3 Empty states

**Problem:** When no job is active, download card says "Zip download unavailable" and preview says "Preview will appear here once processing is complete." — these feel dead.

**Fix:**
- Design proper empty state illustrations or icons
- Use warmer, encouraging copy: "Upload a vault above to get started"
- Visually dim empty sections to guide attention to the upload zone

### 6.4 Responsive refinements

**Problem:** Grid layout works on desktop but may feel cramped on tablets. Mobile needs testing.

**Fix:**
- Test on 768px, 1024px, 1440px breakpoints
- Ensure report table is horizontally scrollable on mobile
- Stack upload + download cards vertically on small screens (already uses `lg:grid-cols`)
- Make diff viewer full-width on mobile instead of side-by-side

---

## Implementation Order

| Priority | Items | Estimated Effort |
|----------|-------|-----------------|
| 🔴 High | 1.1 (dropzone), 2.1 (progress bar), 2.2 (step indicators) | Core UX — do first |
| 🟠 High | 1.2 (file preview), 1.3 (button states), 2.3 (hero adapts) | Quick wins |
| 🟡 Medium | 3.1 (summary bar), 3.2 (sortable table), 4.1 (download redesign) | Report UX |
| 🟢 Medium | 3.3 (diff highlighting), 3.4 (expandable rows), 4.2 (toasts) | Nice-to-have |
| 🔵 Low | 5.1 (feedback fix), 5.2 (remove dup route), 5.3 (nav bar) | Consistency |
| ⚪ Low | 6.1–6.4 (skeletons, transitions, empty states, responsive) | Polish |

## Files to modify

- `frontend/src/components/UploadCard.tsx` — dropzone, file preview, button states
- `frontend/src/components/DashboardView.tsx` — progress bar, step indicators, sortable table, toasts
- `frontend/src/components/DownloadCard.tsx` — redesign with icons, report download, success state
- `frontend/src/components/StudioHero.tsx` — state-aware hero messaging
- `frontend/src/components/FooterStatus.tsx` — optional: merge into nav
- `frontend/src/app/feedback/page.tsx` — restyle with PageLayout + SectionCard
- `frontend/src/app/dashboard/page.tsx` — redirect to `/studio`
- `frontend/src/app/globals.css` — skeleton keyframes, transition utilities
- New: `frontend/src/components/ProgressBar.tsx`
- New: `frontend/src/components/StepIndicator.tsx`
- New: `frontend/src/components/Toast.tsx`
