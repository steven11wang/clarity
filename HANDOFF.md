# Clarity — Engineering Handoff

A handoff for an agent picking up **Clarity**, an SAT Reading & Writing practice
web app. Read this before adding features — it explains the architecture, the
non-obvious design decisions, and where things plug in.

---

## 1. What Clarity is

The differentiator is **not** a question bank — it's a research-backed
mistake-learning loop. Students answer questions, then every wrong answer is
redone, diagnosed in the student's own words, and resurfaced on a spaced
schedule until it's genuinely learned. Core principle everywhere:
**generation before revelation** — the student attempts, diagnoses, and
underlines evidence *before* any explanation is shown.

Audience: self-study high-schoolers. It's a free passion project — no backend,
no accounts, no payments. Responsive web only. Calm, editorial palette (cream
background, Georgia serif for passages, muted green accent `#49746b`).

## 2. Stack & how to run

- **Vite + React 19 + TypeScript**, no backend. All state in `localStorage`
  behind a swappable storage module.
- Node's built-in test runner (`node --test` via `tsx`), no test framework dep.

```sh
npm install
npm run dev        # dev server on :5173 (also .claude/launch.json → "clarity-dev")
npm test           # unit tests (pure logic modules)
npm run build      # tsc -b && vite build — must stay green
```

There is a **dev toolbar** fixed to the bottom of the app (demo mode): compress
the spaced-repetition schedule to seconds, jump the clock +1 day, and reset all
local data. Use it to test the resurrection loop without waiting days.

## 3. The data pipeline (`tools/`)

Questions are parsed from ~31 College Board PDF exports (Reading & Writing only)
into JSON. **The app never reads PDFs** — only `public/data/questions.json`.

```
PDFs ──parse_sat.py──▶ questions.json (full, 1647)  ──build_sample.py──▶ 290 active
                       + images/*.png + question-sources.json (provenance)
```

- `tools/parse_sat.py` — pdfplumber parser. Emits `id, test, domain, skill,
  difficulty, passage, prompt, choices{A–D}, answer, rationale`, plus optional
  `notes[]` (research-note questions), and figure fields (`has_figure`,
  `figure_type`, `image`, `figure_description`, `table`). Malformed records are
  **quarantined**, never silently shipped.
- `tools/build_sample.py <full_dir> <out_dir> [per_leaf]` — curates up to N
  (default 10) questions per `(difficulty, skill)` leaf into the active dataset.
- `tools/validate.py` — data-quality gate (4 choices, valid answer, non-empty
  fields, figure images exist, provenance coverage).
- `tools/test_parser.py` — 21 parser unit tests.

**Regenerate the data** (venv at `tools/.venv` has pdfplumber):
```sh
tools/.venv/bin/python tools/parse_sat.py "<SAT PDF root>" /tmp/full
tools/.venv/bin/python tools/build_sample.py /tmp/full public/data 10
tools/.venv/bin/python tools/validate.py public/data/questions.json --images public/data/images
```

> ⚠️ **`public/data/*.json` and `images/*` are gitignored** — they're
> regenerable artifacts, not source. The current active dataset is **290
> questions** (10 per leaf; Cross-Text Connections Medium/Hard only have 5 each
> in the entire bank). `questions.full.json` (1647) swaps in with a file copy.

## 4. Architecture — the important boundaries

Data flows one way: `data/` loads questions → `App.tsx` orchestrates the session
→ components render phases → everything persists through `storage/`. **Pure,
testable logic lives in `src/review/` and `model.ts`; React components stay
thin.** Keep it that way.

| Area | Files | Responsibility |
|---|---|---|
| Types | `src/types.ts` | `Question`, `Attempt` (the persistence contract), `FirstPass`, `ReviewItem`, all unions. **Extend `Attempt` here** — it's optional-field back-compatible. |
| Data layer | `src/data/questions.ts` | One `loadQuestions()` fetch of `/data/questions.json`. Never import questions statically. |
| Storage | `src/storage/index.ts` | Namespaced (`clarity:v1:`) localStorage: attempts, review queue, settings, dev clock. **All persistence goes through here** — corrupt values are safely ignored. Swap this file for an API client later. |
| Loop model | `src/components/QuestionInteraction/model.ts` | Pure state machine for the review loop (`initReview`, `submitRedo`, `setCause`…`setTrap`, `toAttempt`). No React. Unit-tested in `model.test.ts`. |
| Answer pass | `AnswerPass.tsx` | Pass 1: choice + confidence + timer, **no reveal**. |
| Review pass | `QuestionInteraction.tsx` | Pass 2: owns the passage pane + all diagnosis phase UI. **All reveal/diagnosis logic lives here.** |
| Passage | `Passage/Passage.tsx`, `sentence.ts` | Renders passage as tappable sentence spans (evidence underline), research notes as `<ul>`, figures as `<img>`/`<table>`. `sentence.ts` = tested sentence segmenter (skips initials/abbreviations). |
| Review engine | `src/review/` | `schedule.ts` (spaced intervals + retirement), `stream.ts` (weave due reviews into a session), `ordering.ts` (choice shuffle for disguise), `stats.ts` (dashboard aggregates), `evidence.ts` (rationale→sentence reinforcement). All pure + several tested. |
| Content | `src/content/` | `traps.ts` (5 trap types), `questionIntents.ts` (per-skill "what's being asked" for the logic chain). |
| Screens | `Browse/`, `Dashboard/`, `SessionSummary/` | Hierarchical browse (Test›Difficulty›Domain›Skill), insight dashboard, end-of-session results. |
| Orchestrator | `App.tsx` | View routing (browse/practice/dashboard) + the two-pass session state machine + scheduling. |
| Design tokens | `src/tokens.ts`, `src/app.css` | Colors/spacing/radii + all shared styles. |

