# Remembered Profile Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a learner choose a built-in avatar during account creation and reopen a remembered browser profile without a password by default, with an optional device-only PIN.

**Architecture:** A focused `profileShortcuts` storage module owns profile normalization, selected-avatar definitions, and salted Web Crypto PIN verification. `AuthBoundary` and `SignIn` use it to populate the chooser and persist profiles; the auth context exposes the active profile's PIN controls to Settings. Supabase metadata carries only the display name/avatar, while the local shortcut and PIN are limited to the browser.

**Tech Stack:** React 19, TypeScript, Web Crypto, localStorage, Supabase Auth, Node test runner, jsdom.

## Global Constraints

- A first visit with no saved shortcut shows only Add User.
- Use built-in avatar choices; store their stable ids in Supabase user metadata as `avatar_id`.
- Never store or synchronize a raw PIN. Store a salted verifier only in browser localStorage.
- A shortcut must never bypass a missing or expired Supabase session; in that case prefill the normal sign-in form.
- The PIN is off by default and protects only the device-local shortcut.
- Preserve unrelated dirty files: `src/components/Adaptive/DomainPath.tsx`, its test, and the remove-all-domains docs.

---

## File structure

- `src/auth/profileShortcuts.ts`: browser record schema, avatar catalog, normalization, local persistence, and PIN cryptography.
- `src/auth/profileShortcuts.test.ts`: isolated behavior tests for persisted records and PIN verifier.
- `src/auth/ProfileChooser.tsx`: reusable saved-profile picker, PIN prompt, and Add User action.
- `src/auth/AuthBoundary.tsx`: Supabase/local routing, sign-up avatar picker, and metadata/profile persistence.
- `src/auth/AuthContext.tsx`: active-profile PIN control interface consumed by Settings.
- `src/auth/AuthBoundary.dom.test.tsx`: chooser and sign-up DOM regressions.
- `src/components/Settings/SettingsPopover.tsx`: device-only Profile PIN management UI.
- `src/components/Settings/SettingsPopover.dom.test.tsx`: PIN settings interaction regression coverage.
- `src/console-theme.css`, `src/components/Settings/settings.css`: visual styling for the new controls.

### Task 1: Add safe profile-shortcut storage and PIN verification

**Files:**
- Create: `src/auth/profileShortcuts.ts`
- Create: `src/auth/profileShortcuts.test.ts`

**Interfaces:**
- Produces `AVATARS`, `ProfileShortcut`, `listProfileShortcuts()`, `upsertProfileShortcut(profile)`, `setProfilePin(id, pin)`, `clearProfilePin(id)`, and `verifyProfilePin(profile, pin)`.
- `ProfileShortcut` has `id`, `email`, `displayName`, `avatarId`, and optional `pin: { salt: string; digest: string }`.

- [ ] **Step 1: Write failing storage tests**

```ts
it('normalizes saved shortcuts and falls back to the default avatar', () => {
  localStorage.setItem('clarity-profile-shortcuts', JSON.stringify([
    { id: 'u1', email: 'ada@example.com', displayName: 'Ada', avatarId: 'missing' },
  ]))
  assert.deepEqual(listProfileShortcuts(), [{
    id: 'u1', email: 'ada@example.com', displayName: 'Ada', avatarId: 'orbit',
  }])
})

it('verifies a correct PIN without retaining its raw value', async () => {
  const protectedProfile = await setProfilePin('u1', '2468')
  assert.equal(await verifyProfilePin(protectedProfile, '2468'), true)
  assert.equal(await verifyProfilePin(protectedProfile, '0000'), false)
  assert.doesNotMatch(JSON.stringify(protectedProfile), /2468/)
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --test-name-pattern='normalizes saved shortcuts|verifies a correct PIN'`

Expected: FAIL because the module and exports do not exist.

- [ ] **Step 3: Implement the smallest storage module**

```ts
export const AVATARS = [
  { id: 'orbit', label: 'Orbit', glyph: '◒' },
  { id: 'spark', label: 'Spark', glyph: '✦' },
  { id: 'wave', label: 'Wave', glyph: '≈' },
] as const

export async function verifyProfilePin(profile: ProfileShortcut, pin: string) {
  if (!profile.pin) return true
  return profile.pin.digest === await digest(`${profile.pin.salt}:${pin}`)
}
```

