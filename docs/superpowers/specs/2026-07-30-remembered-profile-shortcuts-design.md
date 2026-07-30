# Remembered Profile Shortcuts Design

## Goal

Keep the first-visit chooser intentionally simple: it displays only **Add
User**. After a learner creates an account, their browser shows a clickable
avatar shortcut beside Add User. The shortcut opens Clarity without asking for
their password again while the authenticated browser session remains valid.

## Scope and constraints

- Users choose one built-in avatar while creating an account.
- Avatar and display name are stored in Supabase user metadata, so they follow
  the account after the person signs in on another device.
- The chooser's remembered shortcut is a browser-specific convenience. A
  different browser does not know which accounts belong to the person before
  they authenticate.
- Supabase remains the authority for account authentication. If its session is
  cleared or expires, the shortcut opens the sign-in form with the saved email
  prefilled; it cannot authenticate an account by itself.
- A device-only PIN is optional and off by default. It protects the shortcut
  only; it is not synced to Supabase or used as an account password.

## Components and data flow

### Profile storage

Add a small profile-shortcut module that reads and writes a versioned
`localStorage` record containing the account id, email, display name, selected
avatar id, and optional PIN verifier. The verifier is a salted Web Crypto
digest, not the raw PIN. It provides helpers to create/update a record, list
the saved profiles, determine whether a PIN is enabled, and verify or replace
the PIN.

### Account creation and authentication

The sign-up form gains a required built-in avatar selection. Its selected
avatar id is included in Supabase `user_metadata` with the display name. When
an authenticated Supabase user reaches the app, `AuthBoundary` writes or
refreshes that browser's shortcut record using the user metadata. The local
development sign-up flow writes an equivalent local profile record so the same
chooser can be exercised without Supabase.

### Profile chooser

The existing chooser shell renders one saved profile card per local shortcut,
then Add User. A card displays the saved avatar and name. Selecting it:

1. opens the dashboard immediately for the current valid account/session;
2. requests the local PIN first when that profile has PIN protection; or
3. opens the existing sign-in form with its saved email populated when no
   matching valid session exists.

First visits with no shortcut records show Add User alone.

### Settings

The Settings popover receives a **Profile PIN** row for a saved profile. It
lets the learner enable or change a numeric local PIN, disable it, and reports
the current state. PIN inputs do not display their values. Because the setting
is device-only, the UI labels it accordingly.

## Error handling and accessibility

- LocalStorage and Web Crypto failures leave the authenticated app usable and
  show an inline non-blocking error where a shortcut or PIN cannot be saved.
- An incorrect PIN stays on the picker, announces an error, and does not open
  the dashboard.
- Avatar choices use labeled buttons with clear selected state. PIN forms use
  password inputs, usable labels, and focusable submit/cancel controls.
- Unknown or stale avatar ids fall back to a stable default avatar.

## Testing

- Unit tests cover shortcut record normalization, PIN hashing/verification,
  invalid/stale records, and the default no-PIN path.
- DOM tests cover first visit (Add User only), saved card rendering, avatar
  choice in sign-up, saved-email handoff, PIN prompt/incorrect PIN, and a
  successful PIN release.
- A Settings DOM test verifies that PIN protection can be enabled and removed.
- Run the full test suite and production build after implementation.
