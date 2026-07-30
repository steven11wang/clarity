# Clarity Adaptive Practice — Continuation Handoff

Updated: July 23, 2026

This document is the continuation handoff for the SAT Reading & Writing
adaptive-practice and character-progression feature. Read the repository-wide
[`HANDOFF.md`](./HANDOFF.md) first for the existing Clarity architecture,
question pipeline, and two-pass mistake-learning loop. This document supersedes
its statement that the skill map/score intake is not built.

The source product brief is also available at:

`/Users/s/.codex/attachments/b2e934c5-4d0e-43a8-8861-cc45690a1cdf/pasted-text.txt`

## Current repository state

- Working directory: `/Users/s/Desktop/clarity`
- Branch: `phase-2-3-clarity-loop`
- The adaptive feature is implemented but **uncommitted**.
- Preserve the dirty worktree. Do not reset, checkout, or delete these changes.
- There is no configured remote and nothing has been deployed.

Current `git status --short`:

```text
 M src/App.tsx
 M src/storage/index.test.ts
 M src/storage/index.ts
 M src/types.ts
?? src/components/Adaptive/
?? src/progression/
?? ADAPTIVE_FEATURE_HANDOFF.md
```

## What is implemented

### Score intake and recommendation

- Large first-run welcome with the four domain characters and an explicit
  Upload → Analyze → Start explanation.
- Screenshot intake is deliberately staged: the student chooses an image,
  reviews its preview/name/size, then starts analysis with a dedicated
  “Analyze score screenshot” button.
- PNG/JPEG/WebP validation, preview, parsing/loading, invalid-file, retry, and
  manual-entry states.
- A replaceable `ScoreParser` boundary backed by a server-only OpenAI Responses
  API integration. The browser sends the selected image to Clarity’s same-origin
  endpoint; the API key never enters the browser bundle.
- Structured vision output for all four domains, per-domain confidence,
  uncertainty highlighting, and a safe manual confirmation path when a result
  is missing or below the confidence threshold.
- The vision request uses `store: false`, validates type and size on both sides,
  treats image text as untrusted data, and uses `gpt-5.6-sol` by default
  (configurable with `OPENAI_VISION_MODEL`).
- The upload UI discloses that OpenAI processes the image and tells students to
  crop names, school details, IDs, QR codes, and other identifying information
  before analysis.
- Missing/rejected keys, provider limits, malformed results, unreachable
  service, invalid images, and non-report screenshots all produce explicit
  retry/manual-entry states rather than pretending extraction worked.
- Confirmation for Easy/Medium/Hard results in all four domains.
- Mapping: Easy → Noobie, Medium → Adventurer, Hard → Master.
- Unique weakest-domain recommendation and a dedicated tied-domain selection
  screen.
- The dashboard still lets the student choose any domain.

### Explicit progression state machine

- Per-domain entry/unlocked level, per-skill level completion, attempts and
  question history, remediation paths, checkpoint attempts/repairs/pass state,
  finished state, selected/recommended domain, and character stage.
- Exactly 3 questions per skill quiz; only 3/3 completes a skill.
- Adventurer/Master misses step down one level and require a perfect lower-level
  quiz before returning. Nested Master → Adventurer → Noobie remediation is
  supported.
- A Noobie miss repeats Noobie with fresher questions when possible.
- Adventurer and Master checkpoints contain exactly 3 questions per skill,
  interleaved as a complete mixed test, and require 100%.
- Checkpoint failure repairs only missed skills. Retake remains locked until all
  required repair quizzes reach 3/3.
- Adventurer checkpoint pass unlocks Master; Master checkpoint pass finishes the
  domain.
- Persisted-state normalization rejects malformed/noncontiguous remediation,
  orphaned checkpoint repairs, unreachable repair lists, and checkpoint passes
  not backed by a structurally valid perfect attempt.

### Question selection and freshness

- Taxonomy is derived from the runtime question bank, not hardcoded into pages.
- Deterministic exact-three selection prefers unseen and least-used questions,
  then least-recently used questions.
- Checkpoints select exactly 3 unique questions for every skill and interleave
  them deterministically.
- Insufficient leaves fail with a typed, reader-facing content error.
- Repair quizzes avoid both the most recent same-level quiz and questions for
  that skill from the checkpoint that triggered repair.
- Checkpoint retakes avoid the previous checkpoint and subsequent repair-quiz
  questions when enough content exists.
- The UI explicitly discloses when bank limits force reuse.

### Dashboard and accessible UI

- Four domain characters with a consistent identity at Noobie, Adventurer,
  Master, and Completed stages.
