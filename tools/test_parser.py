import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tools.parse_sat import parse_all, parse_extracted_text
from tools.validate import main as validate_main
from tools.validate import validate_questions


def question_block(
    question_id: str,
    question: str,
    *,
    choices=None,
    answer="A",
    rationale="Choice A is the best answer because the passage supports it.",
):
    choices = choices or {
        "A": "The first option.",
        "B": "The second option.",
        "C": "The third option.",
        "D": "The fourth option.",
    }
    answer_lines = "\n".join(f"{letter}. {text}" for letter, text in choices.items())
    rationale_section = f"\nRationale\n{rationale}" if rationale is not None else ""
    return f"""Question ID: {question_id}
Assessment Test Domain Skill Difficulty
SAT Reading and Writing Information and Ideas Command of Evidence Medium
Question
{question}
Answer
{answer_lines}
Correct Answer: {answer}{rationale_section}
"""


class FakePage:
    def __init__(self, text, marker="page", tables=None):
        self.text = text
        self.marker = marker
        self.tables = tables or []

    def extract_text(self):
        return self.text

    def extract_tables(self):
        return self.tables


class FakePDF:
    def __init__(self, pages):
        self.pages = pages

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False


class ParserFixtureTests(unittest.TestCase):
    def test_preserves_passage_paragraphs_and_splits_final_line_prompt(self):
        text = question_block(
            "abc12345",
            "First paragraph, with its own evidence.\n\n"
            "Second paragraph develops the comparison.\n"
            "Which choice best states the main idea of the text?",
        )

        report = parse_extracted_text(text, source="fixture.pdf")

        self.assertEqual(1, report.total)
        self.assertEqual([], report.quarantines)
        self.assertEqual(
            "First paragraph, with its own evidence.\n\n"
            "Second paragraph develops the comparison.",
            report.questions[0]["passage"],
        )
        self.assertEqual(
            "Which choice best states the main idea of the text?",
            report.questions[0]["prompt"],
        )

    def test_question_output_has_exact_contract_without_source_pdf(self):
        text = question_block(
            "contract1",
            "A short passage.\nWhich choice best states the main idea of the text?",
        )

        report = parse_extracted_text(text, source="fixture.pdf")

        self.assertEqual(
            {
                "id",
                "assessment",
                "test",
                "domain",
                "skill",
                "difficulty",
                "passage",
                "prompt",
                "choices",
                "answer",
                "rationale",
            },
            set(report.questions[0]),
        )

    def test_duplicate_id_keeps_first_record_and_reports_duplicate(self):
        first = question_block(
            "duplicate1",
            "First version.\nWhich choice best states the main idea of the text?",
        )
        second = question_block(
            "duplicate1",
            "Second version.\nWhich choice best states the main idea of the text?",
        )

        report = parse_extracted_text(first + "\n" + second, source="fixture.pdf")

        self.assertEqual(2, report.total)
        self.assertEqual(1, len(report.questions))
        self.assertEqual("First version.", report.questions[0]["passage"])
        self.assertEqual(1, len(report.duplicates))
        self.assertEqual("duplicate1", report.duplicates[0]["question_id"])

    def test_graph_and_table_stems_are_marked_for_figure_extraction(self):
        graph = question_block(
            "graph001",
            "The graph shows annual rainfall.\n"
            "Which choice most effectively uses data from the graph?",
        )
        table = question_block(
            "table001",
            "Sample Results\nCity Score\nLima 8\nOslo 6\n"
            "Which choice most effectively uses data from the table?",
        )

        report = parse_extracted_text(graph + "\n" + table, source="figures.pdf")

        self.assertEqual(["graph", "table"], [q["figure_type"] for q in report.questions])
        self.assertTrue(all(q["has_figure"] for q in report.questions))
        self.assertEqual(2, len(report.figures))
        self.assertIn("annual rainfall", report.questions[0]["figure_description"].lower())
        self.assertNotIn("table", report.questions[1])

    def test_parse_all_emits_table_only_for_complete_pdfplumber_extraction(self):
        valid_text = question_block(
            "validtable",
            "City Score\nLima 8\nOslo 6\n"
            "Which choice most effectively uses data from the table?",
        )
        invalid_text = question_block(
            "invalidtable",
            "City Score\nLima 8\nOslo 6\n"
            "Which choice most effectively uses data from the table?",
        )
        fake_pdf = FakePDF(
            [
                FakePage(
                    valid_text,
                    tables=[[['City', 'Score'], ['Lima', '8'], ['Oslo', '6']]],
                ),
                FakePage(
                    invalid_text,
                    tables=[[['City', 'Score'], ['Lima', '8'], ['Oslo', None]]],
                ),
            ]
        )

        def write_crop(page, question_id, destination):
            destination.write_text(page.marker, encoding="utf-8")

        with tempfile.TemporaryDirectory() as temp_dir:
            with mock.patch("tools.parse_sat.pdfplumber.open", return_value=fake_pdf):
                with mock.patch("tools.parse_sat._crop_figure", side_effect=write_crop):
                    report = parse_all(["tables.pdf"], temp_dir)
            emitted = json.loads(
                (Path(temp_dir) / "questions.json").read_text(encoding="utf-8")
            )

        by_id = {record["id"]: record for record in report.questions}
        self.assertTrue(all("source_pdf" not in record for record in emitted))
        self.assertEqual(
            {"headers": ["City", "Score"], "rows": [["Lima", "8"], ["Oslo", "6"]]},
            by_id["validtable"]["table"],
        )
        self.assertNotIn("table", by_id["invalidtable"])

    def test_later_cross_pdf_duplicate_does_not_overwrite_first_figure_asset(self):
        first_text = question_block(
            "duplicatefigure",
            "The graph shows the first result.\n"
            "Which choice most effectively uses data from the graph?",
        )
        second_text = question_block(
            "duplicatefigure",
            "The graph shows the second result.\n"
            "Which choice most effectively uses data from the graph?",
        )
        fake_pdfs = [
            FakePDF([FakePage(first_text, marker="first")]),
            FakePDF([FakePage(second_text, marker="second")]),
        ]

        def write_crop(page, question_id, destination):
            destination.write_text(page.marker, encoding="utf-8")

        with tempfile.TemporaryDirectory() as temp_dir:
            with mock.patch("tools.parse_sat.pdfplumber.open", side_effect=fake_pdfs):
                with mock.patch("tools.parse_sat._crop_figure", side_effect=write_crop) as crop:
                    report = parse_all(["first.pdf", "second.pdf"], temp_dir)
            image = Path(temp_dir) / "images" / "duplicatefigure.png"
            image_contents = image.read_text(encoding="utf-8")

        self.assertEqual("first", image_contents)
        self.assertEqual(1, crop.call_count)
        self.assertEqual(1, len(report.questions))
        self.assertEqual(1, len(report.duplicates))

    def test_missing_rationale_is_an_explicit_quarantine(self):
        report = parse_extracted_text(
            question_block(
                "norationale",
                "A short passage.\nWhich choice best states the main idea of the text?",
                rationale=None,
            ),
            source="invalid.pdf",
        )

        self.assertEqual([], report.questions)
        self.assertEqual(1, len(report.quarantines))
        self.assertEqual("norationale", report.quarantines[0]["question_id"])
        self.assertTrue(
            any("rationale" in reason for reason in report.quarantines[0]["reasons"])
        )

    def test_five_choices_are_an_explicit_quarantine(self):
        choices = {
            "A": "One.",
            "B": "Two.",
            "C": "Three.",
            "D": "Four.",
            "E": "Five.",
        }
        report = parse_extracted_text(
            question_block(
                "fivechoice",
                "A short passage.\nWhich choice best states the main idea of the text?",
                choices=choices,
            ),
            source="invalid.pdf",
        )

        self.assertEqual([], report.questions)
        self.assertEqual(1, len(report.quarantines))
        self.assertIn("exactly four choices A-D", report.quarantines[0]["reasons"])


