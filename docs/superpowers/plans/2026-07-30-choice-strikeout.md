# Choice Strike-Out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reversible strike-out control to every answer choice in the normal answer pass, batch quiz, and review redo flow.

**Architecture:** Add a pure `toggleChoiceStrikeout` helper to the existing question interaction model and keep strike-out state separate from answer state. The answer pass and review redo use local state for the mounted question; the batch quiz stores a list of struck source letters by question id so navigation preserves marks. Replace answer-row elements that currently own selection clicks with a non-interactive row containing separate selection and strike-out controls, preventing the strike-out action from selecting an answer.

**Tech Stack:** React 19, TypeScript, existing Node test runner, existing CSS.

## Global Constraints

- Strike-out state must not affect answer selection, submitted answers, scoring, persistence, review progression, or diagnosis data.
- Struck choices remain selectable.
- Strike-out state is initialized empty and is not persisted across sessions or reloads.
- The strike-out control must be keyboard- and touch-accessible with action-specific accessible labels.
- Preserve the existing displayed choice order and existing answer-selection behavior.

---

### Task 1: Add the pure strike-out state helper

**Files:**
- Modify: `src/components/QuestionInteraction/model.ts`
- Test: `src/components/QuestionInteraction/model.test.ts`

**Interfaces:**
- Produces `toggleChoiceStrikeout(struckChoices: string[], choice: string): string[]`, returning a new array with `choice` added if absent or removed if present.

- [ ] **Step 1: Write the failing tests**

Add these imports and tests to `model.test.ts`:

```ts
import { toggleChoiceStrikeout } from './model.ts'

it('adds and removes one struck choice without mutating the source list', () => {
  const source = ['B']
  const struck = toggleChoiceStrikeout(source, 'C')

  assert.deepEqual(struck, ['B', 'C'])
  assert.deepEqual(source, ['B'])
  assert.deepEqual(toggleChoiceStrikeout(struck, 'B'), ['C'])
})

it('does not duplicate a choice when toggled repeatedly', () => {
  assert.deepEqual(toggleChoiceStrikeout(toggleChoiceStrikeout([], 'A'), 'A'), [])
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/components/QuestionInteraction/model.test.ts`

Expected: FAIL because `toggleChoiceStrikeout` is not exported yet.

- [ ] **Step 3: Write the minimal implementation**

Add this helper to `model.ts`:

```ts
export function toggleChoiceStrikeout(struckChoices: string[], choice: string): string[] {
  return struckChoices.includes(choice)
    ? struckChoices.filter((current) => current !== choice)
    : [...struckChoices, choice]
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- src/components/QuestionInteraction/model.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the helper and tests**

```bash
git add src/components/QuestionInteraction/model.ts src/components/QuestionInteraction/model.test.ts
git commit -m "feat: add answer choice strikeout state helper"
```

If git metadata is not writable in the workspace, leave the files staged/unstaged as permitted and report that commit creation was blocked.

### Task 2: Add strike-out to the normal answer pass

**Files:**
- Modify: `src/components/QuestionInteraction/AnswerPass.tsx`
- Modify: `src/app.css`

**Interfaces:**
- Consumes `toggleChoiceStrikeout` from `model.ts`.
- Keeps `choice` and `confidence` behavior unchanged.
- Renders `button[aria-label="Strike out choice …"]` or `button[aria-label="Restore choice …"]` for each answer choice.

- [ ] **Step 1: Write the failing UI test seam**

Extend the focused model test to demonstrate that strike-out state is independent of the selected answer:

```ts
it('tracks strike-out separately from the selected answer', () => {
  const selected = 'B'
  const struck = toggleChoiceStrikeout([], 'A')

  assert.equal(selected, 'B')
  assert.deepEqual(struck, ['A'])
})
```

Run: `npm test -- src/components/QuestionInteraction/model.test.ts`

Expected: PASS after Task 1; the UI work in this task is verified by build and manual DOM inspection because the repository has no mounted `AnswerPass` test harness.

- [ ] **Step 2: Add local strike-out state**

Import `toggleChoiceStrikeout` and add:

```ts
const [struckChoices, setStruckChoices] = useState<string[]>([])
```

- [ ] **Step 3: Split each answer row into selection and strike-out controls**

Replace the choice button with a `.choice` row containing a selection button and a separate strike-out button. The selection button keeps `onClick={() => setChoice(slot.sourceLetter)}` and the selected class. The strike-out button uses:

```tsx
const struck = struckChoices.includes(slot.sourceLetter)

