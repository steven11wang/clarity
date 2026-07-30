# Persistent Lessons Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Lessons a fourth persistent console tab and restyle both the lesson library and reader to match the existing PS5-inspired interface.

**Architecture:** Extend the existing primary-view state machine with `lessons`, then pass an embedded Lessons panel into the already-persistent `ProgressDashboard` shell. Keep lesson selection, first-read gating, and return behavior in `AdaptiveExperience`; make `LessonLibrary` and `SkillLesson` render as embedded panels so their content changes without remounting the global console scene.

**Tech Stack:** React 19, TypeScript, CSS, Node test runner, jsdom, Vite, Lucide React icons.

## Global Constraints

- Preserve the existing 350ms primary-view transition and its reduced-motion fallback.
- Keep one console background, wash, and header mounted across Practice, Lessons, Library, and Insights.
- Do not change lesson curriculum, scoring, storage schema, question selection, or gated-quiz behavior.
- Continue learning uses the recommended skill when available and otherwise the first lesson in the bundled index.
- Use native buttons, selected-state semantics, visible focus, and responsive single-column fallbacks.
- Preserve unrelated uncommitted workspace changes and stage only files named by each task.

---

### Task 1: Add Lessons to the Persistent Primary View

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Adaptive/AdaptiveExperience.tsx`
- Modify: `src/components/Adaptive/ProgressDashboard.tsx`
- Modify: `src/components/Adaptive/primaryViewTransition.ts`
- Modify: `src/components/Adaptive/primaryViewTransition.test.ts`
- Modify: `src/components/Adaptive/PrimaryViewTransition.dom.test.tsx`

**Interfaces:**
- Produces: `PrimaryConsoleView = 'practice' | 'lessons' | 'library' | 'insights'`
- Produces: `ProgressDashboardProps.lessonsPanel: ReactNode`
- Produces: `AdaptiveExperienceProps.onOpenLessons: () => void`
- Consumes: existing `PrimaryViewTransition` and the 350ms transition CSS.

- [ ] **Step 1: Write failing direction-order tests**

Add Lessons expectations to `primaryViewTransition.test.ts`:

```ts
test('lessons sits between practice and library', () => {
  assert.equal(primaryViewDirection('practice', 'lessons'), 1)
  assert.equal(primaryViewDirection('lessons', 'library'), 1)
  assert.equal(primaryViewDirection('library', 'lessons'), -1)
  assert.equal(primaryViewDirection('lessons', 'practice'), -1)
})
```

- [ ] **Step 2: Write the failing persistent-shell DOM test**

Extend the fixture panels and shell props:

```tsx
const panels = {
  practice: createElement('p', null, 'Practice panel'),
  lessons: createElement('p', null, 'Lessons panel'),
  library: createElement('p', null, 'Library panel'),
  insights: createElement('p', null, 'Insights panel'),
}

lessonsPanel: createElement('p', null, 'Embedded lessons'),
```

Render `lessons`, then assert the same scene/header nodes remain mounted, the
Lessons content appears, and the Lessons navigation button has
`aria-current="page"`.

- [ ] **Step 3: Run the targeted tests and verify RED**

Run:

```bash
node --experimental-strip-types --experimental-specifier-resolution=node --test src/components/Adaptive/primaryViewTransition.test.ts
node tools/build-dom-tests.mjs
node --test tools/dom-tests/components-Adaptive-PrimaryViewTransition.test.mjs
```

Expected: FAIL because `lessons` is not part of `PrimaryConsoleView`, the panel
record has no Lessons key, and the nav never marks Lessons active.

- [ ] **Step 4: Implement the fourth primary view**

Change the view model to:

```ts
export type PrimaryConsoleView =
  | 'practice'
  | 'lessons'
  | 'library'
  | 'insights'