- Stage treatment includes posture/equipment/environment changes and a
  completion badge/glow.
- Each card shows domain, current level, completed skills, checkpoint status,
  recommendation/current focus, and finished state.
- Three-question quizzes and checkpoints render all questions together with
  native fieldsets/radios, keyboard operation, progress semantics, one submit,
  and no premature answer reveal.
- Responsive layout was checked at desktop and 390 × 844 with no horizontal
  overflow.
- Existing Practice Library, two-pass review loop, resurrection scheduling, and
  Learning Insights remain available.

### Persistence

- Main progression is one versioned `clarity:v1:progression` document.
- Adaptive question attempts extend the existing `Attempt` contract with
  optional activity context and feed misses into the existing resurrection
  queue.
- After an adaptive quiz or checkpoint summary, every missed question enters
  the existing immediate learning loop: redo-until-correct, error diagnosis,
  reasoning comparison, evidence selection, intent check, and trap analysis.
  The original batch score remains the sole input to progression/remediation.
- Completing that loop enriches the original adaptive attempt in place rather
  than double-counting the question, while the miss remains scheduled for
  later resurfacing.
- An in-progress assessment draft is saved under
  `clarity:v1:adaptive-draft`, including selected question IDs and current
  answers.
- Draft restoration validates the current onboarding timestamp, expected
  deterministic assessment ID, legal state-machine level/purpose, question
  membership, counts, and answers. Stale/corrupt drafts are discarded.
- Submission computes and validates the guarded progression transition before
  writing attempts/reviews. The quiz submit control also has an idempotence
  lock.
- Reset data removes every `clarity:v1:` key, including the draft.

## Key files

### Orchestration and persistence

- `src/App.tsx` — routes the adaptive experience alongside legacy practice,
  persists progression, records attempts, and schedules misses.
- `src/storage/index.ts` — progression and resumable assessment-draft storage.
- `src/storage/index.test.ts` — namespacing, progression reload, and draft
  storage coverage.
- `src/types.ts` — backward-compatible optional adaptive fields on `Attempt`.

### Pure progression logic

- `src/progression/config.ts` — domains, level mapping, character metadata.
- `src/progression/model.ts` — guarded state transitions and persisted-state
  normalization.
- `src/progression/model.test.ts` — progression/remediation/checkpoint tests.
- `src/progression/questions.ts` — taxonomy and deterministic selection.
- `src/progression/questions.test.ts` — exact-three, uniqueness, reuse, and
  checkpoint-count tests.
- `src/progression/freshness.ts` and `freshness.test.ts` — checkpoint repair and
  retake immediate-avoid rules.
- `src/progression/assessmentDraft.ts` — draft serialization and strict restore
  validation.
- `src/progression/scoreParser.ts` — replaceable screenshot parser interface and
  manual-required fallback.

### Adaptive UI

- `src/components/Adaptive/AdaptiveExperience.tsx` — adaptive view
  orchestration.
- `src/components/Adaptive/Onboarding.tsx` — upload, parsing, correction, and
  confirmation.
- `src/components/Adaptive/TieSelection.tsx` — weakest-domain tie resolution.
- `src/components/Adaptive/ProgressDashboard.tsx` and `Character.tsx` —
  character dashboard.
- `src/components/Adaptive/DomainPath.tsx` — skill path and checkpoint gates.
- `src/components/Adaptive/BatchQuiz.tsx` — fixed-unit quiz/checkpoint form.
- `src/components/Adaptive/AssessmentResult.tsx` — post-submit feedback.
- `src/components/Adaptive/ContentError.tsx` — insufficient-bank recovery.
- `src/components/Adaptive/adaptive.css` — responsive adaptive styling.

## Verification already completed

Most recent automated verification:

```text
npm test
63 tests, 15 suites, 63 passed, 0 failed

npm run build
tsc -b and vite build passed
53 modules transformed
```

Earlier, before the final draft/freshness/normalization hardening, the complete
browser flow was exercised in the in-app browser:

1. Uploaded a real local PNG and reached the honest manual-confirmation path.
2. Confirmed results with a two-way weakest-domain tie and selected one tie.
3. Verified all four selectable character cards and direct Medium/Hard entry.
4. Failed and retried Noobie practice; confirmed fresh sets and persisted
   completion after reload.
5. Failed Adventurer practice, completed lower-level foundation work, and
   returned to Adventurer.
6. Failed an Adventurer checkpoint in one skill, confirmed only that skill
   required repair, confirmed retake locking, repaired it, and passed the
   retake.
7. Completed Master skills and the Master checkpoint; confirmed permanent
   Completed character treatment after reload.
