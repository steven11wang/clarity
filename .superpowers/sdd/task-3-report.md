# Task 3 Report: Production SAT Reading data

## Status

Complete. The production parser consumed exactly all 31 read-only Reading PDFs,
emitted the full corpus and provenance, created and activated a representative
sample, rendered all figure assets, and passed strict validation for the full,
sample, and active datasets.

Generated JSON and image assets remain ignored/untracked under `public/data/`.
Only parser/validator source, regression tests, ignore configuration, and this
evidence documentation are committed.

## Source scope and parse command

Source root:

```text
/Users/s/Documents/Codex/2026-07-22/don-computer-plugin-computer-use-openai/outputs/SAT/Reading
```

The sorted null-delimited output of `find` was passed directly to
`tools.parse_sat.parse_all`; stdout was captured in `tools/parse-report.txt`:

```text
find '<source-root>' -type f -name '*.pdf' -print0 | sort -z |
  tools/.venv/bin/python -c '<read paths from stdin; parse_all(paths, public/data)>' |
  tee tools/parse-report.txt
```

Final parse output:

```text
Input PDFs: 31
Accepted 1647/1650; duplicates=0; figures=127; quarantines=3; failure_rate=0.18%
```

The quarantine rate is 3 / 1,650 = 0.1818%, below the strict 2% threshold.

## Production QA finding and durable correction

The first full run revealed three parser defects that fixture-only testing had
not exposed:

1. PDF metadata extraction truncates some taxonomy values. This produced a
   blank domain for 379 Standard English records and truncated two skill names.
2. `pdfplumber` returns the page's Assessment/Test metadata table before the
   actual question table. The parser accepted that first valid table.
3. Searching the whole stem for `table` falsely marked prose references such as
   "periodic table," "Round Table," and "table forks" as figures.

Focused regression tests were added first. The RED run failed with five expected
assertion failures: the three prose cases had `has_figure`, Standard English had
a blank domain, and the metadata table was emitted instead of City/Score.

The minimal production correction:

- uses the canonical source directory taxonomy only when extracted metadata is
  missing or not a known domain/skill/difficulty;
- rejects the exact Assessment/Test/Domain/Skill/Difficulty metadata header and
  continues to the actual complete table;
- requires graph/table references in the question prompt, which all 127 real
  figure questions have, instead of matching arbitrary passage prose.

Focused GREEN output:

```text
Ran 3 tests in 0.006s
OK
```

The corrected parser was then used for a clean regeneration. Figure count fell
from 130 to the correct 127; taxonomy and structured table checks became clean.

## Full corpus counts

### Difficulty

| Difficulty | Questions |
|---|---:|
| Easy | 586 |
| Medium | 546 |
| Hard | 515 |

### Domain

| Domain | Questions |
|---|---:|
| Information and Ideas | 505 |
| Craft and Structure | 399 |
| Expression of Ideas | 364 |
| Standard English Conventions | 379 |

### Skill

| Skill | Questions |
|---|---:|
| Central Ideas and Details | 123 |
| Command of Evidence | 258 |
| Inferences | 124 |
| Cross-Text Connections | 20 |
| Text Structure and Purpose | 138 |
| Words in Context | 241 |
| Rhetorical Synthesis | 191 |
| Transitions | 173 |
| Boundaries | 190 |
| Form, Structure, and Sense | 189 |

### Source PDF

