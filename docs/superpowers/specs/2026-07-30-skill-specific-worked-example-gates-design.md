# Skill-specific worked-example gates

## Goal

Make the scratchpad shown before a worked example's answer choices describe the
reasoning move for the current SAT Reading & Writing skill, rather than always
asking the student to write a test phrase.

## Root cause

`WorkedExample` in `src/components/Lesson/SkillLesson.tsx` hard-codes its
title, instruction, accessible label, and submitted-value label for the
Command of Evidence workflow. It receives only `oneMove`, which it uses solely
to infer an input placeholder. This leaves other skills with inaccurate
directions.

## Design

Add a small, typed worked-example gate configuration keyed by lesson skill.
Each configuration has five strings:

- `label`: the scratchpad heading.
- `hint`: the instruction under the heading.
- `placeholder`: a skill-specific example of the student response.
- `phraseLabel`: what to call the response after the choices are revealed.
- `inputLabel`: the accessible label for the text field.

The existing interaction remains the same: choices are hidden until the
student selects Show the choices or Skip this step; a non-empty response is
repeated after the gate opens; choice strike-through and answer feedback are
unchanged.

Configurations will use the user-provided examples for all skills:

- Command of Evidence: Write your test phrase / test phrase.
- Central Ideas and Details: Your one-sentence summary / summary.
- Inferences: Predict the ending / prediction.
- Words in Context: Your own word for the blank / prediction.
- Text Structure and Purpose: Describe the shape / description.
- Cross-Text Connections: Label both texts / pair of labels.
- Transitions: Name the relationship / note.
- Rhetorical Synthesis: State the requirement / requirement.
- Form, Structure, and Sense: What rule is being tested? / diagnosis.
- Boundaries: Is each side a full sentence? / check.

Command of Evidence has one shared lesson skill for textual and quantitative
examples, so it will retain the provided test-phrase framing. Its placeholder
continues to use the summary's quoted `oneMove` specimen when available,
preserving the current content-driven behavior.

If a future lesson has no configuration, the component will fall back to the
current generic test-phrase copy so the gate remains usable instead of failing
to render.

## Testing

Extend the real DOM lesson test to render more than one skill. It will assert
that Command of Evidence keeps its test-phrase instructions and that a
different skill, Rhetorical Synthesis, renders its requirement-specific
heading, helper text, placeholder, accessible input name, and post-gate echo.
The existing tests continue to cover locked choices, skipping, strike-out, and
grading.

## Scope

No visual styling, lesson content JSON, answer logic, storage, or navigation
changes are needed.