Use `crypto.getRandomValues`, `crypto.subtle.digest('SHA-256', …)`, base64 encoding, JSON parsing guarded by `try/catch`, and a stable `orbit` fallback. Keep records under one versioned localStorage key and replace records by `id`.

- [ ] **Step 4: Run focused tests and then all tests**

Run: `npm test -- --test-name-pattern='normalizes saved shortcuts|verifies a correct PIN' && npm test`

Expected: PASS.

- [ ] **Step 5: Commit the storage layer**

```bash
git add src/auth/profileShortcuts.ts src/auth/profileShortcuts.test.ts
git commit -m "feat: persist profile shortcuts securely"
```

### Task 2: Build the reusable chooser and PIN prompt

**Files:**
- Create: `src/auth/ProfileChooser.tsx`
- Modify: `src/console-theme.css`
- Modify: `src/auth/AuthBoundary.dom.test.tsx`

**Interfaces:**
- Consumes `ProfileShortcut`, `AVATARS`, and `verifyProfilePin` from `profileShortcuts.ts`.
- Produces `ProfileChooser({ profiles, onChoose, onAddUser })`; `onChoose(profile)` is called only after any PIN succeeds.

- [ ] **Step 1: Add failing DOM tests**

```tsx
it('renders a remembered avatar beside Add User and opens it without a PIN', async () => {
  localStorage.setItem('clarity-profile-shortcuts', JSON.stringify([
    { id: 'local-ada', email: 'ada@example.com', displayName: 'Ada', avatarId: 'spark' },
  ]))
  render(<LocalProfileGate>{null}</LocalProfileGate>)
  assert.match(container.textContent ?? '', /Ada/)
  await act(async () => screen.getByRole('button', { name: /Continue as Ada/ }).click())
  assert.match(container.textContent ?? '', /Ada · local profile/)
})

it('does not open a PIN-protected profile after a wrong PIN', async () => {
  // Seed a profile with setProfilePin, click its card, submit 0000, and assert its PIN error.
})
```

- [ ] **Step 2: Run the chooser test pattern and verify it fails**

Run: `npm test -- --test-name-pattern='remembered avatar|wrong PIN'`

Expected: FAIL because `ProfileChooser` and saved-profile rendering are absent.

- [ ] **Step 3: Implement `ProfileChooser`**

Render the existing scanline/mote shell, one labelled avatar card per saved profile, and the existing Add User button. A protected card shows a small PIN dialog with `inputMode="numeric"`, labelled password input, Cancel, and Continue. Announce invalid PINs through `role="alert"`; do not call `onChoose` until verification succeeds.

- [ ] **Step 4: Add chooser styles**

Use the current `.profile-gate__learner` and `.profile-gate__avatar` visual language. Add focused button outlines and a compact high-contrast PIN panel; preserve the reduced-motion behavior.

- [ ] **Step 5: Run focused and full tests**

Run: `npm test -- --test-name-pattern='remembered avatar|wrong PIN' && npm test`

Expected: PASS.

- [ ] **Step 6: Commit the chooser**

```bash
git add src/auth/ProfileChooser.tsx src/auth/AuthBoundary.dom.test.tsx src/console-theme.css
git commit -m "feat: add remembered profile chooser"
```

### Task 3: Capture avatars during signup and sync profile metadata

**Files:**
- Modify: `src/auth/AuthBoundary.tsx`
- Modify: `src/auth/AuthContext.tsx`
- Modify: `src/auth/AuthBoundary.dom.test.tsx`

**Interfaces:**
- Consumes `upsertProfileShortcut`, `listProfileShortcuts`, `AVATARS`, and `ProfileChooser`.
- Extends `AuthProfileContextValue` with `profileId: string | null`, `avatarId: string`, `hasProfilePin: boolean`, `setProfilePin(pin: string): Promise<void>`, and `clearProfilePin(): void`.
- Supabase sign-up sends `data: { display_name, avatar_id }`.

- [ ] **Step 1: Write failing sign-up and local-flow tests**