| Source PDF | Total | Accepted | Figures | Quarantines |
|---|---:|---:|---:|---:|
| SAT_Reading_Easy_Craft-and-Structure_Cross-Text-Connections_2c50ed1a.pdf | 3 | 3 | 0 | 0 |
| SAT_Reading_Easy_Craft-and-Structure_Cross-Text-Connections_835d1ae6.pdf | 7 | 7 | 0 | 0 |
| SAT_Reading_Easy_Craft-and-Structure_Text-Structure-and-Purpose.pdf | 46 | 46 | 0 | 0 |
| SAT_Reading_Easy_Craft-and-Structure_Words-in-Context.pdf | 131 | 131 | 0 | 0 |
| SAT_Reading_Easy_Expression-of-Ideas_Rhetorical-Synthesis.pdf | 42 | 41 | 0 | 1 |
| SAT_Reading_Easy_Expression-of-Ideas_Transitions.pdf | 73 | 73 | 0 | 0 |
| SAT_Reading_Easy_Information-and-Ideas_Central-Ideas-and-Details.pdf | 37 | 37 | 0 | 0 |
| SAT_Reading_Easy_Information-and-Ideas_Command-of-Evidence.pdf | 77 | 77 | 47 | 0 |
| SAT_Reading_Easy_Information-and-Ideas_Inferences.pdf | 22 | 22 | 0 | 0 |
| SAT_Reading_Easy_Standard-English-Conventions_Boundaries.pdf | 59 | 59 | 0 | 0 |
| SAT_Reading_Easy_Standard-English-Conventions_Form-Structure-and-Sense.pdf | 90 | 90 | 0 | 0 |
| SAT_Reading_Hard_Craft-and-Structure_Cross-Text-Connections_e4e2aeb3.pdf | 5 | 5 | 0 | 0 |
| SAT_Reading_Hard_Craft-and-Structure_Text-Structure-and-Purpose.pdf | 39 | 39 | 0 | 0 |
| SAT_Reading_Hard_Craft-and-Structure_Words-in-Context.pdf | 54 | 54 | 0 | 0 |
| SAT_Reading_Hard_Expression-of-Ideas_Rhetorical-Synthesis.pdf | 44 | 44 | 0 | 0 |
| SAT_Reading_Hard_Expression-of-Ideas_Transitions.pdf | 39 | 39 | 0 | 0 |
| SAT_Reading_Hard_Information-and-Ideas_Central-Ideas-and-Details.pdf | 41 | 40 | 0 | 1 |
| SAT_Reading_Hard_Information-and-Ideas_Command-of-Evidence.pdf | 102 | 102 | 44 | 0 |
| SAT_Reading_Hard_Information-and-Ideas_Inferences.pdf | 61 | 61 | 0 | 0 |
| SAT_Reading_Hard_Standard-English-Conventions_Boundaries.pdf | 78 | 78 | 0 | 0 |
| SAT_Reading_Hard_Standard-English-Conventions_Form-Structure-and-Sense.pdf | 53 | 53 | 0 | 0 |
| SAT_Reading_Medium_Craft-and-Structure_Cross-Text-Connections_7bf79a90.pdf | 5 | 5 | 0 | 0 |
| SAT_Reading_Medium_Craft-and-Structure_Text-Structure-and-Purpose.pdf | 53 | 53 | 0 | 0 |
| SAT_Reading_Medium_Craft-and-Structure_Words-in-Context.pdf | 56 | 56 | 0 | 0 |
| SAT_Reading_Medium_Expression-of-Ideas_Rhetorical-Synthesis.pdf | 106 | 106 | 0 | 0 |
| SAT_Reading_Medium_Expression-of-Ideas_Transitions.pdf | 61 | 61 | 0 | 0 |
| SAT_Reading_Medium_Information-and-Ideas_Central-Ideas-and-Details.pdf | 47 | 46 | 0 | 1 |
| SAT_Reading_Medium_Information-and-Ideas_Command-of-Evidence.pdf | 79 | 79 | 36 | 0 |
| SAT_Reading_Medium_Information-and-Ideas_Inferences.pdf | 41 | 41 | 0 | 0 |
| SAT_Reading_Medium_Standard-English-Conventions_Boundaries.pdf | 53 | 53 | 0 | 0 |
| SAT_Reading_Medium_Standard-English-Conventions_Form-Structure-and-Sense.pdf | 46 | 46 | 0 | 0 |

## Quarantines

No accepted Question fails validation. Parser quarantines are explicit:

| Question ID | Source | Reason |
|---|---|---|
| e3bbf2bf | Easy / Expression of Ideas / Rhetorical Synthesis | Source extraction has no `D.` label, so exactly four A-D choices cannot be proven. |
| 458b4a11 | Hard / Information and Ideas / Central Ideas and Details | Prompt did not match the approved structural prompt recognizer; prompt remained blank. |
| 2312021b | Medium / Information and Ideas / Central Ideas and Details | Prompt did not match the approved structural prompt recognizer; prompt remained blank. |

The source pages were inspected. The latter two are readable questions, but are
correctly excluded by the validation-first parser rather than guessed into the
corpus. The first visibly lacks a `D.` label in extracted PDF text.

## Figure and table verification

- Figure records: 127 total = 59 graph + 68 table.
- PNG assets: 127. The set of PNG stems exactly equals the set of referenced
  figure question IDs; there are no orphaned or missing assets.
- Structured tables: 68/68 table records have nonblank headers and rows with
  row widths equal to the header width.
- Image-only table fallbacks: 0.
- Graph example `3dc911d6`: `/data/images/3dc911d6.png` exists and was visually
  inspected. The crop shows the veteran-membership graph, passage, prompt, and
  stops before answer choices.
- Table example `75e07a4d`: the PNG visibly shows the Gemini food-items table.
  JSON headers are `["Food item", "Day", "Meal"]`; rows are Sugar cookie
  cubes/1/B, Chicken and vegetables/2/B, Shrimp cocktail/4/C, and Hot cocoa/3/A.

The image-only fallback result is also recorded in `tools/parse-report.txt` as
required.

## Sample and active data

