# Score Update and Sign-in Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route Score update to the existing upload page and route the green learner control to the existing profile/sign-in entry flow.

**Architecture:** Keep Score update as the existing `onUpdateScore` callback into `AdaptiveExperience`. Add an explicit `openAccount` action to the auth profile context; the configured auth boundary signs out to the sign-in page, while the local profile gate clears the active profile and returns to its chooser. Make `ProgressDashboard` call `openAccount` only from the green learner control.

**Tech Stack:** React 19, TypeScript, Node test runner, jsdom DOM tests, Vite.

## Global Constraints

- Do not change score parsing, score confirmation semantics, account persistence, visual styling, or unrelated dashboard navigation.
- Score update must continue to use the existing onboarding/upload experience.
- The green top-right control and Score update must have distinct destinations.

---

### Task 1: Add failing navigation regression coverage

**Files:**
- Create: `src/components/Adaptive/accountNavigation.dom.test.tsx`
- Modify: `src/auth/AuthContext.tsx` only if the test needs the new context contract

**Interfaces:**
- Consumes: `ProgressDashboard`, `AuthProfileProvider`, and the existing callback props.
- Produces: A DOM regression test proving the green control invokes account entry while Score update invokes score update.

- [ ] **Step 1: Write the failing test**

Render `ProgressDashboard` with one valid domain card, no-op panel content, and provider values containing an `openAccount` spy. Locate the top-right button by its existing `aria-label="Update learner profile"`, click it, and assert the account callback ran once. Locate the settings popover’s `Score update` button, click it, and assert the score-update callback ran once while the account callback count remains unchanged.

- [ ] **Step 2: Run the focused DOM test**

Run: `node tools/build-dom-tests.mjs && node --test tools/dom-tests/components-Adaptive-accountNavigation.test.mjs`

Expected: FAIL because the auth context has no account-entry action and the learner control still invokes `onUpdateScore`.

---

### Task 2: Add the explicit account-entry action

**Files:**
- Modify: `src/auth/AuthContext.tsx`
- Modify: `src/auth/AuthBoundary.tsx`

**Interfaces:**
- Consumes: Existing Supabase sign-out behavior and local profile selection state.
- Produces: `useAuthProfile().openAccount(): void` for authenticated dashboard controls.

- [ ] **Step 1: Extend the context contract**

Add `openAccount: () => void` to `AuthProfileContextValue` and give the fallback a no-op implementation.

- [ ] **Step 2: Wire configured auth**

In the authenticated `AuthProfileProvider` value, set `openAccount` to a function that invokes the existing Supabase sign-out operation.

- [ ] **Step 3: Wire local profile entry**

In `LocalProfileGate`, define an `openAccount` callback that clears `clarity-active-profile` from session storage and sets `selected` to false. Pass it through `AuthProfileProvider`.

- [ ] **Step 4: Run type-checking**

Run: `npx tsc -b`

Expected: PASS with the new required context property supplied everywhere.

---

### Task 3: Route the green learner control separately from Score update

**Files:**
- Modify: `src/components/Adaptive/ProgressDashboard.tsx`
- Test: `src/components/Adaptive/accountNavigation.dom.test.tsx`

**Interfaces:**
- Consumes: `useAuthProfile().openAccount` and existing `onUpdateScore`.
- Produces: Green learner control opens account entry; Settings → Score update continues to call `onUpdateScore`.

- [ ] **Step 1: Read the auth action in the dashboard**

Import `useAuthProfile` and read `openAccount` inside `ProgressDashboard`.

- [ ] **Step 2: Change only the learner control handler**

Keep `<SettingsPopover onScoreUpdate={onUpdateScore} />` unchanged. Change the green `console-avatar` button’s handler to `openAccount`.

- [ ] **Step 3: Run the focused regression test**

Run: `node tools/build-dom-tests.mjs && node --test tools/dom-tests/components-Adaptive-accountNavigation.test.mjs`

Expected: PASS.

---

### Task 4: Verify the full change

**Files:**
- No additional files.

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: PASS with zero failing tests.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: PASS with exit code 0.

- [ ] **Step 3: Review the final diff**

Run: `git diff --check && git diff -- src/auth/AuthContext.tsx src/auth/AuthBoundary.tsx src/components/Adaptive/ProgressDashboard.tsx src/components/Adaptive/accountNavigation.dom.test.tsx`

Expected: Only the explicit account-entry context wiring, the separated dashboard handler, and the focused regression test are present.