<button
  type="button"
  className={`choice-strike ${struck ? 'choice-strike--on' : ''}`}
  aria-label={`${struck ? 'Restore' : 'Strike out'} choice ${slot.displayLetter}`}
  aria-pressed={struck}
  onClick={() => setStruckChoices((current) => toggleChoiceStrikeout(current, slot.sourceLetter))}
>
  {struck ? 'Restore' : 'Strike out'}
</button>
```

Apply a struck class to the answer text/letter while leaving the selection button enabled.

- [ ] **Step 4: Add the shared choice-row styling**

Add CSS for `.choice` as a row container, `.choice-select` as the full-width selection control, `.choice-strike` as a compact accessible control, and `.choice--struck` / `.choice-select--struck` to apply `text-decoration: line-through` to the letter and answer text. Preserve selected, focus, hover, and mobile behavior.

- [ ] **Step 5: Run focused tests and build**

Run: `npm test -- src/components/QuestionInteraction/model.test.ts`

Run: `npm run build`

Expected: tests pass and the production build completes without TypeScript or CSS errors.

### Task 3: Add strike-out to batch quiz with per-question persistence

**Files:**
- Modify: `src/components/Adaptive/BatchQuiz.tsx`
- Modify: `src/components/Adaptive/adaptive.css`

**Interfaces:**
- Consumes `toggleChoiceStrikeout` from `QuestionInteraction/model.ts`.
- Adds `struckChoices: Record<string, string[]>` local state keyed by question id.
- Leaves `BatchAnswers`, `onAnswersChange`, and submit payloads unchanged.

- [ ] **Step 1: Add the per-question state**

Add:

```ts
const [struckChoices, setStruckChoices] = useState<Record<string, string[]>>({})
```

For the current question, derive `const struck = struckChoices[question.id]?.includes(choice.sourceLetter) ?? false`.

- [ ] **Step 2: Separate answer selection from strike-out**

Keep the existing radio input and label selection path, but render the choice as a non-interactive `.batch-choice` row with a label for the radio and a separate strike-out button. The strike-out button updates only the current question id:

```tsx
onClick={() => setStruckChoices((current) => ({
  ...current,
  [question.id]: toggleChoiceStrikeout(current[question.id] ?? [], choice.sourceLetter),
}))}
```

Use `aria-pressed` and the same “Strike out/Restore choice …” action label. Ensure clicking the strike-out button does not select the radio.

- [ ] **Step 3: Style batch strike-out rows**

Update `.batch-choice` to support the row layout and add `.batch-choice__select`, `.batch-choice__strike`, and `.batch-choice--struck` rules. Keep the radio focus ring and selected treatment intact while striking through only the choice content.

- [ ] **Step 4: Verify navigation and submission behavior**

Run: `npm run build`

Manually verify in the batch quiz: strike out a choice, select a different answer, move forward, return to the question, confirm the strike-out remains, and submit. Confirm the submitted answer is still the selected radio value.

### Task 4: Add strike-out to review redo

**Files:**
- Modify: `src/components/QuestionInteraction/QuestionInteraction.tsx`
- Modify: `src/app.css`

**Interfaces:**
- Consumes `toggleChoiceStrikeout` from `model.ts`.
- Keeps `submitRedo(state, choice)` and `wrongChoices` unchanged.
- Strike-out state is local to the mounted review question and is never passed to `onComplete`.

- [ ] **Step 1: Add local review strike-out state**

Add:

```ts
const [struckChoices, setStruckChoices] = useState<string[]>([])
```

- [ ] **Step 2: Keep wrong-answer feedback and strike-out independent**

In the redo choice map, preserve the existing `isWrong`, disabled, label, and `submitRedo` behavior. Render each row with a selection control and a strike-out control. The strike-out control must remain available for non-disabled choices and must not call `submitRedo`.

Because already-wrong choices are disabled by the existing review flow, keep their current red feedback and crossed text. The new user strike-out styling applies only to choices still available to attempt.

- [ ] **Step 3: Verify review behavior**

Run: `npm test -- src/components/QuestionInteraction/model.test.ts && npm run build`

Manually verify that striking out an available redo choice does not prevent choosing it, and choosing it still records the same wrong attempt and displays the existing feedback.

### Task 5: Full verification and final diff review

**Files:**
- No new files.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: the TypeScript check and Vite build complete successfully.

- [ ] **Step 3: Check the diff for unintended changes**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors; only the strike-out implementation, tests, and approved documentation are changed, with unrelated existing user changes preserved.
