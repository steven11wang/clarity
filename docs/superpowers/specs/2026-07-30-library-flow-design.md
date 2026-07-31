# Library flow design

## Goal

Replace the current Library-tab landing view with the provided `Clarity Library.dcv2.html` experience. The Library is a three-step journey: landing, shelf, and question bank. The supplied practice-screen reference becomes the Question Bank destination.

## Scope

### 1. Library landing

- Selecting **Library** from the persistent console opens the landing screen.
- Render the source copy: `SAT READING & WRITING`, `The library is open.`, the supporting description, `ENTER LIBRARY`, and the three summary stats.
- Use the existing console shell/header and dark blue visual language so the new view remains consistent with Clarity’s navigation and account controls.

### 2. Shelf

- `ENTER LIBRARY` opens `Your library`; its Back control returns to the landing screen.
- Render the three content-volume placeholders from the supplied HTML: Master’s note, Beginner’s guide, and Resources. Selecting a volume shows its metadata and opens an overlay with the provided “Pages coming soon” state.
- Render Notebook as a separate personal placeholder, consistent with the supplied HTML. It will initially use a local, in-browser note field only; uploaded book content and durable note syncing are explicitly out of scope.
- Render a Question Bank (Vault) card with the current loaded-question count and an unlock interaction. Once open, its primary action opens the question bank.

### 3. Question Bank

- The Question Bank uses the existing `Browse` practice interface—the supplied `Practice with intention.` reference—including mix, timed mode, and Easy / Medium / Hard practice actions.
- A Back-to-library action returns to the shelf without losing the learner’s existing question, review, timing, or progress state.
- The user’s later uploads will replace the placeholder volume content; they will not require changes to the Question Bank’s session behavior.

## Architecture

- Add a focused Library component responsible only for internal Library screen state (`landing`, `shelf`, `question-bank`) and selected shelf item.
- Keep session starting in `App.tsx`; pass the already-loaded questions and existing timing/session callbacks down to the Library. The Library must not duplicate stream construction or persistence logic.
- Replace the current `Browse` value passed as `libraryPanel` in `App.tsx` with the new Library component. Continue rendering `Browse` inside the Library only for the Question Bank screen.
- Keep styling isolated to a Library stylesheet or clearly prefixed Library rules to avoid altering Lessons, Practice, or Insights.

## Interaction and empty states

- Book controls are keyboard-operable and provide descriptive labels.
- The selected shelf volume is visually distinguished before opening.
- The Question Bank count comes from `questions.length`; copy remains sensible at zero questions.
- The question bank unlock is visual gating only. It does not restrict use based on learner performance.

## Verification

- DOM tests cover Library defaults, entering/leaving the shelf, opening a placeholder volume, unlocking/opening the Question Bank, and returning to the shelf.
- Existing Browse behavior remains covered by the app’s build and test suite.
- Run the complete test command and production build after implementation.

## Non-goals

- Loading, parsing, or publishing uploaded book content.
- Cloud persistence or cross-device syncing for the Notebook.
- Changing the question format, scoring, review scheduling, or practice-session engine.
