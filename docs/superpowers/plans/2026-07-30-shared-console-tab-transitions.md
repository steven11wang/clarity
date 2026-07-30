# Shared Console Tab Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Home console background and header continuously mounted while Practice, Library, and Insights change through a calm directional foreground transition.

**Architecture:** `ProgressDashboard` becomes the persistent primary console shell and receives the active top-level view plus the Library and Insights panels. A focused `PrimaryViewTransition` component owns the two-layer exit/entry animation and stale-timer protection. `App` keeps `AdaptiveExperience` mounted for all three primary views, while Library and Insights expose embedded variants without their legacy headers or page shells.

**Tech Stack:** React 19, TypeScript 6, CSS animations, Node test runner, jsdom

## Global Constraints

- The Home background, ambient hero wash, header, settings, and avatar remain mounted across Practice, Library, and Insights.
- The neutral Home background is used for Library and Insights without restarting, repositioning, or recoloring the scene.
- Foreground movement is limited to approximately 8–12 pixels over about 350 milliseconds with gentle deceleration.
- `prefers-reduced-motion: reduce` removes translation and reduces or eliminates animation.
- Lessons, assessments, and active practice sessions remain focused flows outside the primary tab shell.
- Existing Library taxonomy, Insights calculations, and practice-session behavior do not change.

---

## File Structure

- Create `src/components/Adaptive/PrimaryViewTransition.tsx`: render and coordinate outgoing/incoming foreground layers.
- Create `src/components/Adaptive/primaryViewTransition.ts`: define primary-view types and deterministic direction calculation.
- Create `src/components/Adaptive/primaryViewTransition.test.ts`: unit-test navigation direction.
- Create `src/components/Adaptive/PrimaryViewTransition.dom.test.tsx`: verify current content, two-layer handoff, rapid navigation, and settled content.
- Modify `src/components/Adaptive/ProgressDashboard.tsx`: keep the console scene and header persistent, expose correct active navigation, and place all primary content inside the transition.
- Modify `src/components/Adaptive/AdaptiveExperience.tsx`: pass active primary-view state and embedded panels into the dashboard shell.
- Modify `src/components/Browse/Browse.tsx`: support an embedded, headerless Library panel.
- Modify `src/components/Dashboard/Dashboard.tsx`: support an embedded, headerless Insights panel.
- Modify `src/App.tsx`: keep `AdaptiveExperience` mounted across all primary views and construct embedded panels.
- Modify `src/console-theme.css`: add foreground transition layers, embedded panel spacing, and reduced-motion rules.
- Modify `src/console-theme.test.ts`: verify persistent/transition theme rules and reduced-motion coverage.

---

### Task 1: Directional Foreground Transition

**Files:**
- Create: `src/components/Adaptive/primaryViewTransition.ts`
- Create: `src/components/Adaptive/primaryViewTransition.test.ts`
- Create: `src/components/Adaptive/PrimaryViewTransition.tsx`
- Create: `src/components/Adaptive/PrimaryViewTransition.dom.test.tsx`

**Interfaces:**
- Produces: `type PrimaryConsoleView = 'practice' | 'library' | 'insights'`
- Produces: `primaryViewDirection(from: PrimaryConsoleView, to: PrimaryConsoleView): -1 | 0 | 1`
- Produces: `PrimaryViewTransition({ activeView, panels }: { activeView: PrimaryConsoleView; panels: Record<PrimaryConsoleView, ReactNode> })`

- [ ] **Step 1: Write failing direction tests**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

import { primaryViewDirection } from './primaryViewTransition.ts'

test('primary views move forward in navigation order', () => {
  assert.equal(primaryViewDirection('practice', 'library'), 1)
  assert.equal(primaryViewDirection('library', 'insights'), 1)
})

test('primary views move backward in navigation order', () => {
  assert.equal(primaryViewDirection('insights', 'library'), -1)
  assert.equal(primaryViewDirection('library', 'practice'), -1)
})

test('the current primary view has no direction', () => {
  assert.equal(primaryViewDirection('library', 'library'), 0)
})
```

- [ ] **Step 2: Run the direction tests and verify failure**

Run: `node --experimental-strip-types --experimental-specifier-resolution=node --test src/components/Adaptive/primaryViewTransition.test.ts`

Expected: FAIL because `primaryViewTransition.ts` does not exist.

- [ ] **Step 3: Implement the view type and direction function**

```ts
export type PrimaryConsoleView = 'practice' | 'library' | 'insights'

