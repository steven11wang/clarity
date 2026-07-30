# Remove Circular Dashboard Widget

## Goal

Remove the circular “days” widget from the adaptive dashboard so it no longer appears at the bottom of the screen.

## Scope

- Remove the widget markup from the adaptive dashboard session widget.
- Remove CSS that exists only to render that circular widget.
- Preserve the surrounding dashboard content and layout behavior.
- Verify with the focused test suite and production build.

## Approach

Delete the `console-days` element from `ProgressDashboard.tsx` rather than hiding it with CSS. This keeps the rendered DOM and styles aligned with the requested UI and avoids leaving an inaccessible, unused control in the page.

## Verification

Run the existing automated tests and the production build. Confirm the diff is limited to the widget removal and its unused styles.