const PRIMARY_VIEW_ORDER: PrimaryConsoleView[] = [
  'practice',
  'lessons',
  'library',
  'insights',
]
```

In `App.tsx`, add `'lessons'` to `View`, map it to `primaryView`, and pass:

```tsx
onOpenLessons={() => setView('lessons')}
```

In `ProgressDashboard`, accept `lessonsPanel`, mark the Lessons button active,
and include it in the transition record:

```tsx
<PrimaryViewTransition
  activeView={activeView}
  panels={{ practice: practicePanel, lessons: lessonsPanel, library: libraryPanel, insights: insightsPanel }}
/>
```

In `AdaptiveExperience`, accept `onOpenLessons` as a prop instead of opening a
standalone `screen === 'lessons'` page.

- [ ] **Step 5: Run the targeted tests and verify GREEN**

Run:

```bash
node --experimental-strip-types --experimental-specifier-resolution=node --test src/components/Adaptive/primaryViewTransition.test.ts
node tools/build-dom-tests.mjs
node --test tools/dom-tests/components-Adaptive-PrimaryViewTransition.test.mjs
```

Expected: PASS, including the new Lessons ordering and persistent-shell checks.

- [ ] **Step 6: Commit the primary-view integration**

```bash
git add src/App.tsx src/components/Adaptive/AdaptiveExperience.tsx src/components/Adaptive/ProgressDashboard.tsx src/components/Adaptive/primaryViewTransition.ts src/components/Adaptive/primaryViewTransition.test.ts src/components/Adaptive/PrimaryViewTransition.dom.test.tsx
git commit -m "feat: add lessons to primary console transition"
```

---

### Task 2: Build the Console-Style Lessons Landing Panel

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/components/Lesson/LessonLibrary.tsx`
- Create: `src/components/Lesson/LessonLibrary.dom.test.tsx`
- Modify: `src/components/Adaptive/AdaptiveExperience.tsx`

**Interfaces:**
- Produces: `LessonLibraryProps.recommendedSkill?: string | null`
- Produces: a `.lesson-console` embedded panel with `continue` and domain selections.
- Consumes: `SKILL_LESSON_INDEX`, `SAT_DOMAINS`, `DOMAIN_PRESENTATION`, and `onSelectSkill(skill)`.

- [ ] **Step 1: Add failing landing-panel DOM tests**

Mount `LessonLibrary` with `recommendedSkill="Command of Evidence"` and assert:

```ts
assert.equal(container.querySelectorAll('.adaptive-header').length, 0)
assert.equal(container.querySelectorAll('.lesson-console__tile').length, 5)
assert.equal(
  container.querySelector('.lesson-console__tile[aria-pressed="true"]')
    ?.textContent?.includes('Continue learning'),
  true,
)
assert.match(container.textContent ?? '', /Command of Evidence/)
```

Click the Craft and Structure tile and assert every visible lesson row belongs
to that domain. Click a lesson row and assert `onSelectSkill` receives its
skill name.

- [ ] **Step 2: Run the landing-panel test and verify RED**

Run:

```bash
node tools/build-dom-tests.mjs
node --test tools/dom-tests/components-Lesson-LessonLibrary.test.mjs
```

Expected: FAIL because the current component renders a standalone header, no
console rail, and all units at once.

- [ ] **Step 3: Install the real icon set**

Run:

```bash
npm install lucide-react
```

Use `Play`, `Search`, `BookOpenText`, `Blend`, and `WholeWord` from
`lucide-react`; do not create text-symbol or handcrafted SVG substitutes.

- [ ] **Step 4: Implement the landing-panel state and rail**

Use a local selection:

```ts
type LessonSelection =
  | { kind: 'continue' }
  | { kind: 'domain'; domain: SatDomain }

const [selection, setSelection] = useState<LessonSelection>({ kind: 'continue' })
const continueLesson =
  SKILL_LESSON_INDEX.find((entry) => entry.skill === recommendedSkill) ??
  SKILL_LESSON_INDEX[0]
```

Render one Continue tile followed by `SAT_DOMAINS.map(...)`. Use
`DOMAIN_PRESENTATION[domain]` for the label, description, and accent. The detail
region renders either a single continue hero or the filtered lesson rows:

```ts
const visibleLessons =
  selection.kind === 'domain'
    ? SKILL_LESSON_INDEX.filter((entry) => entry.domain === selection.domain)
    : [continueLesson]
```

