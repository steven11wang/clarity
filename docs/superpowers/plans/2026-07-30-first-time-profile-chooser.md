# First-Time Profile Chooser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the first-time local chooser show only Add User and route that action into the existing sign-up form.

**Architecture:** Keep the existing `SignIn` form as the single sign-up implementation. Add local gate state that switches from the chooser to `SignIn` in sign-up mode, and remove only the hard-coded local Dara card.

**Tech Stack:** React 19, TypeScript, Node test runner, jsdom DOM tests.

## Global Constraints

- Do not change the configured Supabase sign-in/sign-up chooser.
- Do not add profile persistence or database changes.
- Follow the existing DOM-test bundling pattern.

---

### Task 1: Cover the first-time local chooser behavior

**Files:**
- Modify: `src/auth/AuthBoundary.dom.test.tsx`

**Interfaces:**
- Consumes: `AuthBoundary` rendered with Supabase unconfigured.
- Produces: Regression coverage for the local first-time chooser and Add User action.

- [x] **Step 1: Write the failing test**

  Render `AuthBoundary` with `window.sessionStorage` cleared and assert the
  initial document contains `Add User` but not `Dara`. Click the Add User
  button and assert the existing `Create your account.` heading appears.

- [x] **Step 2: Run the DOM test to verify it fails**

  Run: `npm test -- --test-name-pattern='first-time local profile chooser'`

  Expected: FAIL because the current local chooser renders Dara and the Add
  User button has no handler.

### Task 2: Reuse the existing sign-up flow

**Files:**
- Modify: `src/auth/AuthBoundary.tsx`

**Interfaces:**
- Consumes: Existing `SignIn` component with `mode` and `showForm` state.
- Produces: Local first-time chooser that transitions to `SignIn` in
  sign-up mode.

- [x] **Step 1: Add local sign-up state**

  Add `showSignUp` state to `LocalProfileGate`, return `<SignIn initialMode="sign-up" />`
  when it is true, and add the click handler to the Add User button.

- [x] **Step 2: Remove the local Dara card**

  Delete the local gate's controller, number, avatar, Dara label, equipment
  text, and options markup. Leave the Add User button and surrounding chooser
  layout intact.

- [x] **Step 3: Allow the existing form to start in sign-up mode**

  Add an optional `initialMode` prop to `SignIn`, initialize its mode state
  from that prop, and keep the default `sign-in` behavior for the configured
  Supabase chooser.

- [x] **Step 4: Run the focused DOM test**

  Run: `npm test -- --test-name-pattern='first-time local profile chooser'`

  Expected: PASS.

### Task 3: Verify the whole change

**Files:**
- Verify: `src/auth/AuthBoundary.tsx`
- Verify: `src/auth/AuthBoundary.dom.test.tsx`

- [x] **Step 1: Run the full test suite**

  Run: `npm test`

  Expected: exit code 0 with no failed tests.

- [x] **Step 2: Run the production build**

  Run: `npm run build`

  Expected: exit code 0 with TypeScript and Vite build success.
