# Answer Choice Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show all four answer choices with clear correct-answer and original-wrong-answer markers in the evidence-grade review step.

**Architecture:** Keep answer-choice status calculation as a small pure helper in the review model, then render one shared comparison component from both review phases. The evidence-grade phase will place that component between the rationale/evidence hint and the evidence self-grade controls.

**Tech Stack:** React 19, TypeScript, Node built-in test runner, existing CSS.

## Global Constraints

- Preserve the existing A–D display order produced by `orderedChoices`.
- Do not change question data, persistence, scoring, or review progression.
- Timed-out first passes with no selected choice must not show a false “Your answer” marker.

---

### Task 1: Add answer-choice status logic

**Files:**
- Modify: `src/components/QuestionInteraction/model.ts`
- Test: `src/components/QuestionInteraction/model.test.ts`

**Interfaces:**
- Produces `answerChoiceStatus(sourceLetter, correctLetter, firstChoice)` returning `{ isCorrect: boolean; isChosenWrong: boolean }`.

- [ ] **Step 1: Write the failing test**

Add tests that assert the helper marks the correct choice, marks the original wrong choice, and leaves all choices unmarked when `firstChoice` is empty.

```ts
test('identifies the correct choice and the original wrong choice', () => {
  assert.deepEqual(answerChoiceStatus('A', 'A', 'C'), { isCorrect: true, isChosenWrong: false })
  assert.deepEqual(answerChoiceStatus('C', 'A', 'C'), { isCorrect: false, isChosenWrong: true })
})

test('does not mark a choice as chosen when the student timed out', () => {
  assert.deepEqual(answerChoiceStatus('C', 'A', ''), { isCorrect: false, isChosenWrong: false })
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/components/QuestionInteraction/model.test.ts`

Expected: FAIL because `answerChoiceStatus` is not exported yet.

- [ ] **Step 3: Write the minimal implementation**

Add the exported helper to `model.ts`:

```ts
export function answerChoiceStatus(sourceLetter: string, correctLetter: string, firstChoice: string) {
  return {
    isCorrect: sourceLetter === correctLetter,
    isChosenWrong: firstChoice !== '' && sourceLetter === firstChoice && sourceLetter !== correctLetter,
  }
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- src/components/QuestionInteraction/model.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/QuestionInteraction/model.ts src/components/QuestionInteraction/model.test.ts
git commit -m "test: define answer choice review statuses"
```

### Task 2: Share the comparison UI across review phases

**Files:**
- Modify: `src/components/QuestionInteraction/QuestionInteraction.tsx`

**Interfaces:**
- Consumes `answerChoiceStatus`, `question`, `choiceSlots`, and `firstPass.chosen`.
- Produces the existing comparison UI in self-grade and the new comparison UI in evidence-grade.

- [ ] **Step 1: Write the failing UI behavior test or testable assertion**

Use the Task 1 helper as the regression seam; no new renderer dependency is needed in this repository. Confirm the existing model tests fail before implementation and pass after the helper exists.

- [ ] **Step 2: Implement the shared component**

Create a local `AnswerChoiceComparison` component in `QuestionInteraction.tsx` that maps `choiceSlots`, calls `answerChoiceStatus`, and renders:

```tsx
<div className="answer-comparison" aria-label="Answer choice comparison">
  <p className="panel-label">All answer choices</p>
  {choiceSlots.map((slot) => {
    const { isCorrect, isChosenWrong } = answerChoiceStatus(slot.sourceLetter, question.answer, firstChoice)
    return (
      <div className={`answer-comparison__choice ${isCorrect ? 'is-correct' : ''} ${isChosenWrong ? 'is-wrong' : ''}`} key={slot.displayLetter}>
        <span className="choice-letter">{slot.displayLetter}</span>
        <span>{slot.text}</span>
        {isCorrect && <strong>Correct answer</strong>}
        {isChosenWrong && <strong>Your answer</strong>}
      </div>
    )
  })}
</div>
```

Replace the duplicated self-grade markup with the component. Render the same component in evidence-grade immediately after the rationale and optional evidence hint, before the “Did your underline land on the evidence?” prompt.

- [ ] **Step 3: Run focused tests and typecheck**

Run: `npm test -- src/components/QuestionInteraction/model.test.ts`

Run: `npm run build`

Expected: focused tests pass and the production build completes without TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/QuestionInteraction/QuestionInteraction.tsx
git commit -m "feat: show all answer choices during evidence review"
```

### Task 3: Verify the complete change

**Files:**
- No additional files.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: all existing and new tests pass.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript compilation, Vite bundling, and the existing site preparation step complete successfully.

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors; only the intended implementation commits are newly created, with pre-existing user changes left untouched.