```tsx
it('requires an avatar choice before creating an account', async () => {
  render(<SignIn initialMode="sign-up" />)
  assert.match(container.textContent ?? '', /Choose your avatar/)
  assert.equal(container.querySelector('button[type="submit"]')?.hasAttribute('disabled'), true)
})

it('creates a local profile after selecting an avatar', async () => {
  // Fill display name, select Spark, submit, then assert a Continue as Ada card appears.
})
```

- [ ] **Step 2: Run the sign-up test pattern and verify it fails**

Run: `npm test -- --test-name-pattern='requires an avatar choice|creates a local profile'`

Expected: FAIL because the form has no avatar picker and local sign-up does not create a profile.

- [ ] **Step 3: Implement avatar selection and profile persistence**

Add an accessible avatar radio group to sign-up. On configured signup, put `avatar_id` in the Supabase metadata; once `AuthBoundary` has a user, upsert the local shortcut from `user.id`, email, display name, and metadata avatar. On local signup, validate the same form, create a `local-<email>` record, select it, and render children through `AuthProfileProvider`. Replace duplicated chooser markup with `ProfileChooser`. When a saved configured profile has no valid session, show sign-in with its email prefilled instead of treating the shortcut as authenticated.

- [ ] **Step 4: Run focused and full tests**

Run: `npm test -- --test-name-pattern='requires an avatar choice|creates a local profile' && npm test`

Expected: PASS.

- [ ] **Step 5: Commit authentication integration**

```bash
git add src/auth/AuthBoundary.tsx src/auth/AuthContext.tsx src/auth/AuthBoundary.dom.test.tsx
git commit -m "feat: save account avatars as profile shortcuts"
```

### Task 4: Add device-only PIN controls to Settings

**Files:**
- Modify: `src/components/Settings/SettingsPopover.tsx`
- Create: `src/components/Settings/SettingsPopover.dom.test.tsx`
- Modify: `src/components/Settings/settings.css`

**Interfaces:**
- Consumes active-profile PIN methods and state from `useAuthProfile()`.
- Produces Settings UI that enables, changes, and disables a local PIN.

- [ ] **Step 1: Write a failing Settings DOM test**

```tsx
it('enables and removes a device-only profile PIN', async () => {
  render(<SettingsPopover onScoreUpdate={() => {}} />)
  await act(async () => screen.getByRole('button', { name: 'Settings' }).click())
  await act(async () => screen.getByRole('button', { name: /Set profile PIN/ }).click())
  // Enter 2468 twice, save, assert “PIN enabled”; then disable and assert “No PIN”.
})
```

- [ ] **Step 2: Run the Settings test and verify it fails**

Run: `npm test -- --test-name-pattern='enables and removes a device-only profile PIN'`

Expected: FAIL because Profile PIN controls do not exist.

- [ ] **Step 3: Implement the Settings controls**

Add a button row labelled `Profile PIN` below Profile. It opens an inline form with new-PIN and confirmation password inputs. Reject empty/mismatched PINs with `role="alert"`; call `setProfilePin` only after validation. When enabled, offer Change PIN and Remove PIN; removal calls `clearProfilePin`. Explain “This PIN stays on this device.”

- [ ] **Step 4: Style the inline PIN controls**

Extend the current settings panel styles with compact fields and destructive-style remove action that matches existing sign-out treatment.

- [ ] **Step 5: Run focused and full tests**

Run: `npm test -- --test-name-pattern='enables and removes a device-only profile PIN' && npm test`

Expected: PASS.

- [ ] **Step 6: Commit Settings support**

```bash
git add src/components/Settings/SettingsPopover.tsx src/components/Settings/SettingsPopover.dom.test.tsx src/components/Settings/settings.css
git commit -m "feat: add optional device profile PIN"
```

### Task 5: Verify the complete feature

**Files:**
- Verify: all files listed above

- [ ] **Step 1: Run all automated tests**

Run: `npm test`

Expected: exit code 0 with no failed test files.

- [ ] **Step 2: Produce a production build**

Run: `npm run build`

Expected: exit code 0 with TypeScript, Vite, and Sites build steps succeeding.

- [ ] **Step 3: Review the working tree**

Run: `git status --short && git diff --check`

Expected: only profile-shortcut changes since the latest commit; retain the pre-existing DomainPath changes untouched.
