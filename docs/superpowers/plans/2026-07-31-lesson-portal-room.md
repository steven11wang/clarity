# Lesson Portal Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Lessons card grid with a Clarity-themed portal room that opens selected or recommended lessons.

**Architecture:** `LessonLibrary` retains domain selection but renders a scene hero and doorway controls instead of the rail/detail list. `lesson.css` owns the room's depth, floor, light, and mobile fallback. No lesson content or storage changes.

**Tech Stack:** React 19, TypeScript, lucide-react, CSS, Node DOM tests.

## Global Constraints

- Preserve `SAT_DOMAINS`, `DOMAIN_PRESENTATION`, `onSelectSkill(skill: string)`, and seen-state storage.
- Use Clarity's dark cobalt, glass, and per-domain accent palette.
- The primary action opens the first lesson in the selected domain; continuation opens the recommended lesson.
- Desktop is an in-frame perspective scene; narrow screens use a compact non-3D fallback.

---

### Task 1: Establish portal-room behavior

**Files:**
- Modify: `src/components/Lesson/LessonLibrary.dom.test.tsx:64-105`
- Modify: `src/components/Lesson/LessonLibrary.tsx:43-120`

**Interfaces:**
- Consumes: `recommendedSkill`, `SKILL_LESSON_INDEX`, `SAT_DOMAINS`, and `DOMAIN_PRESENTATION`.
- Produces: `.lesson-portal-room`, four `.lesson-portal-door[data-domain]` controls, `.lesson-portal-room__enter`, and `.lesson-portal-room__continue`.

- [ ] **Step 1: Write the failing tests**

Replace list filtering with:

```ts
assert.equal(container.querySelectorAll('.lesson-portal-door').length, 4)
await click(container.querySelector('.lesson-portal-door[data-domain="Craft and Structure"]'))
assert.match(container.querySelector('.lesson-portal-room__title')?.textContent ?? '', /Craft and Structure/)
await click(container.querySelector('.lesson-portal-room__enter'))
assert.equal(selectedSkill, 'Words in Context')
await click(container.querySelector('.lesson-portal-room__continue'))
assert.equal(selectedSkill, 'Command of Evidence')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/build-dom-tests.mjs && node --experimental-strip-types --experimental-specifier-resolution=node --test tools/dom-tests/components-Lesson-LessonLibrary.test.mjs`

Expected: FAIL because the card grid has no portal-room actions.

- [ ] **Step 3: Implement minimal portal-room markup**

Derive the selected domain's first lesson, then render the hero, four mapped doorway buttons, decorative floor/silhouette, and continuation action:

```ts
const selectedLesson = SKILL_LESSON_INDEX.find(
  (lesson) => lesson.domain === selectedDomain,
) ?? continueLesson
```

The hero calls `onSelectSkill(selectedLesson.skill)`; continuation calls `onSelectSkill(continueLesson.skill)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/build-dom-tests.mjs && node --experimental-strip-types --experimental-specifier-resolution=node --test tools/dom-tests/components-Lesson-LessonLibrary.test.mjs`

Expected: PASS; selected doors update the hero and both actions open the correct lessons.

- [ ] **Step 5: Commit**

```bash
git add src/components/Lesson/LessonLibrary.tsx src/components/Lesson/LessonLibrary.dom.test.tsx
git commit -m "feat: add lesson portal room"
```

### Task 2: Build the responsive Clarity scene

**Files:**
- Modify: `src/components/Lesson/lesson.css:813-1140`
- Modify: `src/primary-console-theme.test.ts:35-71`

**Interfaces:**
- Consumes: portal-room class names and each doorway's `--lesson-accent` property.
- Produces: a bounded desktop perspective scene and a mobile stacked portal layout.

- [ ] **Step 1: Write the failing theme assertions**

```ts
assert.match(stylesheet, /\.lesson-portal-room\s*\{[^}]*min-height:/s)
assert.match(stylesheet, /\.lesson-portal-door\s*\{[^}]*transform:\s*rotateY/s)
assert.match(stylesheet, /@media\s*\(max-width:\s*720px\)[\s\S]*\.lesson-portal-room\s*\{[^}]*min-height:\s*auto/s)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --experimental-specifier-resolution=node --test src/primary-console-theme.test.ts`

Expected: FAIL because scene classes are unstyled.

- [ ] **Step 3: Implement scene CSS**

Replace rail/detail CSS with a relative, clipped room: radial cobalt light, trapezoid floor, centered silhouette, and four absolute doors with `rotateY` transforms. At 720px remove the transforms, place compact doors before the hero, and reset room `min-height` to `auto`.

- [ ] **Step 4: Run verification**

Run: `node --experimental-strip-types --experimental-specifier-resolution=node --test src/primary-console-theme.test.ts && node tools/build-dom-tests.mjs && node --experimental-strip-types --experimental-specifier-resolution=node --test tools/dom-tests/components-Lesson-LessonLibrary.test.mjs && npm run build`

Expected: all commands pass; desktop doors and floor stay within frame, and mobile has no clipped perspective elements.

- [ ] **Step 5: Commit**

```bash
git add src/components/Lesson/lesson.css src/primary-console-theme.test.ts
git commit -m "style: theme lesson portal room"
```
