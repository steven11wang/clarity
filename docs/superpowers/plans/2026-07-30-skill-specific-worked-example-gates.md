# Skill-specific worked-example gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a worked-example scratchpad whose instruction and example match the current lesson skill.

**Architecture:** Keep the lesson content model and the existing gate interaction unchanged. Add a local typed configuration lookup in `SkillLesson.tsx`, resolve one configuration from the lesson skill plus its existing `oneMove`, and use that configuration for every piece of gate copy. Unknown skills retain the current generic test-phrase fallback.

**Tech Stack:** React 19, TypeScript, JSDOM, Node's test runner.

## Global Constraints

- Do not modify generated `public/lessons/skill-lessons.json`.
- Do not alter choice locking, skipping, strike-out, grading, styles, or navigation.
- Preserve a usable generic fallback for lesson skills without a configuration.
- Leave unrelated working-tree changes untouched.

---

### Task 1: Add skill-specific gate copy and cover it with DOM tests

**Files:**
- Modify: `src/components/Lesson/SkillLesson.tsx:328-552`
- Modify: `src/components/Lesson/SkillLesson.dom.test.tsx:87-161`

**Interfaces:**
- Consumes: `SkillLessonSummary.skill` and `SkillLessonSummary.oneMove` already passed through `ExamplePanel`.
- Produces: a local `workedExampleGate(skill: string, oneMove: string)` function returning `{ label, hint, placeholder, phraseLabel, inputLabel }` for `WorkedExample`.

- [ ] **Step 1: Write the failing DOM test**

Render a helper-selected lesson for Rhetorical Synthesis and assert that its worked-example gate is not the generic test-phrase flow:

```ts
await renderLesson('Rhetorical Synthesis')
await openTab('Worked example')
assert.ok(text().includes('State the requirement'))
assert.ok(text().includes('Turn the goal into a checklist before you read the choices.'))
assert.equal(
  container.querySelector('.lesson-gate__input')?.getAttribute('placeholder'),
  'e.g. must say what most fish do AND what this one does',
)
assert.equal(container.querySelector('.lesson-gate__input')?.getAttribute('aria-label'), 'Your requirement')
```

Also type in a requirement, reveal choices, and assert the echo calls it `Your requirement`.

- [ ] **Step 2: Run the DOM test to verify it fails**

Run: `npm test -- src/components/Lesson/SkillLesson.dom.test.tsx`

Expected: FAIL because Rhetorical Synthesis still renders `Write your test phrase` and the generic input label.

- [ ] **Step 3: Add the minimal gate configuration and rendering**

In `SkillLesson.tsx`, add a `WorkedExampleGate` type and configurations for the ten lesson skills. Pass `summary.skill` from `SkillLesson` through `ExamplePanel` to `WorkedExample`. Replace the hard-coded title, hint, placeholder, input accessible label, and echo with the resolved configuration. Use the current `testPhraseHint(oneMove)` generic copy as the fallback.

- [ ] **Step 4: Run the DOM test to verify it passes**

Run: `npm test -- src/components/Lesson/SkillLesson.dom.test.tsx`

Expected: PASS, including the existing gate, choice, strike-out, grading, and tab tests.

- [ ] **Step 5: Run the complete test suite and build**

Run: `npm test && npm run build`

Expected: both commands exit 0 with no test failures or TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/Lesson/SkillLesson.tsx src/components/Lesson/SkillLesson.dom.test.tsx docs/superpowers/plans/2026-07-30-skill-specific-worked-example-gates.md
git commit -m "fix: tailor worked example scratchpads"
```