const PRIMARY_VIEW_ORDER: PrimaryConsoleView[] = [
  'practice',
  'library',
  'insights',
]

export function primaryViewDirection(
  from: PrimaryConsoleView,
  to: PrimaryConsoleView,
): -1 | 0 | 1 {
  return Math.sign(
    PRIMARY_VIEW_ORDER.indexOf(to) - PRIMARY_VIEW_ORDER.indexOf(from),
  ) as -1 | 0 | 1
}
```

- [ ] **Step 4: Run the direction tests and verify success**

Run: `node --experimental-strip-types --experimental-specifier-resolution=node --test src/components/Adaptive/primaryViewTransition.test.ts`

Expected: 3 passing tests.

- [ ] **Step 5: Write the failing DOM transition test**

Mount `PrimaryViewTransition` with three labeled panels. Assert that the initial render has one current layer, rerendering from Practice to Library creates an exiting Practice layer and an entering Library layer with `data-direction="forward"`, and after 400 milliseconds only Library remains. Rerender Library → Insights → Practice before the timer settles and assert that stale timers never restore Library or Insights.

```tsx
root.render(createElement(PrimaryViewTransition, {
  activeView: 'practice',
  panels: {
    practice: createElement('p', null, 'Practice panel'),
    library: createElement('p', null, 'Library panel'),
    insights: createElement('p', null, 'Insights panel'),
  },
}))

assert.equal(container.querySelectorAll('.console-primary-layer').length, 1)

root.render(createElement(PrimaryViewTransition, {
  activeView: 'library',
  panels,
}))

assert.equal(container.querySelectorAll('.console-primary-layer').length, 2)
assert.equal(
  container.querySelector('.console-primary-transition')?.getAttribute('data-direction'),
  'forward',
)
```

- [ ] **Step 6: Run the DOM transition test and verify failure**

Run: `npm test -- --test-name-pattern="primary view transition"`

Expected: FAIL because `PrimaryViewTransition.tsx` does not exist.

- [ ] **Step 7: Implement the layered transition**

Implement a 350 millisecond handoff with:

```ts
const PRIMARY_TRANSITION_MS = 350
const activeViewRef = useRef(activeView)
const generationRef = useRef(0)
const timerRef = useRef<number | null>(null)
```

On `activeView` change:

1. Increment `generationRef`.
2. Clear the previous timer.
3. Read the previous requested view from `activeViewRef` and immediately update the ref.
4. Render the previous panel with `console-primary-layer--exiting`.
5. Render the requested panel with `console-primary-layer--entering`.
6. Set `data-direction` to `forward` or `backward`.
7. After 350 milliseconds, settle to one `console-primary-layer--current` only if the timer generation is still current.
8. Clear the timer on unmount.

- [ ] **Step 8: Run transition tests**

Run: `npm test -- --test-name-pattern="primary view transition|primary views"`

Expected: all matching unit and DOM tests pass.

- [ ] **Step 9: Commit the transition unit**

```bash
git add src/components/Adaptive/primaryViewTransition.ts src/components/Adaptive/primaryViewTransition.test.ts src/components/Adaptive/PrimaryViewTransition.tsx src/components/Adaptive/PrimaryViewTransition.dom.test.tsx
git commit -m "feat: add primary view transition"
```

---

### Task 2: Persistent Console Shell

**Files:**
- Modify: `src/components/Adaptive/ProgressDashboard.tsx`
- Modify: `src/components/Adaptive/AdaptiveExperience.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `PrimaryConsoleView`
- Consumes: `PrimaryViewTransition`
- `AdaptiveExperienceProps` adds `primaryView: PrimaryConsoleView`, `libraryPanel: ReactNode`, and `insightsPanel: ReactNode`
- `ProgressDashboardProps` adds the same three properties

- [ ] **Step 1: Extend the transition DOM test with shell-stability assertions**

Add a small harness whose scene and header sit outside `PrimaryViewTransition`. Rerender through all three active views and assert that the exact same scene and header DOM nodes remain connected and reference-equal while the content changes.

