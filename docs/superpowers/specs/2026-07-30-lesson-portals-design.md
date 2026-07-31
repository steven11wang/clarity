# Lesson portals design

## Goal

Replace the horizontally scrolling Lessons collection rail with a compact, in-frame portal picker for the four SAT reading-and-writing domains.

## Experience

The Lessons tab opens on four selectable portals: Information, Craft, Expression, and Conventions. Each portal uses its existing domain icon, a large white outline treatment, and the corresponding Clarity accent colour in a dark cobalt glass surface. The currently selected portal has an accessible pressed state and clear visual emphasis.

Selecting a portal retains the current behavior: it reveals that domain's lesson list in the detail area. The existing recommended lesson becomes the default selected domain rather than appearing as a fifth "Continue learning" tile.

## Layout and responsiveness

On wide screens, the four portals render as a single equal-width grid row within the persistent console content width. Cards use a bounded aspect ratio and internal padding so the icon and label always remain inside each card. At narrower widths, the grid wraps to two columns and then one column, with no horizontal scrolling or clipped labels.

## Implementation boundaries

Only `LessonLibrary.tsx`, its existing lesson styles, and the focused DOM tests change. No lesson content, routing, storage, or progress logic changes.

## Verification

Run the focused Lesson Library DOM tests, TypeScript build, and visually inspect the Lessons tab at desktop and mobile widths.