`questions.sample.json` contains 30 questions: exactly three per each of the ten
skills and ten per difficulty. Selection is deterministic: one Easy, Medium,
and Hard question per skill. Command of Evidence preferentially selects real
figures by desired type.

Sample figures:

- `75e07a4d` — Easy table
- `d83c3d54` — Medium graph
- `7a1877be` — Hard table

`questions.json` is byte-for-byte identical to `questions.sample.json`.
Provenance sidecars contain exactly 1,647 IDs for full and 30 IDs for both
sample and active.

The validator now resolves dataset-specific sidecars when present:

- `questions.full.json` -> `question-sources.full.json`
- `questions.sample.json` -> `question-sources.sample.json`
- `questions.json` -> `question-sources.json`

The explicit dataset-specific sidecar overrides the active default; absent a
variant sidecar, the existing default behavior remains.

## Validation and build evidence

Final fixture suite:

```text
$ tools/.venv/bin/python -m unittest tools/test_parser.py -v
Ran 19 tests in 0.027s
OK
```

Final validation commands and output in the final sidecar configuration:

```text
$ tools/.venv/bin/python tools/validate.py public/data/questions.full.json --images public/data/images
Validated 1647 records; quarantines=0; failure_rate=0.00%; threshold=2.00%

$ tools/.venv/bin/python tools/validate.py public/data/questions.sample.json public/data/images
Validated 30 records; quarantines=0; failure_rate=0.00%; threshold=2.00%

$ tools/.venv/bin/python tools/validate.py public/data/questions.json public/data/images
Validated 30 records; quarantines=0; failure_rate=0.00%; threshold=2.00%
```

Baseline/final app build:

```text
$ npm run build
vite v8.1.5 building client environment for production...
15 modules transformed.
dist/index.html                  0.39 kB | gzip: 0.26 kB
dist/assets/index-BViJuqDY.js  190.45 kB | gzip: 59.98 kB
build completed successfully
```

`git diff --check` passes.

## Commits

- `af7bbb7` — `fix: harden production SAT extraction`
  - canonical source-path taxonomy fallback;
  - real question-table selection;
  - prompt-scoped figure detection;
  - focused production regressions.
- `d0b5df5` — `fix: resolve dataset provenance sidecars`
  - full/sample/active sidecar resolution;
  - sidecar regression test;
  - ignore all generated `public/data/*.json`.
- `4e8fdd7` — `docs: record production data generation evidence`.
- Required `--images` CLI compatibility commit follows this report update.

## Self-review

- Confirmed the parser received exactly 31 unique sorted PDF paths from `find`.
- Confirmed all 31 PDFs appear once in parse and full validation provenance.
- Confirmed 1,647 accepted IDs are unique, map one-to-one to full provenance,
  and do not leak `source_pdf` into Question records.
- Confirmed taxonomy has no blank or noncanonical domain/skill/difficulty values.
- Confirmed every figure reference has exactly one on-disk PNG and no extra PNGs.
- Confirmed all structured tables are question data, not page metadata.
- Confirmed sample/active equality, three questions per skill, balanced difficulty,
  and three representative figures.
- Confirmed full/sample/active validators all pass in the final simultaneous
  sidecar configuration.
- Confirmed ignored generated JSON/images are absent from the commit index.

## Required `--images` CLI compatibility correction

The required command originally exited 2 before validation:

```text
$ tools/.venv/bin/python tools/validate.py public/data/questions.full.json --images public/data/images
usage: validate.py [-h] questions image_root
validate.py: error: unrecognized arguments: --images
```

Root cause: the CLI declared only a required positional `image_root`. A focused
test invokes `validate_main([questions, "--images", image_root])` against a valid
fixture and asserts exit 0 plus the successful validation summary. The RED run
failed with `AssertionError: 0 != 2`.

The minimal fix makes the positional image root optional, adds `--images`, and
uses the flag when provided while retaining the prior positional form. Missing
both forms remains an argparse error.

GREEN and compatibility evidence:

```text
$ tools/.venv/bin/python -m unittest tools.test_parser.ValidatorFixtureTests.test_validator_cli_accepts_required_images_flag -v
Ran 1 test in 0.002s
OK

$ tools/.venv/bin/python tools/validate.py public/data/questions.full.json --images public/data/images
Validated 1647 records; quarantines=0; failure_rate=0.00%; threshold=2.00%

$ tools/.venv/bin/python tools/validate.py public/data/questions.json public/data/images
Validated 30 records; quarantines=0; failure_rate=0.00%; threshold=2.00%
```

## Remaining concern

The three parser quarantines are intentionally retained and explicitly reported.
They are only 0.18% of source records and do not affect strict validation of the
accepted corpus. Recovering them would require broadening structural inference
or manually repairing source text, which is outside this validation-first task.