8. Checked the browser console twice: no errors or warnings.
9. Checked a 390 × 844 viewport: `clientWidth` and `scrollWidth` were both 390.

After the final draft/freshness/normalization hardening:

- Added four focused `assessmentDraft.ts` tests covering valid partial-answer
  restoration, stale identity rejection, changed skill membership, and
  checkpoint locking.
- Repeated a live mid-quiz reload: the same three questions and selected answer
  returned, progress remained at 1/3, submission completed once, and the next
  reload opened the dashboard rather than a stale quiz.
- Rechecked generated form IDs for whitespace, the 390 × 844 viewport for
  overflow, and browser warnings/errors. All checks passed.
- Completed a final static accessibility/readability pass and retained native
  fieldset, radio, progressbar, live-region, focus, and reduced-motion behavior.

After the explicit screenshot-analysis handoff:

- Selected a valid local PNG and confirmed that the app stopped on the new
  screenshot-ready screen instead of analyzing immediately.
- Confirmed the preview, filename, size, replace-image action, manual-entry
  fallback, and dedicated analysis button were exposed to assistive technology.
- Continued through manual confirmation, a two-way weakest-domain tie, the
  character dashboard, a Noobie skill path, and a perfect 3/3 mini quiz.
- Reloaded after domain selection and confirmed that the dashboard state was
  restored.
- Rechecked the updated welcome at 390 × 844: `clientWidth` and `scrollWidth`
  were both 390.
- Added score-intake tests for accepted types, invalid/empty/oversized files,
  and the honest manual fallback when OCR is unavailable.

After the server-side vision integration:

- Added a same-origin `/api/parse-score` endpoint to Vite development and
  preview servers.
- Verified request construction uses a server-held bearer key, structured JSON
  schema, high-detail image input, `store: false`, and the configurable balanced
  vision model.
- Added five server tests for request privacy/shape, uncertainty handling,
  missing-key behavior, successful structured extraction, and validation before
  provider use.
- Exercised the live local endpoint without a configured key and confirmed it
  returned the safe `VISION_NOT_CONFIGURED` response without contacting the
  provider.

After connecting adaptive misses to the established learning loop:

- Submitted an Adventurer mini quiz at 1/3 and confirmed the summary offered
  “Review 2 missed questions.”
- Opened the review and confirmed the original wrong choice was marked without
  revealing the answer, the student had to redo until correct, and the existing
  diagnosis sequence opened afterward.
- Added storage coverage proving the completed diagnosis replaces/enriches the
  original adaptive attempt instead of creating a duplicate.

## Final handoff steps

The implementation is complete. Before committing, rerun:

```sh
npm test
npm run build
git diff --check
git status --short
```

Commit/push only if the user explicitly requests it. There is currently no
remote.

## Genuine limitations

- The vision backend requires a valid `OPENAI_API_KEY` in ignored
  `.env.local`. That machine-local secret is intentionally not portable or
  committed; other environments must configure their own key.
- The current endpoint is attached to Vite development/preview servers. A
  production host must run this server middleware or provide an equivalent
  serverless route; a static-file-only deployment cannot keep an API key
  secure.
- There is still no user authentication. The progression document remains
  device-local through the existing storage layer.
- The active runtime bank is the 290-question sample. Most leaves contain 10
  questions, but Cross-Text Connections Medium/Hard contain only 5 even in the
  full source corpus. Reuse is unavoidable on longer failure/repair paths and
  is disclosed in the UI.
- `public/data/*.json` and question images are gitignored generated artifacts.
  A deployment must regenerate or separately ship them.
- Adaptive freshness currently uses adaptive progression history. Questions
  previously seen only in the legacy Practice Library/resurrection flow are not
  yet merged into adaptive history.
- Progression is persisted atomically as one document, but browser
  `localStorage` cannot provide a transaction spanning progression, attempts,
  and review keys. The code validates/saves progression first to avoid recording
  an invalid transition.
- There is no `lint` script in `package.json`; `npm run build` performs the
  TypeScript check.

## State-machine invariants to preserve

- Never reveal correctness until the entire mini quiz/checkpoint is submitted.
- Never complete a skill below 3/3.
- Never unlock a checkpoint before every skill at its level is complete and no
  remediation remains.
- Never pass a checkpoint below 100%.
- Never reset unrelated completed skills after a miss.
- Never keep a checkpoint repair that is not tied to the reachable checkpoint.
- Never trust persisted `passed: true` without a valid perfect attempt.
- Never select fewer or more than 3 questions per skill.
- Keep domains/skills/levels driven by config and the loaded bank rather than
  page-level hardcoding.
