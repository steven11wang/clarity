# First-Time Profile Chooser Design

## Goal

When Clarity is running without Supabase and has no active local profile, the
chooser should show only the Add User circle. Clicking it should open the
existing account-creation form.

## Design

Reuse the existing `SignIn` component and its `showForm`/`mode` state pattern.
`LocalProfileGate` will own a small `showSignUp` state. While false, it renders
the existing chooser shell with only the Add User button. While true, it
renders `SignIn` configured for sign-up mode. The hard-coded local Dara card is
removed; the authenticated Supabase chooser remains unchanged.

## Testing

Add a DOM regression test for the local gate: the initial screen contains Add
User and no Dara text, and activating Add User displays the existing
“Create your account.” heading.
