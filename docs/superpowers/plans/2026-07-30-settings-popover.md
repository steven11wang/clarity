# Settings Popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Move the account control out of the bottom-fixed area and make the console gear open an accessible dark settings popover with account, profile, score update, appearance, and sign-out actions.

**Architecture:** Add a small auth/profile context at the auth boundary so the console header can read the current account and invoke sign-out without threading user data through every screen. Keep popover state and interaction behavior in a focused `SettingsPopover` component rendered by `ProgressDashboard`; preserve the existing score-update callback and styling tokens.

**Tech Stack:** React 19, TypeScript, CSS, existing Node test runner, Vite.

## Global Constraints

- Keep the current dark console theme; Appearance is informational as `Dark mode` for now.
- Do not add a light theme, new account-management backend flows, or a separate settings page.
- Preserve existing score-update and Supabase sign-out behavior.
- Long emails must truncate safely and remain available through an accessible label/title.
- The local-profile state must not show a bottom-fixed account chip or a sign-out action.

---

### Task 1: Expose account/profile state through auth context

**Files:**
- Create: `src/auth/AuthContext.tsx`
- Modify: `src/auth/AuthBoundary.tsx`

**Interfaces:**
- Produces `AuthProfileContextValue` with `email: string | null`, `displayName: string`, `isLocal: boolean`, and `signOut: (() => Promise<void>) | null`.
- Produces `useAuthProfile(): AuthProfileContextValue` for authenticated/local content.

- [ ] **Step 1: Add the context contract and hook**

  Define the exported context type, default fallback values, provider, and hook. The hook must return a safe anonymous fallback so auth screens do not throw if rendered outside the provider.

- [ ] **Step 2: Wrap authenticated and local children with the provider**

  In `AuthBoundary`, provide the signed-in email and display name from the Supabase user metadata, set `isLocal: false`, and expose a sign-out function that calls `supabase!.auth.signOut()`. In `LocalProfileGate`, provide `displayName: 'Dara'`, `isLocal: true`, and `signOut: null`.

- [ ] **Step 3: Remove the bottom-fixed account chip render paths**

  Delete the signed-in `.account-chip` and local `.account-chip--local` markup. Keep sync warnings and profile selection behavior unchanged.

- [ ] **Step 4: Type-check the context boundary**

  Run `npx tsc -b --pretty false`.
  Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit the auth boundary change**

  Run `git add src/auth/AuthContext.tsx src/auth/AuthBoundary.tsx && git commit -m "refactor: expose auth profile context"`.

### Task 2: Build the settings popover component

**Files:**
- Create: `src/components/Settings/SettingsPopover.tsx`
- Create: `src/components/Settings/settings.css`

**Interfaces:**
- Consumes `onScoreUpdate: () => void`.
- Reads `useAuthProfile()` for account/profile labels and sign-out.
- Produces an anchored settings button/popover pair with accessible menu semantics.

- [ ] **Step 1: Write interaction tests**

  Add `src/components/Settings/SettingsPopover.test.tsx` covering: closed by default; opens on gear click; displays Account/Profile/Score update/Appearance/Sign out for a signed-in user; invokes score update; invokes sign out; closes on Escape; local profile omits Sign out and displays local profile text.

- [ ] **Step 2: Run the focused test to establish the failure**

  Run `node --experimental-strip-types --experimental-specifier-resolution=node --test src/components/Settings/SettingsPopover.test.tsx`.
  Expected: FAIL because the component and test provider do not yet exist.

- [ ] **Step 3: Implement the minimal popover behavior**

  Use a local `open` state, a ref to the wrapper, a document pointer listener for outside-click close, and an Escape key listener. Render a gear trigger with `aria-expanded`, `aria-controls`, and `aria-label="Settings"`. Render the current account email/profile text, a profile row, a score-update button, an informational dark-mode row, and a conditional sign-out button. Close the popover before invoking score update or sign-out.

- [ ] **Step 4: Add focused glass-console styling**

  Position the wrapper relative to the header action area. Style the popover with existing glass variables, console shadow, cobalt hover states, a separator before sign out, viewport-safe right alignment, and mobile width constraints. Truncate long account text with `title` and `aria-label`.

- [ ] **Step 5: Run the focused test to verify behavior**

  Run the same focused test command.
  Expected: PASS.

- [ ] **Step 6: Commit the component change**

  Run `git add src/components/Settings && git commit -m "feat: add settings popover"`.

### Task 3: Replace the existing gear action in the console header

**Files:**
- Modify: `src/components/Adaptive/ProgressDashboard.tsx`
- Modify: `src/console-theme.css`

**Interfaces:**
- Consumes the existing `onUpdateScore` callback.
- Replaces the current gear button that directly calls `onUpdateScore` with `SettingsPopover onScoreUpdate={onUpdateScore}`.

- [ ] **Step 1: Mount the settings popover in the header**

  Import `SettingsPopover` and replace only the gear button in `.console-header__actions`; leave search and avatar behavior intact unless required for spacing.

- [ ] **Step 2: Remove obsolete account-chip visual rules**

  Remove `.account-chip` from the glass-surface selector and remove the account-chip override rules from `console-theme.css`; leave base selectors only if no markup references remain, otherwise remove the dead account-chip styles from `app.css` too.

- [ ] **Step 3: Verify the dashboard renders the new header action**

  Run `npx tsc -b --pretty false`.
  Expected: PASS with the new component wired into the adaptive dashboard.

- [ ] **Step 4: Commit the integration**

  Run `git add src/components/Adaptive/ProgressDashboard.tsx src/console-theme.css src/app.css && git commit -m "feat: wire settings into console header"`.

### Task 4: Full verification and cleanup

**Files:**
- Modify: only files required by failing verification.

- [ ] **Step 1: Run the full test suite**

  Run `npm test`.
  Expected: PASS.

- [ ] **Step 2: Build the production app**

  Run `npm run build`.
  Expected: PASS with a generated production build.

- [ ] **Step 3: Review the final diff for scope and dead styles**

  Run `git diff HEAD~3 --stat` and `rg -n "account-chip|SettingsPopover" src`.
  Confirm there is no rendered bottom account chip, the settings component is used once, and no unrelated user changes were overwritten.

- [ ] **Step 4: Commit any verification-only fixes**

  If verification requires a source correction, run `git add <corrected files> && git commit -m "fix: verify settings popover integration"`; otherwise leave the three feature commits intact.