```ts
const sceneBefore = container.querySelector('.console-hero-wash')
const headerBefore = container.querySelector('.console-header')
await renderHarness('insights')
assert.equal(container.querySelector('.console-hero-wash'), sceneBefore)
assert.equal(container.querySelector('.console-header'), headerBefore)
```

- [ ] **Step 2: Run the shell-stability test and verify failure**

Run: `npm test -- --test-name-pattern="persistent console shell"`

Expected: FAIL until the harness uses the persistent layout.

- [ ] **Step 3: Add primary-view props through `AdaptiveExperience`**

Import `ReactNode` and `PrimaryConsoleView`, add the three props to `AdaptiveExperienceProps`, destructure them, and pass them into `ProgressDashboard` in the dashboard return:

```tsx
<ProgressDashboard
  activeView={primaryView}
  libraryPanel={libraryPanel}
  insightsPanel={insightsPanel}
  cards={cards}
  onSelectDomain={chooseDomain}
  onUpdateScore={() => setIsUpdatingScore(true)}
  onOpenLibrary={onOpenLibrary}
  onOpenInsights={onOpenInsights}
/>
```

- [ ] **Step 4: Make `ProgressDashboard` the persistent shell**

Add `activeView`, `libraryPanel`, and `insightsPanel` props. Keep `.console-dashboard`, `.console-hero-wash`, and `.console-header` outside `PrimaryViewTransition`.

The navigation buttons use:

```tsx
className={activeView === 'practice' ? 'console-nav__active' : undefined}
aria-current={activeView === 'practice' ? 'page' : undefined}
```

with equivalent Library and Insights states.

Wrap the existing rail, hero, status, and widgets as the Practice panel. Pass all panels to:

```tsx
<PrimaryViewTransition
  activeView={activeView}
  panels={{
    practice: practicePanel,
    library: libraryPanel,
    insights: insightsPanel,
  }}
/>
```

Use the current domain/review/trophy accent class only when `activeView === 'practice'`; otherwise apply the neutral `console-dashboard--today` class.

- [ ] **Step 5: Keep `AdaptiveExperience` mounted in `App`**

Replace the three separate `adaptive`, `browse`, and `insights` early returns with one primary-view branch:

```ts
const primaryView =
  view === 'browse' ? 'library' :
  view === 'insights' ? 'insights' :
  'practice'
```

Render one `AdaptiveExperience` for all three values and pass embedded `Browse` and `Dashboard` panels. Keep `view === 'practice'` on the existing focused-session path.

- [ ] **Step 6: Run type checking and tests**

Run: `npm test`

Expected: all tests pass.

Run: `npm run build`

Expected: TypeScript and Vite build succeed.

- [ ] **Step 7: Commit the persistent shell**

```bash
git add src/App.tsx src/components/Adaptive/AdaptiveExperience.tsx src/components/Adaptive/ProgressDashboard.tsx src/components/Adaptive/PrimaryViewTransition.dom.test.tsx
git commit -m "feat: keep console shell across primary tabs"
```

---

### Task 3: Embedded Panels and Calm Motion Styling

**Files:**
- Modify: `src/components/Browse/Browse.tsx`
- Modify: `src/components/Dashboard/Dashboard.tsx`
- Modify: `src/console-theme.css`
- Modify: `src/console-theme.test.ts`

**Interfaces:**
- `BrowseProps` adds `embedded?: boolean`
- `Dashboard` props add `embedded?: boolean`
- Embedded variants render `<section>` roots without `.app-header`

- [ ] **Step 1: Write failing theme assertions**

Add tests to `src/console-theme.test.ts`:

```ts
test('primary panels crossfade without moving the console scene', () => {
  const stylesheet = readFileSync(new URL('./console-theme.css', import.meta.url), 'utf8')

  assert.match(stylesheet, /\.console-primary-transition\s*\{[^}]*position:\s*relative/s)
  assert.match(stylesheet, /@keyframes consolePrimaryEnter/)
  assert.match(stylesheet, /@keyframes consolePrimaryExit/)
  assert.match(stylesheet, /animation-duration:\s*350ms/)
})

test('primary panel movement is removed for reduced motion', () => {
  const stylesheet = readFileSync(new URL('./console-theme.css', import.meta.url), 'utf8')

  assert.match(
    stylesheet,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.console-primary-layer--entering[\s\S]*animation:\s*none/,
  )
})
```