Derive the current recommendation from the recommended domain's ordered skill
record. Prefer the first skill whose active level is incomplete, then the first
skill in that domain:

```ts
const recommendedDomain = progression.recommendedDomain
const recommendedDomainProgress = recommendedDomain
  ? progression.domains[recommendedDomain]
  : null
const recommendedSkill = recommendedDomainProgress
  ? Object.keys(recommendedDomainProgress.skills).find((skill) => {
      const level = getSkillPracticeLevel(recommendedDomainProgress, skill)
      return !recommendedDomainProgress.skills[skill].levels[level].complete
    }) ?? Object.keys(recommendedDomainProgress.skills)[0] ?? null
  : null
```

- [ ] **Step 5: Run the landing-panel test and verify GREEN**

Run:

```bash
node tools/build-dom-tests.mjs
node --test tools/dom-tests/components-Lesson-LessonLibrary.test.mjs
```

Expected: PASS with five rail tiles, no duplicate header, correct filtering,
and working lesson selection.

- [ ] **Step 6: Commit the Lessons landing panel**

```bash
git add package.json package-lock.json src/components/Lesson/LessonLibrary.tsx src/components/Lesson/LessonLibrary.dom.test.tsx src/components/Adaptive/AdaptiveExperience.tsx
git commit -m "feat: redesign lessons as a console rail"
```

---

### Task 3: Embed and Restyle the Individual Lesson Reader

**Files:**
- Modify: `src/components/Lesson/SkillLesson.tsx`
- Modify: `src/components/Lesson/SkillLesson.dom.test.tsx`
- Modify: `src/components/Adaptive/AdaptiveExperience.tsx`
- Modify: `src/components/Adaptive/ProgressDashboard.tsx`

**Interfaces:**
- Produces: `SkillLessonProps.embedded?: boolean`
- Produces: `lessonsPanel` that switches between `LessonLibrary` and `SkillLesson`.
- Consumes: existing `PendingLesson`, `onFinish`, `onExit`, and four-tab lesson content.

- [ ] **Step 1: Add failing embedded-reader tests**

Mount `SkillLesson` with `embedded` and assert:

```ts
assert.equal(container.querySelectorAll('.adaptive-header').length, 0)
assert.ok(container.querySelector('.lesson-reader'))
assert.match(
  container.querySelector('.lesson-reader__back')?.textContent ?? '',
  /All lessons/,
)
assert.deepEqual(
  all('.lesson-tab__label').map((node) => node.textContent),
  ['Lesson', 'Worked example', 'Tips', 'Practice'],
)
```

Retain the existing tests for locked choices, strike-out, grading, tips, and
finishing the Practice section.

- [ ] **Step 2: Run the reader test and verify RED**

Run:

```bash
node tools/build-dom-tests.mjs
node --test tools/dom-tests/components-Lesson-SkillLesson.test.mjs
```

Expected: FAIL because `embedded`, `.lesson-reader`, and the console back action
do not exist.

- [ ] **Step 3: Implement the embedded reader shell**

Use one content tree and choose only the outer element:

```tsx
const content = (
  <>
    <button className="lesson-reader__back" type="button" onClick={onExit}>
      <ChevronLeft aria-hidden="true" /> All lessons
    </button>
    {/* title, section rail, current panel, and actions */}
  </>
)

return embedded ? (
  <section className="lesson-reader">{content}</section>
) : (
  <main className="adaptive-shell lesson-shell">{content}</main>
)
```

In `AdaptiveExperience`, remove the early standalone returns for
`screen === 'lessons'` and `screen === 'lesson'`. Build `lessonsPanel` from
`pendingLesson`:

```tsx
const lessonsPanel = pendingLesson && summary ? (
  <SkillLesson embedded summary={summary} {...lessonCallbacks} />
) : (
  <LessonLibrary
    recommendedSkill={recommendedSkill}
    onSelectSkill={(skill) => openLessonReread(skill, 'lessons')}
  />
)
```

