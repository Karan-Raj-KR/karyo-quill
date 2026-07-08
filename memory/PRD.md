# Quill — PRD

## Original Problem Statement (Phase 1)
Web-first FARM app called **Quill** — a universal AI scribe that turns conversation
transcripts into structured records. Phase 1 ships the full UI/UX shell + interactions
with **fallback seed JSON** (no live AI yet). Phase 2 will wire the real LLM call,
swapping the hardcoded server-side seed in `/api/generate` for a real model call —
JSON schema stays identical.

## User Personas
- **Clinician** — pastes a doctor↔patient transcript, gets a clinical note + ICD-10
  codes + a printable prescription. Needs the gap-check (drug interactions,
  allergies, missing vitals) to be visually dominant.
- **Sales rep** — pastes a discovery call transcript, gets a recap and a draftable
  follow-up email they can copy in one click.
- **Recruiter / Hiring manager** — pastes interview notes, gets a scorecard with a
  recommendation and gaps for the next round.
- **Agency / Service business** — pastes a client intake call, gets a brief with
  goals, deliverables, timeline, and proposal points.

## Core Requirements (static)
- Two-screen SPA: Input + Result (+ print sub-view for clinical export).
- 4 modes: Clinical (default), Sales, Interview, Intake.
- Backend: `POST /api/generate { transcript, mode }` → mode-specific JSON
  matching schema { documentTitle, sections[], suggestions[], flags[], exportLabel }.
- 600–900 ms artificial backend latency so loading state is felt.
- `/api/openapi.json` reachable (FastAPI configured to serve under `/api`).
- Design system: bg `#F7F8FA`, cards `#FFF`, ink `#0F172A`, body `#475569`,
  muted `#94A3B8`, teal accent `#0D9488`, amber `#F59E0B`, red `#DC2626`,
  borders `#E2E8F0`, Inter font, 16px radius cards, 1px shadow.
- Gap check card visually dominates (left-accent bar, icon, color).
  Red if any flag mentions "interaction"/"drug"/"allergy"; otherwise amber.
- Staggered fade+rise card reveal (~120 ms per card).
- Clinical export: plain B&W print view + `window.print()`.
- Other modes: copy composed body to clipboard + ~2 s "Copied" toast.
- Mobile responsive (375 px); split view stacks.
- No hardcoded backend URL (uses `REACT_APP_BACKEND_URL` env).

## What's Implemented — 2026-02-XX (Phase 2 — LLM wired)
- **Claude Sonnet 4.5** (`claude-sonnet-4-5-20250929`) via Emergent universal LLM key
  (`emergentintegrations.llm.chat.LlmChat` + `UserMessage`).
- `/app/backend/server.py`:
  - New `MODE_RULES` table (exportLabel + required section headings per mode).
  - New `QUILL_SYSTEM_PROMPT` — the brief's core prompt plus per-mode hard rules and
    the JSON schema; instructs the model to return JSON only, no fences/preamble.
  - New `_extract_json()` — strips ```json/``` fences and falls back to outermost
    `{...}` braces parsing.
  - New `_validate_schema()` — strict types + required keys + per-mode exact
    `exportLabel` match + case-insensitive required section presence.
  - New `_call_llm()` — `asyncio.wait_for(..., timeout=25.0)`; on any failure
    (no key, timeout, exception, non-JSON, schema/mode violation) logs the reason
    server-side and returns `None`.
  - `/api/generate` now: empty transcript → 400, invalid mode → 422,
    `USE_LLM=true` → try LLM, fall back transparently to mode-matched seed with
    HTTP 200; `USE_LLM=false` → seed directly. The artificial 600–900 ms sleep
    was removed (real LLM call is the latency now).
- `/app/backend/.env`: appended `EMERGENT_LLM_KEY=sk-emergent-…` and `USE_LLM=true`
  (initial keys preserved per environment rules).
- `/app/backend/tests/test_quill_api.py` rewritten for Phase 2 — schema/contract
  validation instead of seed-equality, with per-mode flag content checks. 13/13
  passing against live LLM in 91s.

### Phase 2 acceptance — verified
| Mode | Sample → exportLabel | Flags caught |
|------|----------------------|--------------|
| clinical | "Print prescription" ✅ | missing vitals (BP/HR/RR) · allergy history not documented · drug interaction risk |
| sales | "Copy follow-up email" ✅ | missing budget · ambiguous next step · missing timeline · VP not on call |
| interview | "Export scorecard" ✅ | missing salary expectations · missing notice/availability |
| intake | "Export brief" ✅ | no budget · no success metrics · brand identity incomplete |

