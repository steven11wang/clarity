# Answer Choice Review Design

## Goal

When a student reaches the evidence-grade step after missing a question, show all four answer choices and make the two important answers explicit: the original wrong choice and the correct choice.

## Current gap

The self-grade step already shows an answer-choice comparison. The later evidence-grade step shows only the rationale and evidence prompt, even though it has access to the same question and first-pass answer data.

## Design

- Extract the existing answer-choice comparison into a shared presentation component.
- Render it in both the self-grade and evidence-grade steps.
- In evidence-grade, place the comparison below the rationale/highlight note and above the evidence self-grade prompt.
- Keep the choices in the existing displayed A–D order, including any review reshuffle.
- Mark the correct choice with a green treatment and “Correct answer.”
- Mark the original first-pass choice with a red treatment and “Your answer” when it was incorrect.
- When the student timed out without selecting an answer, show the correct marker only.
- Preserve the existing explanation and evidence-grading interactions.

## Testing

Add a regression test for the answer-comparison status logic so the correct choice and original wrong choice are both identified, while timed-out attempts do not produce a false “Your answer” marker. Run the full test suite and production build.

## Scope

This change is limited to the review interaction component, its answer-comparison styling, and focused tests. No changes are needed to question data, persistence, scoring, or review progression.