When a domain lesson or first-read gate opens, pass `activeView="lessons"` to
the shell while preserving `PendingLesson.origin`; finishing still opens the
queued mini quiz or returns to the original domain.

- [ ] **Step 4: Run reader and transition tests and verify GREEN**

Run:

```bash
node tools/build-dom-tests.mjs
node --test tools/dom-tests/components-Lesson-SkillLesson.test.mjs tools/dom-tests/components-Adaptive-PrimaryViewTransition.test.mjs
```

Expected: PASS with one global header and the unchanged four-section lesson
behavior.

- [ ] **Step 5: Commit the embedded reader**

```bash
git add src/components/Lesson/SkillLesson.tsx src/components/Lesson/SkillLesson.dom.test.tsx src/components/Adaptive/AdaptiveExperience.tsx src/components/Adaptive/ProgressDashboard.tsx
git commit -m "feat: embed lesson reader in console shell"
```

---

### Task 4: Match the Console Visual Language and Verify the Whole Flow

**Files:**
- Modify: `src/components/Lesson/lesson.css`
- Modify: `src/console-theme.css`
- Modify: `src/primary-console-theme.test.ts`

**Interfaces:**
- Consumes: `.lesson-console`, `.lesson-reader`, `.lesson-tab`,
  `.console-primary-transition`, and existing console color variables.
- Produces: desktop and compact console layouts with reduced-motion behavior.

- [ ] **Step 1: Add failing CSS contract tests**

Add assertions:

```ts
assert.match(stylesheet, /\.lesson-console__rail\s*\{[^}]*display:\s*flex/s)
assert.match(stylesheet, /\.lesson-console__tile\[aria-pressed='true'\]/)
assert.match(stylesheet, /\.lesson-reader\s*\{[^}]*max-width:/s)
assert.match(
  stylesheet,
  /@media\s*\(max-width:\s*720px\)[\s\S]*\.lesson-console__detail/s,
)
```

- [ ] **Step 2: Run the CSS contract test and verify RED**

Run:

```bash
node --experimental-strip-types --experimental-specifier-resolution=node --test src/primary-console-theme.test.ts
```

Expected: FAIL because the new Lessons selectors do not exist.

- [ ] **Step 3: Implement the console styling**

Style the landing rail with the existing tile scale, selection ring, domain
accent custom property, dark translucent surfaces, and horizontal overflow.
Style the detail panel as an open hero/list area rather than stacked document
cards. Style the reader with:

```css
.lesson-reader {
  margin: 0 auto;
  max-width: 1120px;
  padding: clamp(1.5rem, 4vw, 3.5rem) var(--console-gutter) 6rem;
}

.lesson-tab[aria-selected='true'] {
  background: rgba(255, 255, 255, 0.13);
  border-color: rgba(140, 180, 255, 0.7);
  color: #fff;
}
```

Use the existing cobalt focus treatment, remove the standalone lesson header
spacing in embedded mode, keep text at readable line lengths, and stack reader
actions at 720px. Do not alter the primary transition timing.

- [ ] **Step 4: Run the CSS test and full automated suite**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: all tests pass, the production build exits 0, and the diff has no
whitespace errors.

- [ ] **Step 5: Perform browser QA**

Start the existing development server and inspect at the screenshot's wide
desktop viewport and at 390px width:

- Practice → Lessons → Library → Insights keeps the same scene and header.
- Lessons becomes active and transitions in the correct direction.
- Continue learning is selected by default.
- Domain tiles filter the lesson list.
- Opening and closing a lesson stays within the console.
- Lesson section controls, example interaction, and final action still work.
- Rapid tab changes settle on the last selected view.
- There is no clipping, duplicate header, or browser console error.

Capture the implemented Lessons screen and compare it side by side with the
provided reference screenshot at the same viewport. Correct visible spacing,
scale, alignment, radius, and typography mismatches before handoff.

- [ ] **Step 6: Commit the visual redesign**

```bash
git add src/components/Lesson/lesson.css src/console-theme.css src/primary-console-theme.test.ts
git commit -m "style: align lessons with console interface"
```
