# Reading/Writing Export Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a clean 54-question Reading/Writing Markdown export with complete question content and normalized difficulty labels.

**Architecture:** Revisit each Reading/Writing question in the existing authenticated exam review, wait for the on-screen question number to change before extracting its content, and assemble one Markdown file from those records. Preserve question text and choices while omitting all page chrome.

**Tech Stack:** In-app browser session, Node.js browser runtime, Markdown.

## Global Constraints

- Capture Reading/Writing Modules 1 and 2 only; exclude Math.
- Export exactly 54 questions: 27 per Reading/Writing module.
- Keep topic, subtopic, passage, prompt, choices, answer marker, blanks, and punctuation.
- Omit timers, headers, navigation, review controls, feedback links, and completion UI.
- Map every source `Experimental` label to exactly one of `Easy`, `Medium`, or `Hard` using question complexity.

---

### Task 1: Re-capture and validate the Markdown export

**Files:**
- Modify: `exam_questions_reading_writing.md`

**Interfaces:**
- Consumes: the authenticated Kaplan exam-review sequence and its summary metadata.
- Produces: `exam_questions_reading_writing.md`, containing 54 complete Reading/Writing entries.

- [x] **Step 1: Capture each question after its screen is ready**

For each module, open question 1 from the summary, record `document.body.innerText`, click `Next`, and wait until the footer text changes from `Question N of total` to `Question N+1 of total` before recording the next screen.

- [x] **Step 2: Normalize extracted records**

For each record, retain text between the question-content start and `SHOW EXPLANATION`. Remove fixed site UI strings: `Skip to Main Content`, `Free SAT Practice Test`, module headings, timer labels/values, `Mark for Review`, `NEXT`, `BACK`, `Back to Summary`, feedback text, and question-navigation footer.

- [x] **Step 3: Render the Markdown**

Use this exact per-question structure:

```markdown
### Question N

- Topic: <source topic>
- Subtopic: <source subtopic>
- Difficulty: <Easy|Medium|Hard>

<pre>
<passage, prompt, answer choices, and correct-answer marker>
</pre>
```

- [x] **Step 4: Validate the generated file**

Run:

```bash
rg -c '^### Question ' exam_questions_reading_writing.md
rg -n 'Experimental|HIDE timer|Mark for Review|Back to Summary|Skip to Main Content' exam_questions_reading_writing.md
```

Expected: the first command reports `54`; the second command returns no matches. Inspect question 1, question 2, question 27 in each module to verify complete passages/prompts and answer choices.

- [ ] **Step 5: Commit**

```bash
git add exam_questions_reading_writing.md docs/superpowers/plans/2026-08-09-reading-writing-export-repair.md
git commit -m "fix: repair reading question export"
```
