# Library Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the supplied Library landing and shelf, and route its Question Bank into Clarity’s existing practice browser.

**Architecture:** A new `Library` component owns only Library-local navigation, shelf selection, and the visual vault unlock. `App` keeps ownership of loaded questions, timing controls, and session startup; it passes those callbacks into the new component. `Browse` remains the Question Bank screen and therefore retains all current practice behavior.

**Tech Stack:** React 19, TypeScript, CSS, JSDOM DOM tests, Node test runner, Vite.

## Global Constraints

- Use `/Users/s/Downloads/Clarity Library.dcv2.html` as the visual and copy source for the landing and shelf.
- Keep the existing question format, scoring, review scheduling, and session engine unchanged.
- Question Bank count is `questions.length`; the vault unlock is visual only.
- Book content remains a local “Pages coming soon” placeholder until the user supplies it.
- Notebook content remains in-memory for this iteration; do not add sync or storage schema changes.

---

### Task 1: Library component test contract

**Files:**
- Create: `src/components/Library/Library.dom.test.tsx`
- Create: `src/components/Library/Library.tsx`
- Create: `src/components/Library/library.css`

**Interfaces:**
- Consumes: `Question` from `src/types.ts` and existing Browse callbacks.
- Produces: `Library`, accepting `questions`, `dueCount`, `timedMode`, `timeLimitSec`, `onToggleTimed`, `onChangeLimit`, `onStart`, and `onOpenDashboard`.

- [ ] **Step 1: Write the failing test**

```ts
it('opens the shelf from the Library landing', async () => {
  assert.match(container.textContent ?? '', /The library is open/)
  await click(buttonByText('ENTER LIBRARY'))
  assert.match(container.textContent ?? '', /Your library/)
  assert.match(container.textContent ?? '', /Question bank/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/Library/Library.dom.test.tsx`

Expected: FAIL because the Library component and DOM test entry do not exist.

- [ ] **Step 3: Write minimal implementation**

```tsx
type LibraryScreen = 'landing' | 'shelf' | 'question-bank'

export function Library(props: LibraryProps) {
  const [screen, setScreen] = useState<LibraryScreen>('landing')
  if (screen === 'question-bank') return <QuestionBank {...props} onBack={() => setScreen('shelf')} />
  return screen === 'landing'
    ? <LibraryLanding onEnter={() => setScreen('shelf')} questionCount={props.questions.length} />
    : <LibraryShelf onBack={() => setScreen('landing')} onOpenQuestionBank={() => setScreen('question-bank')} questionCount={props.questions.length} />
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/Library/Library.dom.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Library/Library.tsx src/components/Library/Library.dom.test.tsx src/components/Library/library.css
git commit -m "feat: add library landing and shelf"
```

### Task 2: Shelf interactions and Question Bank test contract

**Files:**
- Modify: `src/components/Library/Library.dom.test.tsx`
- Modify: `src/components/Library/Library.tsx`
- Modify: `src/components/Library/library.css`

**Interfaces:**
- Consumes: Task 1 `Library` screen state and `onStart(questions: Question[])` callback.
- Produces: interactive shelf volume overlay, local Notebook field, vault unlock, Question Bank entry, and return-to-shelf behavior.

- [ ] **Step 1: Write the failing tests**

```ts
it('opens a placeholder volume from the shelf', async () => {
  await enterShelf()
  await click(buttonByText("Master's note"))
  assert.match(container.textContent ?? '', /Pages coming soon/)
})

it('unlocks and opens the Question Bank', async () => {
  await enterShelf()
  await click(buttonByText('TURN THE DIAL'))
  await click(buttonByText('START A SET'))
  assert.match(container.textContent ?? '', /Practice with intention/)
  await click(buttonByText('Back to library'))
  assert.match(container.textContent ?? '', /Your library/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/Library/Library.dom.test.tsx`

Expected: FAIL because volume overlay, vault state, and Question Bank navigation are not implemented.

- [ ] **Step 3: Write minimal implementation**

```tsx
const [vaultOpen, setVaultOpen] = useState(false)
const [openBook, setOpenBook] = useState<LibraryBook | null>(null)

<button type="button" onClick={() => setVaultOpen((open) => !open)}>
  {vaultOpen ? 'START A SET' : 'TURN THE DIAL'}
</button>
{vaultOpen && <button type="button" onClick={onOpenQuestionBank}>START A SET</button>}
{openBook && <BookOverlay book={openBook} onClose={() => setOpenBook(null)} />}
```

Implement `QuestionBank` as a compact Back-to-library control followed by the existing `Browse` component, passing all existing question/timing callbacks through unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/Library/Library.dom.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Library/Library.tsx src/components/Library/Library.dom.test.tsx src/components/Library/library.css
git commit -m "feat: connect library vault to question bank"
```

### Task 3: Integrate Library into the primary console

**Files:**
- Modify: `src/App.tsx:19-30,319-333`
- Test: `src/components/Library/Library.dom.test.tsx`

**Interfaces:**
- Consumes: Task 2 `Library` and the pre-existing `questions`, timing state, and `startSession` callback from `App`.
- Produces: the Library tab renders the new Library experience instead of a bare Browse component.

- [ ] **Step 1: Write the failing integration assertion**

```ts
it('renders the source landing headline by default', () => {
  assert.match(container.textContent ?? '', /The library is open/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/Library/Library.dom.test.tsx`

Expected: FAIL before `App` imports and supplies the new Library component.

- [ ] **Step 3: Write minimal integration**

```tsx
libraryPanel={(
  <Library
    questions={questions}
    dueCount={dueNow}
    timedMode={timedMode}
    timeLimitSec={timeLimitSec}
    onToggleTimed={toggleTimed}
    onChangeLimit={changeLimit}
    onStart={startSession}
    onOpenDashboard={() => setView('adaptive')}
  />
)}
```

- [ ] **Step 4: Run test and production build**

Run: `npm test && npm run build`

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/Library
git commit -m "feat: open library flow from console tab"
```

## Plan self-review

- Spec coverage: Tasks 1 and 2 cover the landing, shelf, volume placeholders, Notebook, visual vault, Question Bank, count, and back navigation. Task 3 wires the completed flow into the persistent Library tab. Existing Browse preserves session behavior.
- Placeholder scan: no unresolved requirements or implementation placeholders remain; “Pages coming soon” is intentional user-facing product copy.
- Type consistency: every callback supplied by `App` matches `Browse`’s existing callback types and is forwarded unchanged by `Library`.
