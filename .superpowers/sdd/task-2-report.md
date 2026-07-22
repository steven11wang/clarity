# Task 2 Report: Validation-first SAT parser

## Status

Complete. Task 2 implements structural parsing, input-order duplicate handling,
figure/table extraction, explicit quarantines, report objects, and the strict
validator threshold. Full production parsing was intentionally not run; that
remains Task 3.

## Implementation

- Copied the supplied `parse_sat.py` and `questions.json` into `tools/` before
  modifying the parser. `tools/questions.json` remains byte-for-byte identical
  to the supplied test JSON.
- Added `ParseReport` with `per_pdf`, `total`, `duplicates`, `figures`,
  `quarantines`, `accepted`, `failure_rate`, and `output_path` data.
- Added `parse_extracted_text()` as a testable structural seam and implemented
  the required `parse_all(pdf_paths, output_dir) -> ParseReport` interface.
- Split records on `Question ID:`, parsed the known SAT taxonomy, preserved
  passage paragraph breaks, and found the final recognized question stem for
  `passage` / `prompt` separation.
- Parsed only A-D choices as valid. Five choices, missing content, invalid
  answers, missing prompts, and missing rationales are excluded from emitted
  questions and recorded as explicit quarantines.
- Kept the first occurrence of duplicate IDs in input order and emitted a
  duplicate report entry for later occurrences, including cross-PDF merges.
- Detected case-insensitive `graph` and `table` references in stem text. PDF
  parsing crops the complete Question section (after metadata and before answer
  choices) at 150 DPI into `output_dir/images/{id}.png`, exposed in JSON as
  `/data/images/{id}.png`.
- Added best-effort figure descriptions. Table data is emitted only when
  `page.extract_tables()` yields a nonblank header and complete, equal-width
  rows; incomplete tables remain image-only.
- Added `ValidationReport` and
  `validate_questions(path, image_root) -> ValidationReport` with per-PDF,
  total, duplicate, figure, and quarantine data.
- Validator checks exactly four ordered A-D choices, A-D answer, nonblank
  passage/prompt/rationale, and figure image existence. It writes
  `validation-report.json` and `validation-quarantine.json`, prints quarantine
  details, and returns nonzero from the CLI at a quarantine rate of 2% or more.

## Test-first evidence

The fixture suite was written before changing the copied parser. Initial run:

```text
$ tools/.venv/bin/python -m unittest tools/test_parser.py -v
test_parser (unittest.loader._FailedTest) ... ERROR

======================================================================
ERROR: test_parser (unittest.loader._FailedTest)
----------------------------------------------------------------------
ImportError: Failed to import test module: test_parser
Traceback (most recent call last):
  File "/Applications/Xcode.app/Contents/Developer/Library/Frameworks/Python3.framework/Versions/3.9/lib/python3.9/unittest/loader.py", line 154, in loadTestsFromName
    module = __import__(module_name)
  File "/Users/s/Desktop/clarity/tools/test_parser.py", line 6, in <module>
    from tools.parse_sat import parse_extracted_text
ImportError: cannot import name 'parse_extracted_text' from 'tools.parse_sat' (/Users/s/Desktop/clarity/tools/parse_sat.py)

----------------------------------------------------------------------
Ran 1 test in 0.000s

FAILED (errors=1)
```

This is the expected red state: the source parser had no structural split/report
API.

Final required fixture command and exact output:

```text
$ tools/.venv/bin/python -m unittest tools/test_parser.py -v
test_duplicate_id_keeps_first_record_and_reports_duplicate (tools.test_parser.ParserFixtureTests) ... ok
test_five_choices_are_an_explicit_quarantine (tools.test_parser.ParserFixtureTests) ... ok
test_graph_and_table_stems_are_marked_for_figure_extraction (tools.test_parser.ParserFixtureTests) ... ok
test_missing_rationale_is_an_explicit_quarantine (tools.test_parser.ParserFixtureTests) ... ok
test_preserves_passage_paragraphs_and_splits_final_line_prompt (tools.test_parser.ParserFixtureTests) ... ok
test_validator_cli_fails_at_exactly_two_percent_quarantine (tools.test_parser.ValidatorFixtureTests) ... ok
test_validator_reports_invalid_records_and_missing_figure_images (tools.test_parser.ValidatorFixtureTests) ... ok

----------------------------------------------------------------------
Ran 7 tests in 0.005s

OK
```

## Bounded real-PDF verification

To avoid performing Task 3's full production parse, verification was limited to
two representative PDFs: Easy Inferences and Easy Command of Evidence.

Command:

```text
tools/.venv/bin/python -c 'import tempfile; from pathlib import Path; from tools.parse_sat import parse_all; from tools.validate import validate_questions; root=Path("/Users/s/Documents/Codex/2026-07-22/don-computer-plugin-computer-use-openai/outputs/SAT/Reading/Easy"); paths=[root/"Information and Ideas/Inferences/SAT_Reading_Easy_Information-and-Ideas_Inferences.pdf",root/"Information and Ideas/Command of Evidence/SAT_Reading_Easy_Information-and-Ideas_Command-of-Evidence.pdf"]; d=tempfile.TemporaryDirectory(); out=Path(d.name); parsed=parse_all(paths,out); validated=validate_questions(out/"questions.json",out/"images",write_report=False); print({"parse_total":parsed.total,"accepted":parsed.accepted,"duplicates":len(parsed.duplicates),"figures":len(parsed.figures),"quarantines":len(parsed.quarantines),"failure_rate":parsed.failure_rate}); print({"validation_total":validated.total,"quarantines":len(validated.quarantines),"failure_rate":validated.failure_rate,"passes":validated.passes}); d.cleanup()'
```

Exact output:

```text
{'parse_total': 99, 'accepted': 99, 'duplicates': 0, 'figures': 47, 'quarantines': 0, 'failure_rate': 0.0}
{'validation_total': 99, 'quarantines': 0, 'failure_rate': 0.0, 'passes': True}
```

This bounded sample is below the required 2% quarantine limit (0/99, 0%). A
rendered 150-DPI sample crop was visually inspected: it contains the complete
table, passage, and prompt and stops at the Answer section before choices.

## Commits

- `1a5dc03` — `feat: add validation-first SAT parser`
- The report itself is committed separately after the implementation commit.

## Concerns / Task 3 handoff

- `tools/questions.json` is the supplied legacy test artifact and uses the old
  combined `question` field. It was intentionally preserved exactly as required;
  Task 3 should generate the production `passage` / `prompt` dataset with the new
  parser rather than treat this file as final app data.
- Figure descriptions are deliberately best-effort and derive from nearby
  extracted text. They are useful labels, not semantic chart interpretations.
- The crop is intentionally generous and includes the passage/prompt along with
  the figure. This avoids clipping complex College Board charts and meets the
  after-metadata/before-choices boundary requirement, at the cost of larger
  image files.
- Only the bounded 99-question sample was parsed in this task. Task 3 should run
  the full 31-PDF corpus and inspect any new quarantines or unusual table layouts.
