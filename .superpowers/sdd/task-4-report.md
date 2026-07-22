# Task 4 report: data loading and storage boundaries

## Files changed

- `src/data/questions.ts` — provides `loadQuestions(): Promise<Question[]>`, which fetches only `/data/questions.json` and rejects non-successful responses.
- `src/storage/index.ts` — provides typed `storage.get`, `storage.set`, and `storage.list` using the `clarity:v1:` namespace; parsing failures are ignored rather than returned. `recordAttempt` persists attempts only through `storage.set`.
- `src/data/questions.test.ts` — verifies the exact fetch path, returned data, and failed-response rejection.
- `src/storage/index.test.ts` — verifies versioned namespace isolation, prefix listing while leaving `clarity:schema-version` intact, and attempt persistence through the storage interface.
- `package.json` — adds the requested `npm test -- <files>` entry point using Node's built-in TypeScript-capable test runner.
- `tsconfig.app.json` — permits the test runner's `.ts` imports and exposes the already-installed Node type declarations to the test files.

## TDD evidence

1. Created the loader and storage tests before their modules existed.
2. Ran `npm test -- src/data/questions.test.ts src/storage/index.test.ts` and confirmed the expected red state: both imports failed because `src/data/questions.ts` and `src/storage/index.ts` did not yet exist.
3. Implemented the smallest interfaces required by those tests.
4. Re-ran the command successfully: 5 tests passed, 0 failed.

## Verification output

```text
npm test -- src/data/questions.test.ts src/storage/index.test.ts
# tests 5
# pass 5
# fail 0
```

```text
./node_modules/.bin/tsc -p tsconfig.app.json --noEmit --incremental false
# exited successfully
```

## Commit

`feat: add typed question loading and storage` (the final commit identifier is reported in the task handoff).

## Concerns

- The repository did not include a test runner. A third-party test runner could not be installed in the sandbox, so the standard `npm test -- <files>` command uses Node 22's built-in test runner with type stripping. This avoids adding a runtime dependency.
- The existing `npm run build` writes incremental build-info files below the pre-existing `node_modules` directory, which is not writable in this sandbox. The equivalent no-emit TypeScript check above passed; this is an environment permission limitation, not a Task 4 type failure.
