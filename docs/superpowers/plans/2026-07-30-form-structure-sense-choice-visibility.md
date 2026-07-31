# Form, Structure, and Sense Choice Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show answer choices immediately in the `Form, Structure, and Sense` worked example while preserving the existing gated flow for every other lesson.

**Architecture:** Keep the behavior local to `WorkedExample` in `SkillLesson.tsx`. Derive a boolean from the lesson skill, initialize the existing gate state from it, and conditionally omit the gate controls for that one skill. Protect the behavior with the existing DOM test harness.

**Tech Stack:** React 19, TypeScript, Node test runner, jsdom DOM tests.

## Global Constraints

- Only the `Form, Structure, and Sense` worked example bypasses the choice gate.
- Choice selection, strikeout, answer checking, explanation reveal, and reset behavior remain unchanged.
- All other lessons retain the current gated and blurred choice behavior.
- Do not change lesson content data or the shared gate copy table.

---

### Task 1: Add the regression test

**Files:**
- Modify: `src/components/Lesson/SkillLesson.dom.test.tsx`

**Interfaces:**
- Consumes: the existing `renderLesson`, `openTab`, `text`, and DOM query helpers.
- Produces: a failing test proving the named lesson renders unlocked choices without its gate prompt.

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `skill lesson shell` describe block:

```tsx
it('shows choices immediately for Form, Structure, and Sense', async () => {
  await renderLesson('Form, Structure, and Sense')
  await openTab('Worked example')

  const choices = container.querySelector('.lesson-choices')
  assert.ok(choices)
  assert.ok(!choices.className.includes('is-locked'), 'choices were still locked')
  assert.ok(!text().includes('What rule is being tested?'))
  assert.equal(container.querySelector('.lesson-gate'), null)
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm test -- --test-name-pattern='shows choices immediately for Form, Structure, and Sense'
```

Expected: FAIL because the current component renders the gate and locked choices for this lesson.

### Task 2: Implement the isolated exception

**Files:**
- Modify: `src/components/Lesson/SkillLesson.tsx` in `WorkedExample`

**Interfaces:**
- Consumes: the existing `skill: string` prop and `gateOpen` state.
- Produces: immediate unlocked choices only when `skill === 'Form, Structure, and Sense'`.

- [ ] **Step 1: Add the minimal condition and state initialization**

Inside `WorkedExample`, add:

```tsx
const showChoicesImmediately = skill === 'Form, Structure, and Sense'
const [gateOpen, setGateOpen] = useState(showChoicesImmediately)
```

Replace the current unconditional gate block with a conditional render so the gate controls are omitted for this skill:

```tsx
{!showChoicesImmediately && !gateOpen && (
  // existing lesson-gate markup unchanged
)}
```

Keep the existing `lesson-choices` class logic and all choice actions unchanged; the initialized `gateOpen` value makes the choices unlocked for the named lesson.

- [ ] **Step 2: Run the focused test to verify it passes**

Run:

```bash
npm test -- --test-name-pattern='shows choices immediately for Form, Structure, and Sense'
```

Expected: PASS.

### Task 3: Verify regression coverage and project health

**Files:**
- No additional files.

- [ ] **Step 1: Run the full lesson DOM test file**

Run:

```bash
npm test -- --test-name-pattern='skill lesson shell'
```

Expected: PASS, including the existing gated behavior and the new exception.

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS with no new failures.

- [ ] **Step 3: Run the TypeScript/build verification**

Run:

```bash
npm run build
```

Expected: PASS with no TypeScript or production-build errors.

- [ ] **Step 4: Review the diff**

Run:

```bash
git diff -- src/components/Lesson/SkillLesson.tsx src/components/Lesson/SkillLesson.dom.test.tsx
```

Confirm the diff only changes the one lesson’s gate visibility and its regression test.
