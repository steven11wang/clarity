# Persistent Lessons Console Design

## Goal

Make Lessons feel like a native fourth console tab. Moving between Practice,
Lessons, Library, and Insights keeps the same background and header mounted,
uses the existing calm primary-view transition, and never feels like opening a
separate page.

The redesign covers both the lesson library and the individual lesson reader.
It builds on the existing console theme and lesson content rather than changing
the curriculum or progression rules.

## Primary Navigation and Motion

- Add `lessons` to the primary console view model between `practice` and
  `library`.
- The main header marks Lessons as active with the same visual treatment used
  by the other primary tabs.
- Entering or leaving Lessons uses the existing 350ms directional crossfade and
  small horizontal drift.
- The console background, wash, header, settings, and audio remain mounted
  throughout primary navigation.
- Reduced-motion users receive the existing no-motion fallback.
- Rapid tab changes settle on the latest selected tab.

## Lessons Landing View

The landing view is a console panel, not a standalone `adaptive-shell` page.

### Rail

- The first, selected tile is **Continue learning**. It points to the first
  sensible lesson: the learner's current recommended skill when available,
  otherwise the first lesson in the index.
- Four SAT domain tiles follow in the same horizontal, large-tile language as
  the Practice rail.
- Each domain tile uses the established domain accent and a real icon from the
  app's existing icon set.
- Selecting a tile changes the detail region below with a short, calm content
  handoff. It does not navigate away from Lessons.

### Detail Region

- Continue learning shows the lesson title, a concise explanation, and a clear
  primary action.
- A selected domain shows its lessons in a roomy console list with the skill
  name, short summary, and completion/read state when known.
- Lists remain keyboard accessible and become a single column on narrow
  screens.

## Individual Lesson Reader

Opening a lesson replaces the Lessons landing content inside the persistent
console shell; the global header and background remain visible.

- The reader begins with a compact breadcrumb/back action to return to all
  lessons.
- The lesson title, short summary, and progress through the four sections sit
  above the content.
- Existing sections remain: Lesson, Worked example, Tips, and Practice.
- Section navigation uses a console-style segmented rail with a clear active
  state, rather than a conventional document tab bar.
- Reading content sits on a restrained translucent surface with less “card”
  framing, larger breathing room, and the console's cobalt focus/accent
  language.
- Previous/next controls remain visible but are visually integrated into the
  panel. Finishing returns to the correct origin or begins the gated mini quiz,
  preserving the current behavior.
- Loading and unavailable states use the same reader shell so the scene does
  not jump.

## State and Boundaries

- `AdaptiveExperience` continues to own lesson selection, first-read gating,
  and return destinations.
- `ProgressDashboard` owns the persistent shell and receives a Lessons panel in
  the same way it receives Library and Insights panels.
- `LessonLibrary` becomes an embeddable console panel and owns its local rail
  selection.
- `SkillLesson` gains an embedded presentation mode while retaining its
  existing learning flow and callbacks.
- No lesson content, storage schema, scoring behavior, or question selection
  changes are in scope.

## Accessibility and Responsive Behavior

- Active primary navigation and lesson-section navigation expose
  `aria-current` or selected tab semantics.
- Lesson tiles and rows remain native buttons with visible keyboard focus.
- Exiting content is hidden from assistive technology during transitions.
- At compact widths, the primary nav and lesson rail can scroll horizontally;
  reader content and actions stack without clipping.
- Reduced-motion preferences remove movement while retaining an immediate
  state change.

## Verification

- Unit tests cover four-view direction ordering.
- DOM tests confirm Lessons participates in the shared transition and does not
  mount a second console header/background.
- Lesson DOM tests confirm the landing rail, domain filtering, embedded reader,
  and unchanged four-section learning flow.
- The full test suite and production build must pass.
- Browser QA checks desktop and compact layouts, rapid tab switching, the
  Lessons landing state, opening and exiting a lesson, focus states, and the
  reduced-motion fallback.

