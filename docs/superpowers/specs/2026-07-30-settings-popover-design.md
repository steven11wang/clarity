# Settings Popover Design

## Goal

Move the signed-in account control out of the bottom-fixed area and make the
console gear button open a useful settings menu that can grow later.

## User experience

The gear button in the console header toggles a dark glass popover anchored to
the top-right actions area. The popover closes when the user clicks outside it
or presses Escape. It is keyboard reachable, has an accessible name, and keeps
focus-visible styling consistent with the rest of the console.

The menu contains:

- Account: shows the current signed-in email, or the local profile label when
  Supabase is not configured.
- Profile: shows the current learner identity/status using the profile data
  already present in the app.
- Score update: preserves the existing score-report action.
- Appearance: displays `Dark mode` as the active appearance. It is intentionally
  informational/non-switchable for now so the menu can support future themes
  without changing its structure.
- Sign out: preserves the current Supabase sign-out behavior. Local mode has no
  sign-out action because it is device-local.

The existing bottom-fixed `.account-chip` is removed from the signed-in and
local-profile layouts. The account identity is represented inside the settings
popover instead.

## Component and data flow

`ProgressDashboard` owns the gear button and the open/closed state for the
popover because that header is where the interaction lives. It receives
callbacks for score update and sign out/profile actions through the existing
component boundary rather than introducing global state.

`AuthBoundary` remains responsible for knowing the authenticated user and for
signing out. It supplies the account/profile presentation to the application
shell through the existing composition boundary. Local profile mode supplies
the same shape with its local-profile status.

The implementation should use a small reusable settings menu component or a
focused header menu section, keeping the overlay behavior isolated from the
practice/dashboard data logic.

## Visual design

Use the existing Cobalt console tokens: glass surface, glass border, blur,
console shadow, cobalt hover/active states, and the existing dark background.
The popover should be wide enough for the email without forcing overflow,
remain within the viewport on mobile, and visually group informational rows
from the sign-out action.

## Error handling and edge cases

- If there is no email, show the local profile label instead of an empty row.
- Long emails must truncate safely while remaining available through a title or
  accessible label.
- The menu must not cover the primary mobile navigation in an unusable way.
- Repeated clicks on the gear must only toggle the menu; no duplicate overlays
  should be created.
- Existing score-update and sign-out behavior must remain unchanged.

## Verification

- Type-check and build the app.
- Run the existing test suite.
- Verify the popover opens/closes with mouse and keyboard.
- Verify signed-in and local-profile states do not render a bottom-fixed account
  chip.
- Verify Score update and Sign out still invoke their existing behavior.
- Verify mobile layout and long email truncation.

## Scope

This change does not add a light theme, new account-management backend flows,
or a separate settings page. Those can be added later behind the existing menu
structure.
