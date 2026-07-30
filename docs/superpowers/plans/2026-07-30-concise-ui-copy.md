# Concise UI Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shorten redundant navigation and action-button labels while preserving behavior and meaningful instructions.

**Architecture:** Keep the existing React components and handlers unchanged. Replace only visible JSX label text in the adaptive quiz, question interaction, and assessment result components.

**Tech Stack:** React 19, TypeScript, Vite, Node test runner.

## Global Constraints

- Do not change question data, persistence, scoring, navigation behavior, or styling.
- Retain arrows on quiz navigation controls.
- Preserve instructional sentences and assessment submission labels unless they are explicitly listed for shortening.

---

### Task 1: Shorten redundant UI labels

**Files:**
- Modify: `src/components/Adaptive/BatchQuiz.tsx`
- Modify: `src/components/QuestionInteraction/AnswerPass.tsx`
- Modify: `src/components/QuestionInteraction/QuestionInteraction.tsx`
- Modify: `src/components/Adaptive/AssessmentResult.tsx`

**Interfaces:**
- Consumes: Existing button handlers and component props.
- Produces: The same controls and behavior with concise visible labels.

- [ ] **Step 1: Replace the approved labels**

Update only these JSX text nodes:

```tsx
← Previous question  ->  ← Back
Next question →      ->  Next →
Lock in & continue   ->  Continue
Lock in my evidence  ->  Continue
Back to all domains  ->  Back
```

- [ ] **Step 2: Verify the copy scan**

Run: `rg -n -i "previous question|next question|lock in & continue|lock in my evidence|back to all domains" src`

Expected: no matches.

- [ ] **Step 3: Run the full test suite and build**

Run: `npm test`

Expected: exit code 0 with no failed tests.

Run: `npm run build`

Expected: exit code 0 with a successful TypeScript/Vite build.
