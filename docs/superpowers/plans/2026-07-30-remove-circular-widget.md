# Remove Circular Dashboard Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the circular “days” widget from the adaptive dashboard.

**Architecture:** Delete the widget span from `ProgressDashboard.tsx` and remove the `.console-days` rules from `console-theme.css`. No data or component interfaces change.

**Tech Stack:** React, TypeScript, CSS, Vitest/Vite.

## Global Constraints

- Preserve all surrounding dashboard content and behavior.
- Do not modify unrelated user changes already present in the working tree.
- Verify with the existing tests and production build.

---

### Task 1: Remove the circular widget

**Files:**
- Modify: `src/components/Adaptive/ProgressDashboard.tsx:413`
- Modify: `src/console-theme.css:618-632`

**Interfaces:**
- Consumes: Existing dashboard card data and layout.
- Produces: The same dashboard without the `console-days` element or its unused styles.

- [ ] **Step 1: Confirm the target markup and styles**

Run: `sed -n '400,425p' src/components/Adaptive/ProgressDashboard.tsx && sed -n '618,635p' src/console-theme.css`

Expected: The output contains the `console-days` span and its CSS rules.

- [ ] **Step 2: Remove only the widget markup and widget-only CSS**

Delete the `<span className="console-days">…</span>` element and the `.console-days`, `.console-days::before`, and `.console-days b, .console-days small` rules. Leave the surrounding session widget intact.

- [ ] **Step 3: Run focused verification**

Run: `npm test -- --run`

Expected: The existing test suite exits successfully with zero failures.

- [ ] **Step 4: Run the production build**

Run: `npm run build`

Expected: Vite completes successfully with exit code 0.

- [ ] **Step 5: Inspect the final diff**

Run: `git diff -- src/components/Adaptive/ProgressDashboard.tsx src/console-theme.css`

Expected: The diff contains only removal of the circular widget markup and its widget-only CSS.
