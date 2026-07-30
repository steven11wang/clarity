# Choice Strike-Out Design

## Goal

Give students a reversible way to cross out answer choices while working through every question surface.

## Scope

Add strike-out controls to:

- The normal answer pass.
- The multi-question batch quiz.
- The review redo flow.

The feature is UI-only. Strike-out state must not affect answer selection, submitted answers, scoring, persistence, review progression, or diagnosis data.

## Interaction

Each question shows a compact ABC mode toggle in the question header. The toggle starts off for every new question. When activated, circular A–D markers appear beside the answer choices. Clicking a marker toggles that choice between active and struck-out states; clicking it again restores the choice. The marker must be usable by keyboard and touch, and its accessible label must describe the action that will occur (for example, “Strike out choice A” or “Restore choice A”).

Struck choices remain selectable. In review redo, selecting a struck wrong answer continues to use the existing wrong-answer behavior; strike-out is a visual aid rather than a constraint.

## State

Normal answer pass and review redo keep ABC mode and strike-out state local to the mounted question. Batch quiz clears both when the current question changes. Strike-out state is initialized empty and is not included in answer payloads or persisted records.

## Presentation

Use the reference’s compact outlined ABC toggle and circular letter markers. A struck marker shows a thin horizontal line extending through the circle; the answer text is also crossed out while retaining enough contrast and focus treatment to remain readable. Clicking a marker must not trigger the answer-selection handler.

## Testing

Add focused tests for the state transition helper: a choice can be added, removed, and tracked independently from the selected answer. Add DOM coverage for the normal answer pass and batch quiz to verify the control toggles the struck class without changing the selected answer. Verify review redo still submits the selected choice through its existing path. Run the full test suite and production build.

## Non-goals

- Preventing selection of struck choices.
- Changing correctness or scoring logic.
- Persisting strike-outs across questions, sessions, or reloads.
- Adding strike-out controls to passage text or non-answer options.