- Fallback path verified: `USE_LLM=false` → seed JSON returned with HTTP 200,
  documentTitle matches Phase 1 seed verbatim. Validation-failure fallback verified
  via unit-level test of `_validate_schema` (wrong exportLabel, missing sections,
  bad flag type all → False, triggering seed fallback).
- `/api/openapi.json` still reachable; all Phase 1 UI flows still work
  (verified live with Sales mode + sample transcript — gap check renders amber,
  exportLabel "Copy follow-up email", all 5 sales sections rendered, "Budget"
  content correctly reads "Not discussed on this call.").

## What's Implemented — 2026-02-XX (Phase 1)
- **Backend** (`/app/backend/server.py`):
  - `POST /api/generate` with 4 hardcoded `QUILL_SEEDS` matching the brief verbatim,
    600–900 ms artificial async sleep, 400 on empty transcript, 422 on invalid mode.
  - FastAPI configured `openapi_url="/api/openapi.json"`, `docs_url="/api/docs"`.
  - Existing `/api/status` endpoints retained (template heritage, harmless).
- **Frontend**:
  - `App.js` — state machine across `INPUT` / `RESULT` / `PRINT` screens,
    `composeExportBody` for non-clinical clipboard payload, sonner toaster
    mounted at bottom-center with dark Quill style.
  - `components/TopBar.jsx` — sticky hairline-bordered bar, "Quill" wordmark with
    teal status dot, tagline on `md:` and up.
  - `components/InputScreen.jsx` — Mode select (Shadcn), labeled textarea,
    ghost "Load sample" + primary teal "Generate ✨" (disabled while empty/loading,
    spinner + "Generating…" while loading).
  - `components/ResultScreen.jsx` — split view: muted scrollable transcript on left,
    right column orders cards as [Gap check → Sections → Suggestions], each with
    `animation-delay: index * 120ms`. Gap-check card has red/amber left-accent bar
    + soft tinted background + AlertTriangle icon. ICD-10 sections render as
    teal pill chips. Approve toggles Approved pill and enables the dark export
    button whose label = `exportLabel`. Small "← New" link returns to fresh input.
  - `components/PrintView.jsx` — calls `window.print()` on mount (250 ms paint),
    listens for `afterprint` to return to result; clinic header, today's date,
    patient line, Drug/Dose/Frequency/Instructions table parsed from suggestion
    detail strings, signature line, Quill footer; `@media print` hides app chrome
    and the Emergent badge.
  - `lib/samples.js` — MODES + verbatim SAMPLES per brief.
  - `App.css` — design tokens, primary teal button (hover lift, press scale,
    disabled gray), `quill-stagger` keyframe (rise 8 px / fade), print stylesheet.
  - `index.css` — Inter font, Tailwind tokens aligned with design system.
  - `public/index.html` — Inter 400/500/600/700 from Google Fonts, page title set,
    theme color teal.
- **Tests (added by testing agent)**:
  - `/app/backend/tests/test_quill_api.py` — 13/13 passing (all modes, error paths,
    latency window, risk keyword presence).
  - E2E playwright run validated full input → result → approve → export → new flow
    for all 4 modes at desktop and mobile (390 px). 0 issues.

## Prioritized Backlog
### P0 (Phase 2 — next session)
- Swap hardcoded `QUILL_SEEDS` return for a real LLM call (Claude Sonnet 4.5 or
  GPT-5.2 — TBD with user). Same JSON schema. Keep the seed as fallback for
  offline/dev. Add prompt templates per mode.
### P1 (next iterations)
- History: persist generated records to Mongo with createdAt + mode for re-export.
- Auth (Emergent Google Auth) so each clinician/rep has their own history.
- Custom clinic header (name, address, registration #) editable in print view.
- Drag-and-drop transcript upload (.txt) or paste-from-clipboard nudge.
- "Edit before approve" — let user tweak section content inline.
### P2
- Audio capture + Whisper transcription → straight into the textarea.
- Team accounts + shared templates per mode.
- PDF export (server-rendered) for non-clinical modes too.
- Per-mode custom flags rule editor.

## Next Tasks
1. Confirm LLM provider for Phase 2 (Claude Sonnet 4.5 vs GPT-5.2).
2. Define prompt template per mode that reliably returns the JSON schema.
3. Wire `integration_playbook_expert_v2` for chosen LLM and implement in
   `/api/generate` behind a `USE_LLM` env switch (fallback to seed if disabled
   or on error).
