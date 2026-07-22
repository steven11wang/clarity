import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from tools.parse_sat import parse_extracted_text
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
        self.assertEqual(["City", "Score"], report.questions[1]["table"]["headers"])
        self.assertEqual([["Lima", "8"], ["Oslo", "6"]], report.questions[1]["table"]["rows"])

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


if __name__ == "__main__":
    unittest.main()
