# Task 1 report: Scaffold and data contracts

## Status

Completed on branch `clarity-phases-0-1`.

## Implementation commit

- `dd2f0195ce2f133763cae236a8e3115c11201d52` — `feat: scaffold clarity foundation and contracts`

## Files changed

- `.gitignore`: retains generated dataset, image, and virtual-environment exclusions while explicitly retaining `public/data/images/.gitkeep`.
- `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`: Vite + React + TypeScript scaffold and locked dependencies.
- `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`: minimal compile-ready React entrypoint.
- `src/types.ts`: exports `Question`, `FigureData`, `TableData`, supporting `FigureType`, and the complete supplied `Attempt` contract. `Question` deliberately has no legacy joined `question` field.
- `src/tokens.ts`: centralized calm color, spacing, and radius tokens for later UI work.
- `tools/requirements.txt`: declares `pdfplumber`.
- `public/data/images/.gitkeep`: preserves the intentionally empty generated-image directory in source control.

## Commands and results

| Command | Result |
| --- | --- |
| `npm create vite@latest clarity -- --template react-ts` | The existing repository caused the generator to cancel, so a standard template was generated in a temporary directory and its equivalent scaffold was added without overwriting repository metadata. |
| `npm install` | Installed 25 packages; audit reported 0 vulnerabilities. |
| `python3 -m venv tools/.venv && tools/.venv/bin/python -m pip install -r tools/requirements.txt` | Succeeded; installed `pdfplumber 0.11.8` and its dependencies. |
| `npm run build` | Succeeded: `tsc -b && vite build`; Vite transformed 15 modules and produced `dist/`. |
| `tools/.venv/bin/python -c "import pdfplumber; print(...)"` | Succeeded: `pdfplumber 0.11.8`. |
| `git diff --cached --check` | Succeeded with no whitespace errors. |

## Self-review

- Confirmed all required Task 1 files exist and TypeScript compiles cleanly.
- Checked that `Attempt` includes every specified future-phase field, union value, and nullable field.
- Confirmed question figures are represented only through the requested optional fields: `has_figure`, `figure_type`, `image`, `figure_description`, and `table`.
- Confirmed `.gitkeep` is unignored while generated PNGs, JSON data, and the virtual environment remain ignored.
- Kept scope to Task 1; no data loader, storage module, parser, UI component boundaries, or later-phase behavior was added.

## Concerns

None. The generator's cancellation was expected for a non-empty repository and was handled without replacing its existing `.git` or `.superpowers` contents.

## Review follow-up: generated image ignore rule

### Changed file

- `.gitignore`: changed the figure-image pattern from an ignored directory followed by a re-included directory to `public/data/images/*`, with an explicit exception only for `public/data/images/.gitkeep`.

### Verification

Command:

```sh
git check-ignore -v --no-index public/data/images/example.png
git check-ignore -v --no-index public/data/images/.gitkeep || true
```

Output:

```text
.gitignore:5:public/data/images/*  public/data/images/example.png
.gitignore:6:!public/data/images/.gitkeep  public/data/images/.gitkeep
```

The first result confirms a generated PNG is ignored. The second line is the negation rule, confirming `.gitkeep` is exempt from that ignore pattern and can remain tracked.

### Commit

- `36d032178b6d0548afdbc571af413a165484a5c4` — `fix: keep generated figure images ignored`

### Self-review

- Verified the corrected wildcard rule applies to generated files inside `public/data/images/`.
- Verified the exception is limited to `.gitkeep`; the images directory itself is no longer re-included.
- Kept the change limited to the review finding.
