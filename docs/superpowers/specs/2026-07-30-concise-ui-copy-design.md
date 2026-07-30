# Concise UI Copy Design

## Goal

Reduce redundant wording in navigation and action buttons so controls are easier to scan without changing behavior or instructional meaning.

## Scope

- Change quiz navigation labels from `Previous question` / `Next question` to `Back` / `Next` while retaining directional arrows.
- Change `Lock in & continue` and `Lock in my evidence` to `Continue`.
- Change `Back to all domains` to `Back`.
- Preserve instructional sentences and assessment submission labels where the longer wording communicates a distinct action.

## Implementation

Update the existing JSX text in the adaptive quiz and question interaction components. No state, event-handler, layout, styling, persistence, or scoring changes are required.

## Verification

Run the full test suite and production build. Re-scan source UI copy to confirm the targeted verbose labels no longer appear.
