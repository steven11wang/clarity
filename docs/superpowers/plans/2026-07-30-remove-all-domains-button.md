# Remove All Domains Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the top-right `All domains` button from the domain path header without changing other navigation.

**Architecture:** Delete the existing button element in `DomainPath`; no replacement control or state change is required.

**Tech Stack:** React, TypeScript, existing Node test suite, Vite build.

## Global Constraints

- Modify only the domain path header UI and its directly unused handler usage.
- Preserve all other domain and dashboard navigation.
- Run the full test suite and production build after the edit.

---

### Task 1: Remove the header control

**Files:**
- Modify: `src/components/Adaptive/DomainPath.tsx:78-81`

**Interfaces:**
- Consumes: existing `onBack` prop and header layout.
- Produces: the same domain path header without the `All domains` button.

- [ ] **Step 1: Remove the button element**

Delete the `button.link-button` whose label is `All domains`; leave the wordmark and surrounding header markup unchanged.

- [ ] **Step 2: Verify the source no longer contains the control**

Run: `rg -n "All domains" src/components/Adaptive/DomainPath.tsx`

Expected: no matches.

- [ ] **Step 3: Run automated verification**

Run: `npm test && npm run build`

Expected: both commands exit with status 0.

