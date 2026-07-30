# Shared Console Tab Transitions

## Goal

Make Practice, Library, and Insights feel like views inside one continuous console interface. Switching tabs must preserve the general Home background and feel calm and seamless, similar to moving between top-level areas on a game console.

## Current Problem

Practice renders the new console dashboard, including its dark scene, ambient hero wash, large navigation, settings, and avatar. Library and Insights replace that entire component with older standalone pages. The replacement unmounts the background and header, so navigation feels like loading a different page instead of changing tabs.

## Design

### Persistent shell

Create one top-level console shell for the three primary views:

- Practice
- Library
- Insights

The shell owns the full-height dark background, ambient hero wash, wordmark, top navigation, search control, settings, and avatar. It remains mounted while the active primary view changes.

The background uses the same neutral Home appearance for all three views. Selecting Library or Insights does not reposition, restart, or recolor the ambient background. View-specific content renders in a foreground content region beneath the persistent header.

Practice retains its existing internal selection behavior for areas such as domains, reviews, and trophies. Those selections may continue to adjust the Home hero accent when Practice is active. On Library and Insights, the shell returns to and holds the neutral Home background.

### Navigation behavior

The active navigation label updates immediately on activation. Practice, Library, and Insights use the same buttons and visual selected state in every primary view.

The existing wordmark continues to return to Practice. Search opens Library. Settings and the learner avatar retain their current behavior.

Starting a lesson, assessment, or practice session may still leave the primary shell because those are focused task flows rather than top-level tabs.

### Transition

Only the foreground content region transitions:

- Outgoing content fades and moves approximately 8–12 pixels away.
- Incoming content fades in and settles from approximately 8–12 pixels away.
- The complete transition lasts about 350 milliseconds.
- Easing uses a gentle deceleration curve rather than a sharp UI snap.
- The persistent background and header do not animate out or flash.
- Interaction is protected during the brief handoff so rapid clicks cannot stack conflicting transitions.

Direction may follow navigation order—Practice, Library, Insights—so moving right feels subtly forward and moving left subtly back. The distance stays small enough that the effect reads as calm spatial continuity, not a carousel.

When `prefers-reduced-motion: reduce` is enabled, the translation is removed and the content swaps with either a very short fade or no animation.

### Library and Insights adaptation

Library and Insights keep their existing functionality and data. Their standalone headers and page-level backgrounds are removed because the shared shell supplies those elements.

Their content is restyled only as needed to sit naturally inside the console foreground:

- transparent page roots;
- console-aligned maximum widths and spacing;
- no duplicate wordmark or navigation;
- cards and controls retain accessible contrast against the persistent background.

This work does not redesign Library taxonomy, Insights metrics, or practice-session behavior.

## Architecture

The application owns the active primary view. A shared console shell receives that view, navigation callbacks, and the active foreground content.

The existing Practice dashboard contributes its content and internal selection state to the shell instead of owning the shell itself. Library and Insights become content panels that render inside the same container. Focused flows remain outside this shell and continue using their existing routing behavior.

Transition state is local to the shell. It tracks the displayed panel, requested panel, direction, and entering/exiting phase. The shell keeps the outgoing panel long enough to complete the exit before replacing it, while preventing stale callbacks from winning after a newer navigation request.

## Accessibility

- Navigation exposes the current view with `aria-current="page"`.
- Focus remains on the activated navigation button during the transition.
- The content region has a stable landmark and an accessible label for the active view.
- No information is conveyed by motion alone.
- Reduced-motion preferences are respected.
- Background decoration remains hidden from assistive technology.

## Verification

Automated tests cover:

- one persistent console shell and header across all three primary views;
- correct active navigation state;
- Library and Insights rendering without duplicate headers;
- transition direction based on tab order;
- protection against stale or rapid transition completion;
- reduced-motion behavior where practical.

Manual verification covers:

- no background flash, restart, or position jump;
- calm transitions in both navigation directions;
- working search, settings, avatar, and wordmark;
- responsive layouts on narrow screens;
- readable content and focus behavior during and after transitions.

## Out of Scope

- Rebuilding Library content or information architecture.
- Reworking Insights calculations or charts.
- Applying the ambient tab transition to lessons, assessments, or active practice sessions.
- Adding browser history or URL routing.
