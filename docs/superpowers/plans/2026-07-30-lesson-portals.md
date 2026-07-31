# Lesson Portals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present the four lesson domains as in-frame, responsive visual portals while retaining domain-based lesson selection.

**Architecture:** `LessonLibrary` starts with the recommended lesson's domain selected and renders four domain portal buttons. Existing domain-filtered detail remains the sole content state. CSS converts the horizontal rail to a responsive grid while preserving button semantics.

**Tech Stack:** React 19, TypeScript, lucide-react, CSS, Node DOM tests.

## Global Constraints

- Change only `src/components/Lesson/LessonLibrary.tsx`, `src/components/Lesson/lesson.css`, and `src/components/Lesson/LessonLibrary.dom.test.tsx`.
- Keep domain filtering and `onSelectSkill(skill: string)` behavior unchanged.
- Use existing `DOMAIN_PRESENTATION` accents and Lucide domain icons.
- Desktop displays four equal-width portals; narrow screens wrap without horizontal overflow.

---

### Task 1: Update portal state and DOM contract

**Files:**
- Modify: `src/components/Lesson/LessonLibrary.dom.test.tsx:54-85`
- Modify: `src/components/Lesson/LessonLibrary.tsx:24-144`

**Interfaces:**
- Consumes: `recommendedSkill?: string | null`, `lessonForSkill(skill)`, `DOMAIN_PRESENTATION`, and `SAT_DOMAINS`.
- Produces: four `.lesson-console__tile[data-domain]` buttons, one `aria-pressed="true"` button, and a filtered `.lesson-console__lesson-list`.

- [x] **Step 1: Write the failing test**

Replace the landing assertion with:

```ts
assert.equal(container.querySelectorAll('.lesson-console__tile').length, 4)
assert.equal(
  container.querySelector('.lesson-console__tile[aria-pressed="true"]')?.getAttribute('data-domain'),
  'Information and Ideas',
)
assert.equal(container.querySelector('.lesson-console__tile--continue'), null)
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/Lesson/LessonLibrary.dom.test.tsx`

Expected: FAIL because the current component renders five tiles and selects Continue.

- [x] **Step 3: Write minimal implementation**

Make the default selection a domain derived from `continueLesson.domain`; remove the Continue tile and branch; always render the selected domain header and filtered lesson rows. Preserve mapped `SAT_DOMAINS` buttons, icons, clicks, and `aria-pressed`.

```ts
const [selection, setSelection] = useState<LessonSelection>({
  kind: 'domain',
  domain: continueLesson.domain as SatDomain,
})
```

- [x] **Step 4: Run focused test to verify it passes**

Run: `npm test -- src/components/Lesson/LessonLibrary.dom.test.tsx`

Expected: PASS; four portals, filtering, and skill selection pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Lesson/LessonLibrary.tsx src/components/Lesson/LessonLibrary.dom.test.tsx
git commit -m "feat: turn lessons into domain portals"
```

### Task 2: Fit portals inside the responsive console frame

**Files:**
- Modify: `src/components/Lesson/lesson.css:816-907`
- Test: `src/components/Lesson/LessonLibrary.dom.test.tsx:54-85`

**Interfaces:**
- Consumes: the four `.lesson-console__tile` elements and their `--lesson-accent` custom property.
- Produces: a one-row desktop grid, a two-column mid-width grid, and a one-column narrow grid.

- [x] **Step 1: Extend the DOM contract test**

Add this assertion:

```ts
assert.equal(container.querySelectorAll('.lesson-console__tile[data-domain]').length, 4)
```

- [x] **Step 2: Run test to establish the DOM baseline**

Run: `npm test -- src/components/Lesson/LessonLibrary.dom.test.tsx`

Expected: PASS after Task 1; CSS behavior is verified visually.

- [x] **Step 3: Implement bounded portal-grid styles**

Replace flex/overflow rail rules with this structure, then retain the existing dark accent gradients and selected state:

```css
.lesson-console__rail {
  display: grid;
  gap: clamp(.75rem, 1.2vw, 1.25rem);
  grid-template-columns: repeat(4, minmax(0, 1fr));
  overflow: visible;
  padding: .65rem 0 1.4rem;
}
.lesson-console__tile { aspect-ratio: 1 / 1; flex: initial; height: auto; min-width: 0; }
@media (max-width: 820px) { .lesson-console__rail { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 460px) { .lesson-console__rail { grid-template-columns: minmax(0, 1fr); } }
```

- [x] **Step 4: Run verification**

Run: `npm test -- src/components/Lesson/LessonLibrary.dom.test.tsx && npm run build`

Expected: both commands pass. Inspect the Lessons tab at desktop, tablet, and mobile widths: cards remain in-frame, selection is obvious, and each domain opens only its lesson list.

- [ ] **Step 5: Commit**

```bash
git add src/components/Lesson/lesson.css src/components/Lesson/LessonLibrary.dom.test.tsx
git commit -m "style: fit lesson portals in console frame"
```