class ValidatorFixtureTests(unittest.TestCase):
    def test_parser_sidecar_preserves_multi_pdf_counts_without_schema_leakage(self):
        first_pdf = FakePDF(
            [
                FakePage(
                    question_block(
                        "first001",
                        "First passage.\nWhich choice best states the main idea of the text?",
                    )
                    + question_block(
                        "first002",
                        "Second passage.\nWhich choice best states the main idea of the text?",
                    )
                )
            ]
        )
        second_pdf = FakePDF(
            [
                FakePage(
                    question_block(
                        "second001",
                        "Third passage.\nWhich choice best states the main idea of the text?",
                    )
                )
            ]
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir)
            with mock.patch(
                "tools.parse_sat.pdfplumber.open", side_effect=[first_pdf, second_pdf]
            ):
                parse_all(["first.pdf", "second.pdf"], output)
            questions = json.loads((output / "questions.json").read_text(encoding="utf-8"))
            manifest_path = output / "question-sources.json"
            self.assertTrue(manifest_path.is_file())
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            report = validate_questions(
                output / "questions.json", output / "images", write_report=False
            )

        self.assertTrue(all("source_pdf" not in record for record in questions))
        self.assertEqual(
            {
                "version": 1,
                "question_sources": {
                    "first001": "first.pdf",
                    "first002": "first.pdf",
                    "second001": "second.pdf",
                },
            },
            manifest,
        )
        by_source = {entry["source_pdf"]: entry for entry in report.per_pdf}
        self.assertEqual(2, by_source["first.pdf"]["total"])
        self.assertEqual(2, by_source["first.pdf"]["valid"])
        self.assertEqual(1, by_source["second.pdf"]["total"])
        self.assertEqual(1, by_source["second.pdf"]["valid"])

    def test_validator_fails_closed_for_unreadable_malformed_and_non_array_json(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            cases = {
                "unreadable": root / "missing.json",
                "malformed": root / "malformed.json",
                "non_array": root / "non-array.json",
            }
            cases["malformed"].write_text("{not JSON", encoding="utf-8")
            cases["non_array"].write_text('{"questions": []}', encoding="utf-8")

            for name, path in cases.items():
                with self.subTest(name=name):
                    report = validate_questions(path, root / "images", write_report=False)
                    with contextlib.redirect_stdout(io.StringIO()):
                        exit_code = validate_main([str(path), str(root / "images")])
                    self.assertEqual(1, len(report.quarantines))
                    self.assertGreaterEqual(report.failure_rate, 0.02)
                    self.assertFalse(report.passes)
                    self.assertEqual(1, exit_code)

    def test_validator_reports_invalid_records_and_missing_figure_images(self):
        records = [
            {
                "id": "valid001",
                "passage": "Passage",
                "prompt": "Which choice is best?",
                "choices": {"A": "One", "B": "Two", "C": "Three", "D": "Four"},
                "answer": "A",
                "rationale": "Because one is supported.",
                "source_pdf": "fixture.pdf",
            },
            {
                "id": "missingimage",
                "passage": "Graph passage",
                "prompt": "Which choice uses data from the graph?",
                "choices": {"A": "One", "B": "Two", "C": "Three", "D": "Four"},
                "answer": "A",
                "rationale": "Because one is supported.",
                "has_figure": True,
                "image": "/data/images/missingimage.png",
                "source_pdf": "fixture.pdf",
            },
            {
                "id": "invalid001",
                "passage": "",
                "prompt": "",
                "choices": {"A": "One", "B": "Two", "C": "Three"},
                "answer": "E",
                "rationale": "",
                "source_pdf": "other.pdf",
            },
        ]
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            questions_path = root / "questions.json"
            questions_path.write_text(json.dumps(records), encoding="utf-8")

            report = validate_questions(questions_path, root / "images", write_report=False)

        self.assertEqual(3, report.total)
        self.assertEqual(2, len(report.quarantines))
        self.assertEqual(1, len(report.figures))
        reasons = {entry["question_id"]: entry["reasons"] for entry in report.quarantines}
        self.assertIn("figure image does not exist", reasons["missingimage"])
        self.assertIn("passage is blank", reasons["invalid001"])
        self.assertIn("exactly four choices A-D", reasons["invalid001"])
        self.assertIn("answer must be A-D", reasons["invalid001"])
        self.assertIn("rationale is blank", reasons["invalid001"])
        self.assertGreaterEqual(report.failure_rate, 0.02)

    def test_validator_cli_fails_at_exactly_two_percent_quarantine(self):
        valid_record = {
            "passage": "Passage",
            "prompt": "Which choice is best?",
            "choices": {"A": "One", "B": "Two", "C": "Three", "D": "Four"},
            "answer": "A",
            "rationale": "Because one is supported.",
            "source_pdf": "fixture.pdf",
        }
        records = [dict(valid_record, id=f"valid{index:03d}") for index in range(49)]
        records.append(dict(valid_record, id="invalid", rationale=""))
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            questions_path = root / "questions.json"
            questions_path.write_text(json.dumps(records), encoding="utf-8")
            with contextlib.redirect_stdout(io.StringIO()):
                exit_code = validate_main([str(questions_path), str(root / "images")])

        self.assertEqual(1, exit_code)

    def test_validator_requires_exact_figure_url_even_when_basename_exists(self):
        record = {
            "id": "figure001",
            "passage": "Graph passage",
            "prompt": "Which choice uses data from the graph?",
            "choices": {"A": "One", "B": "Two", "C": "Three", "D": "Four"},
            "answer": "A",
            "rationale": "Because one is supported.",
            "has_figure": True,
            "figure_type": "graph",
            "image": "/wrong/location/figure001.png",
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            images = root / "images"
            images.mkdir()
            (images / "figure001.png").write_text("image", encoding="utf-8")
            questions_path = root / "questions.json"
            questions_path.write_text(json.dumps([record]), encoding="utf-8")

            report = validate_questions(questions_path, images, write_report=False)

        self.assertEqual(1, len(report.quarantines))
        self.assertIn(
            "figure image path must be /data/images/figure001.png",
            report.quarantines[0]["reasons"],
        )

    def test_validator_checks_local_file_for_exact_figure_url(self):
        record = {
            "id": "figure002",
            "passage": "Graph passage",
            "prompt": "Which choice uses data from the graph?",
            "choices": {"A": "One", "B": "Two", "C": "Three", "D": "Four"},
            "answer": "A",
            "rationale": "Because one is supported.",
            "has_figure": True,
            "figure_type": "graph",
            "image": "/data/images/figure002.png",
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            questions_path = root / "questions.json"
            questions_path.write_text(json.dumps([record]), encoding="utf-8")

            report = validate_questions(questions_path, root / "images", write_report=False)

        self.assertEqual(1, len(report.quarantines))
        self.assertIn("figure image does not exist", report.quarantines[0]["reasons"])


if __name__ == "__main__":
    unittest.main()