## 5. The two-pass session flow (read this before touching `App.tsx`)

Practice is **test-then-review**, not question-by-question:

1. **Answer pass** — the student answers *every* question in the set with only a
   choice + confidence (Sure/Leaning/Guessing). No feedback. Timed mode (if on)
   runs a per-question countdown here; timeout auto-advances and records a
   timing failure. → produces a `FirstPass` per question.
2. **Correct answers are logged immediately** (`firstPassAttempt`) so the
   calibration chart and score see them — they are **not** reviewed.
3. **Review intro** — "N right, M to review."
4. **Review pass** — only the missed/timed-out questions. Each: redo it
   (answer-until-correct) → autopsy: cause tap → **dropdown** "why was your
   answer wrong?" → self-grade vs revealed rationale → evidence underline →
   logic chain → chain-break → trap naming → done. The answer-pass choice +
   confidence **merge** with the review diagnosis into one `Attempt`.
5. **Summary** — score %, total/correct/incorrect, what's scheduled to resurface.

**Resurrection** (`review/schedule.ts` + `stream.ts`): every miss/hidden-error
enters a queue, due at ~2/7/30 days (demo: 20/60/180 s), woven back into future
sessions with **shuffled choices** so it's disguised, retired only after a
correct answer (evidence-checked when available). The dev toolbar drives this.

## 6. Conventions & constraints

- **Never reveal correctness during the answer pass** — the whole model depends
  on it. New question types must respect the two-pass split.
- **Every required input is one tap or one selection** — friction kills
  completion. No multi-field free text.
- **Accessibility**: correctness is signalled by icon + text + color, never
  color alone (see the `.choice--wrong` / `choice-tag` pattern).
- **Put new pure logic in `review/` or `model.ts` with a unit test**; keep
  components declarative.
- Extend `Attempt` (add optional fields) rather than inventing parallel stores;
  bump `clarity:v1:` and add a migration in `storage/` if you change its shape.
- Choices always render through `orderedChoices(...)` (display letter ≠ source
  letter) so shuffling stays free.

## 7. Testing a change

- `npm test` + `npm run build` must stay green (currently **20 app + 21 parser
  tests**).
- For UI, use the browser preview and the dev toolbar. **Gotcha:** driving the
  app from injected JS, React batches state between synchronous `.click()`
  calls — split "select" and "submit" across separate evaluations, and wrap
  snippets in an IIFE (the eval context persists `const`s otherwise).
- If you change the parser or data shape, re-run `validate.py`.

## 8. Known limitations / good first tasks

- **Hidden-error detection is effectively off** in the current missed-only
  review (correct answers aren't evidence-checked). A "review everything" toggle
  would restore it — the model already branches on it (`submitRedo` →
  `evidence` when the answer was correct).
- **Math is not built** — dataset is Reading & Writing only. The loop has no
  Math variant (evidence-underline doesn't map to grid-ins).
- **Cross-Text passages** render "Text 1 … Text 2 …" run together (parser joins
  the two texts); splitting them into labeled blocks is a nice polish.
- **Idle in timed mode** auto-advances through the whole set (intended, but a
  "pause on timeout" option was floated).
- **Skill map & Bluebook score intake** (from the original spec) aren't built —
  the dashboard shows per-skill error data but no Foundation/Medium/Advanced
  ladder or diagnostic import.
- **No auth / no export-import** of the local error log yet.

## 9. Git & deploy state

- Branch: **`phase-2-3-clarity-loop`** (all work sits here; `main`/base is the
  Codex Phase 0–1 baseline).
- **Not pushed** — the repo has no remote and `gh` isn't authenticated. To
  publish: `gh auth login` then `gh repo create clarity --private --source=. --push`.
- **Not deployed.** It's a static SPA — `npm run build` → `dist/` deploys to any
  static host (GitHub Pages / Netlify). Remember the data files are gitignored,
  so a deploy pipeline must run the parser/`build_sample.py` (or ship the
  generated `public/data/` out of band) before `vite build`.

## 10. Commit history (most recent first)

```
36b4fd2 fix: show the answer you originally chose in the review redo
7788081 feat: practice UX improvements (research notes, 10/skill, review UI, results, incorrect marking)
dcb183c feat: two-pass flow — answer the whole set, then review the misses
ce600b9 feat: timed mode with auto-advance on timeout
0f88b4a feat: Clarity five-step loop, resurrection, dashboard (Phase 2-3)
28fb327 chore: baseline Codex Phase 0-1 (parser + foundation site)
```
