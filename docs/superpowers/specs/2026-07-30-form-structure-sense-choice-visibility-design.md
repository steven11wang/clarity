# Form, Structure, and Sense Choice Visibility

## Goal

Make the answer choices visible immediately in the worked example for the
`Form, Structure, and Sense` lesson. The choices are needed while the learner
answers that lesson's rule-identification prompt.

## Scope

- Only the `Form, Structure, and Sense` worked example bypasses the choice gate.
- Its scratchpad prompt, input, and “Show the choices”/“Skip this step” controls
  are hidden on initial render.
- Choice selection, strikeout, answer checking, explanation reveal, and reset
  behavior remain unchanged.
- All other lessons retain the current gated and blurred choice behavior.

## Implementation

Add a narrow `showChoicesImmediately` condition in the existing
`WorkedExample` component, derived from the lesson skill. Initialize the
choice gate as open for the named skill and render the gate UI only when it is
not an immediate-choice lesson. Do not change lesson content data or the
shared gate copy table.

## Verification

Extend the lesson DOM tests to confirm that `Form, Structure, and Sense` starts
with unlocked choices and no gate prompt. Retain the existing gated-flow test
for another lesson to prove the exception does not broaden to all lessons.
Run the focused lesson DOM tests, then the full project test suite and TypeScript
build.