- [ ] **Step 2: Run theme tests and verify failure**

Run: `node --experimental-strip-types --experimental-specifier-resolution=node --test src/console-theme.test.ts`

Expected: new transition assertions fail.

- [ ] **Step 3: Add embedded Library rendering**

Add `embedded = false`. Build the existing Library body once, omit `.app-header` when embedded, and use:

```tsx
return embedded ? (
  <section className="browse browse--embedded" aria-label="Library">
    {content}
  </section>
) : (
  <main className="browse app-shell">
    {header}
    {content}
  </main>
)
```

The embedded root must not include `.app-shell`, a wordmark, or a Dashboard link.

- [ ] **Step 4: Add embedded Insights rendering**

Add `embedded = false`. Build the existing Insights content once, omit `.app-header` when embedded, and use:

```tsx
return embedded ? (
  <section className="dashboard dashboard--embedded" aria-label="Insights">
    {content}
  </section>
) : (
  <main className="dashboard app-shell">
    {header}
    {content}
  </main>
)
```

The embedded root must not include `.app-shell`, a wordmark, or a Practice link.

- [ ] **Step 5: Add calm two-layer motion**

In `src/console-theme.css`, make the foreground container isolated and animate only its layers:

```css
.console-primary-transition {
  min-height: 28rem;
  position: relative;
  z-index: 2;
}

.console-primary-layer {
  width: 100%;
}

.console-primary-layer--exiting {
  animation: consolePrimaryExit 350ms cubic-bezier(.4, 0, .2, 1) both;
  left: 0;
  pointer-events: none;
  position: absolute;
  top: 0;
}

.console-primary-layer--entering {
  animation: consolePrimaryEnter 350ms cubic-bezier(.18, .82, .24, 1) both;
}

@keyframes consolePrimaryEnter {
  from { opacity: 0; transform: translateX(var(--console-primary-offset, 10px)); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes consolePrimaryExit {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(calc(var(--console-primary-offset, 10px) * -0.6)); }
}
```

Set `--console-primary-offset: -10px` for backward transitions. Add console-aligned spacing for `.browse--embedded` and `.dashboard--embedded`. Under the existing reduced-motion media query, set entering and exiting layers to `animation: none`, with no transforms.

- [ ] **Step 6: Run all tests and the production build**

Run: `npm test`

Expected: all tests pass.

Run: `npm run build`

Expected: TypeScript, Vite, and site packaging succeed.

- [ ] **Step 7: Manually verify the interaction**

Start the app with `npm run dev`. Confirm:

- Home → Library → Insights → Home keeps the same background and header DOM without a flash.
- The active navigation label updates immediately.
- The foreground moves no more than 10 pixels and settles in about 350 milliseconds.
- Rapid tab clicks settle on the final requested view.
- Search opens Library; wordmark returns to Practice; settings and avatar still work.
- Library can start a practice session and Insights metrics still render.
- Narrow layouts remain readable.
- Reduced-motion emulation removes the slide.

- [ ] **Step 8: Commit embedded panels and motion**

```bash
git add src/components/Browse/Browse.tsx src/components/Dashboard/Dashboard.tsx src/console-theme.css src/console-theme.test.ts
git commit -m "feat: smooth primary console tab changes"
```

---

### Task 4: Final Regression Verification

**Files:**
- Verify only; modify the files above only if a regression is found.

**Interfaces:**
- Consumes the complete persistent-shell implementation.
- Produces a verified build with no known regressions.

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`

Expected: every unit and DOM test passes.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript compilation, Vite bundling, and site preparation all succeed.

- [ ] **Step 3: Review the final diff**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: only intentional task files are changed by this implementation; pre-existing unrelated workspace changes remain untouched.

- [ ] **Step 4: Commit any verification-only fixes**

If verification required a focused correction, stage only the files changed for that correction and commit:

```bash
git commit -m "fix: stabilize primary tab transition"
```

If no correction was necessary, do not create an empty commit.
