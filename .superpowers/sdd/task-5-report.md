# Task 5 report: Passage rendering

## Files changed

- `src/components/Passage/sentence.ts` — exports the punctuation-based `segmentSentences` helper and removes empty fragments.
- `src/components/Passage/Passage.tsx` — renders sentence spans, accessible table headers/body rows, and an image figure when no table is supplied. The image `alt` receives `question.figure_description` without modification.
- `src/components/Passage/passage.css` — supplies lightweight passage, table, and responsive figure styles.
- `src/components/Passage/Passage.test.ts` — covers punctuation-preserving sentence splitting and whitespace-only fragment removal.

## TDD evidence

1. Added the segmentation tests before `sentence.ts` existed.
2. Ran `npm test -- src/components/Passage/Passage.test.ts`; it failed as expected with `ERR_MODULE_NOT_FOUND` for `sentence.ts`.
3. Implemented the minimal segmentation helper and Passage renderer.
4. Re-ran the focused test successfully.

## Verification results

```text
npm test -- src/components/Passage/Passage.test.ts
# tests 2
# pass 2
# fail 0
```

```text
./node_modules/.bin/tsc -p tsconfig.app.json --noEmit --incremental false
# exited successfully
```

```text
npm test
# tests 7
# pass 7
# fail 0
```

## Scope

No passage-selection, interaction, or Browse behavior was added.
