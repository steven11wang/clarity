# Avatar account menu and account pages

## Goal

Turn the green top-right learner control into the single account entry point.
Its dropdown provides Profile, Trophies, and Sign out or Switch profile.
Profile and Trophies open dedicated console pages with smooth transitions.

## Current structure

`ProgressDashboard` owns the console header, primary content, existing
crossfade/slide transition, settings trigger, and green learner control.
`AuthBoundary` owns authenticated and local-profile identity, avatar
persistence, remote sign-out, and returning a local learner to the profile
chooser. `SettingsPopover` currently combines account and application
preferences.

The app has no URL router. Primary console views already transition without
discarding the dashboard component, which makes them the appropriate model for
these account destinations.

## Navigation and menu

The green top-right control displays the active avatar glyph instead of a
generic mark. Activating it opens an anchored account dropdown containing:

- A compact identity header with the display name and synced or local status.
- Profile.
- Trophies.
- Sign out for a Supabase-authenticated account.
- Switch profile for a local learner.

Only the action appropriate to the current account type is shown. The dropdown
closes after navigation or account exit, on outside pointer interaction, and
when Escape is pressed. Escape and outside dismissal return keyboard focus to
the trigger. Menu items and the trigger expose accurate accessible labels,
expanded state, and focus-visible treatment.

Profile and Sign out are removed from Settings. Settings retains Score update
and the informational Appearance row.

## Account page navigation

Profile and Trophies are integrated primary console views rather than modals or
new URL routes. They use the existing `PrimaryViewTransition` motion language:
a short crossfade with a subtle horizontal slide. The user's selected dashboard
tile and other dashboard-local state remain intact while an account page is
open. Each page has an explicit back action that returns to the previously
active primary console view.

Motion is disabled under `prefers-reduced-motion`.

## Profile page

The Profile page contains:

- A page title and brief account-status copy.
- A large preview of the selected avatar.
- The three existing avatar choices.
- An editable display-name field.
- Read-only email for synced accounts, or local-profile status for local
  learners.
- Save and Cancel actions.
- Inline validation and save feedback.

Avatar and display-name edits are held as a draft until Save. Cancel and the
page back action discard unsaved edits. A trimmed display name is required and
must not be empty. Save is disabled while unchanged, invalid, or already
saving.

The authentication profile context exposes a single profile-update operation
so the page can save the avatar and display name together. In Supabase mode,
the operation updates `user_metadata`, refreshes local React state, and updates
the remembered profile shortcut. In local mode, it updates the remembered
profile shortcut and selected local profile. A failed remote save leaves the
draft in place and shows a concise inline error.

## Trophies page

The first version is intentionally small and uses existing progression data.
It shows:

- Skills secured.
- Overall mastery percentage.
- A compact achievement area derived from current progress.

No new achievement storage or backend is introduced. When no achievement has
been earned, the page presents an encouraging empty state and a back-to-
practice action rather than an empty panel.

## Components and data flow

A focused account-menu component owns overlay behavior and renders account
actions supplied through props. A focused Profile page owns draft editing and
save feedback. A focused Trophies page receives already-derived progress
summary values; it does not read or mutate progression storage.

`ProgressDashboard` coordinates the current account destination, remembers
the prior console view, derives trophy summary values from its existing domain
cards, and supplies panels to the shared transition component.

`AuthBoundary` remains the sole owner of profile persistence and account exit.
The auth context provides display identity, avatar, account-exit behavior and
label, plus the combined profile update operation. This keeps authentication
and persistence details out of presentation components.

## Responsive behavior

The dropdown remains anchored to the avatar on larger screens and becomes a
viewport-safe fixed panel on narrow screens. Profile controls stack on small
screens, maintain comfortable touch targets, and never force horizontal
scrolling. Long names and emails truncate in the menu but remain available via
accessible text and title attributes.

## Testing

DOM-level tests will verify:

- The avatar trigger opens a menu with Profile, Trophies, and the correct
  account-exit action.
- Settings no longer contains Profile or Sign out.
- Outside interaction and Escape dismiss the menu.
- Profile and Trophies navigate to dedicated views and back without triggering
  score update or account exit.
- Profile validation, Cancel, successful combined save, and failed-save
  feedback.
- Local accounts show Switch profile while remote accounts show Sign out.
- Trophy metrics and the empty state are derived from supplied progress.

CSS/theme tests will cover the transition and reduced-motion contract where
appropriate. Final verification includes the focused tests, full test suite,
TypeScript production build, and manual inspection of desktop and narrow
layouts.

## Scope

This work does not add avatar uploads, password or email changes, shareable
routes, a new router dependency, or a persistent achievement system.
