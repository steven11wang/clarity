#!/usr/bin/env python3
"""Validation-first parser for College Board SAT question-bank exports.

The public API is ``parse_all(pdf_paths, output_dir) -> ParseReport``.  Parsing
keeps malformed records out of questions.json and records them in an explicit
quarantine report instead of silently emitting partial data.
"""

import argparse
import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import pdfplumber


TESTS = ["Reading and Writing", "Math"]
DOMAINS = [
    "Information and Ideas",
    "Craft and Structure",
    "Expression of Ideas",
    "Standard English Conventions",
    "Algebra",
    "Advanced Math",
    "Problem-Solving and Data Analysis",
    "Geometry and Trigonometry",
]
DIFFICULTIES = ["Easy", "Medium", "Hard"]
CHOICE_LABELS = ("A", "B", "C", "D")

PROMPT_START = re.compile(
    r"^(?:"
    r"Which\b|What\b|How\b|Why\b|According to\b|Based on\b|As used in\b|"
    r"The student wants\b|The text most strongly suggests\b|The passage most strongly suggests\b|"
    r"It can reasonably be inferred\b|Which finding\b|Which quotation\b|Which statement\b"
    r")",
    re.IGNORECASE,
)


@dataclass
class ParseReport:
    questions: List[Dict[str, Any]] = field(default_factory=list)
    per_pdf: List[Dict[str, Any]] = field(default_factory=list)
    total: int = 0
    duplicates: List[Dict[str, Any]] = field(default_factory=list)
    figures: List[Dict[str, Any]] = field(default_factory=list)
    quarantines: List[Dict[str, Any]] = field(default_factory=list)
    output_path: Optional[str] = None

    @property
    def accepted(self) -> int:
        return len(self.questions)

    @property
    def failure_rate(self) -> float:
        return len(self.quarantines) / self.total if self.total else 0.0

    def to_dict(self, include_questions: bool = False) -> Dict[str, Any]:
        data = asdict(self)
        if not include_questions:
            data.pop("questions", None)
        data["accepted"] = self.accepted
        data["failure_rate"] = self.failure_rate
        return data


def split_meta(meta_line: str) -> Tuple[str, str, str, str]:
    """Split the known, whitespace-ambiguous SAT metadata taxonomy."""
    value = meta_line.strip()
    value = re.sub(r"^SAT\s+", "", value)
    difficulty = next((item for item in DIFFICULTIES if value.endswith(item)), "")
    if difficulty:
        value = value[: -len(difficulty)].strip()
    test = next((item for item in TESTS if value.startswith(item)), "")
    if test:
        value = value[len(test) :].strip()
    domain = next((item for item in DOMAINS if value.startswith(item)), "")
    skill = value[len(domain) :].strip() if domain else value
    return test, domain, skill, difficulty


def _section(block: str, start: str, end: str) -> str:
    match = re.search(
        rf"(?ms)^\s*{re.escape(start)}\s*$\n(.*?)(?={end})",
        block,
    )
    return match.group(1).strip() if match else ""


def _split_passage_prompt(question_text: str) -> Tuple[str, str]:
    """Split at the final recognized question stem while retaining paragraphs."""
    lines = question_text.strip().splitlines()
    prompt_index = None
    for index in range(len(lines) - 1, -1, -1):
        if PROMPT_START.match(lines[index].strip()):
            prompt_index = index
            break
    if prompt_index is None:
        return question_text.strip(), ""
    passage = "\n".join(lines[:prompt_index]).strip()
    prompt = " ".join(line.strip() for line in lines[prompt_index:] if line.strip())
    return passage, prompt


def _parse_choices(answer_block: str) -> Tuple[Dict[str, str], List[str]]:
    matches = list(
        re.finditer(
            r"(?ms)^\s*([A-E])\.\s*(.*?)(?=^\s*[A-E]\.\s*|\Z)",
            answer_block.strip() + "\n",
        )
    )
    choices: Dict[str, str] = {}
    labels: List[str] = []
    for match in matches:
        label = match.group(1)
        labels.append(label)
        choices[label] = re.sub(r"\s+", " ", match.group(2)).strip()
    return choices, labels


def _figure_description(figure_type: str, passage: str, prompt: str) -> str:
    lines = [re.sub(r"\s+", " ", line).strip() for line in passage.splitlines()]
    candidate = next(
        (
            line
            for line in lines
            if line and re.search(rf"\b{figure_type}\b", line, re.IGNORECASE)
        ),
        "",
    )
    if not candidate:
        candidate = next((line for line in lines if line), prompt)
    candidate = candidate[:240].rstrip()
    return f"{figure_type.title()} referenced by the question: {candidate}"


def _valid_table(table: Any) -> Optional[Dict[str, List[Any]]]:
    if not isinstance(table, list) or len(table) < 2 or not isinstance(table[0], list):
        return None
    width = len(table[0])
    if width < 2:
        return None
    cleaned: List[List[str]] = []
    for row in table:
        if not isinstance(row, list) or len(row) != width:
            return None
        values = [re.sub(r"\s+", " ", str(cell or "")).strip() for cell in row]
        if any(not value for value in values):
            return None
        cleaned.append(values)
    return {"headers": cleaned[0], "rows": cleaned[1:]}


def _record_reasons(record: Dict[str, Any], choice_labels: Sequence[str]) -> List[str]:
    reasons = []
    if not str(record.get("passage", "")).strip():
        reasons.append("passage is blank")
    if not str(record.get("prompt", "")).strip():
        reasons.append("prompt is blank")
    if list(choice_labels) != list(CHOICE_LABELS) or any(
        not str(record.get("choices", {}).get(label, "")).strip() for label in CHOICE_LABELS
    ):
        reasons.append("exactly four choices A-D")
    if record.get("answer") not in CHOICE_LABELS:
        reasons.append("answer must be A-D")
    if not str(record.get("rationale", "")).strip():
        reasons.append("rationale is blank")
    return reasons


def _parse_block(block: str, source: str) -> Tuple[Dict[str, Any], List[str]]:
    identifier = re.match(r"\s*([^\s]+)", block)
    question_id = identifier.group(1).strip() if identifier else ""

    meta_match = re.search(
        r"(?m)^Assessment\s+Test\s+Domain\s+Skill\s+Difficulty\s*$\n([^\n]+)",
        block,
    )
    test, domain, skill, difficulty = split_meta(meta_match.group(1) if meta_match else "")
    question_text = _section(block, "Question", r"^\s*Answer\s*$")
    answer_block = _section(block, "Answer", r"^\s*Correct Answer:")
    rationale = _section(block, "Rationale", r"\Z")
    passage, prompt = _split_passage_prompt(question_text)
    choices, choice_labels = _parse_choices(answer_block)
    correct_match = re.search(r"(?m)^\s*Correct Answer:\s*([A-E])\b", block)

    record: Dict[str, Any] = {
        "id": question_id,
        "assessment": "SAT",
        "test": test,
        "domain": domain,
        "skill": skill,
        "difficulty": difficulty,
        "passage": passage,
        "prompt": prompt,
        "choices": choices,
        "answer": correct_match.group(1) if correct_match else "",
        "rationale": re.sub(r"\s+", " ", rationale).strip(),
    }

    stem = f"{passage}\n{prompt}"
    figure_match = re.search(r"\b(graph|table)\b", stem, re.IGNORECASE)
    if figure_match:
        figure_type = figure_match.group(1).lower()
        record.update(
            {
                "has_figure": True,
                "figure_type": figure_type,
                "image": f"/data/images/{question_id}.png",
                "figure_description": _figure_description(figure_type, passage, prompt),
            }
        )

    return record, _record_reasons(record, choice_labels)


def parse_extracted_text(text: str, source: str = "<text>") -> ParseReport:
    """Parse synthetic or already-extracted text without touching PDFs."""
    report = ParseReport()
    seen = set()
    blocks = re.split(r"(?m)^\s*Question ID:\s*", text)
    for block_index, block in enumerate(blocks[1:], start=1):
        report.total += 1
        try:
            record, reasons = _parse_block(block.strip(), source)
            question_id = record.get("id", "")
            if question_id in seen:
                report.duplicates.append(
                    {
                        "question_id": question_id,
                        "source_pdf": source,
                        "block": block_index,
                        "reason": "duplicate question id; first record kept",
                    }
                )
                continue
            seen.add(question_id)
            if reasons:
                report.quarantines.append(
                    {
                        "question_id": question_id,
                        "source_pdf": source,
                        "block": block_index,
                        "reasons": reasons,
                    }
                )
                continue
            report.questions.append(record)
            if record.get("has_figure"):
                report.figures.append(
                    {
                        "question_id": question_id,
                        "source_pdf": source,
                        "type": record["figure_type"],
                        "image": record["image"],
                    }
                )
        except Exception as exc:  # A bad block must never abort the corpus.
            first_line = block.strip().splitlines()[0] if block.strip() else ""
            report.quarantines.append(
                {
                    "question_id": first_line,
                    "source_pdf": source,
                    "block": block_index,
                    "reasons": [f"parser exception: {type(exc).__name__}: {exc}"],
                }
            )
    report.per_pdf.append(
        {
            "source_pdf": source,
            "total": report.total,
            "accepted": report.accepted,
            "duplicates": len(report.duplicates),
            "figures": len(report.figures),
            "quarantines": len(report.quarantines),
        }
    )
    return report


def _find_question_page(pdf: Any, question_id: str) -> Optional[Any]:
    for page in pdf.pages:
        if question_id in (page.extract_text() or ""):
            return page
    return None


def _crop_figure(page: Any, question_id: str, destination: Path) -> None:
    words = page.extract_words() or []
    question_markers = [
        word
        for word in words
        if word.get("text", "").strip().lower() == "question"
    ]
    answer_markers = [
        word for word in words if word.get("text", "").strip().lower() == "answer"
    ]
    # The section marker is normally the last "Question" before the Answer label.
    top = question_markers[-1]["bottom"] if question_markers else page.height * 0.12
    bottom_candidates = [word["top"] for word in answer_markers if word["top"] > top]
    bottom = min(bottom_candidates) if bottom_candidates else page.height * 0.80
    if bottom <= top + 12:
        raise ValueError(f"unable to locate figure crop bounds for {question_id}")
    padding = 8
    bbox = (
        max(0, padding),
        max(0, top - padding),
        min(page.width, page.width - padding),
        min(page.height, bottom + padding),
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    page.crop(bbox).to_image(resolution=150).save(str(destination), format="PNG")


def _extract_usable_table(page: Any) -> Optional[Dict[str, List[Any]]]:
    for raw_table in page.extract_tables() or []:
        table = _valid_table(raw_table)
        if table:
            return table
    return None


def _merge_reports(target: ParseReport, source: ParseReport, seen: set) -> None:
    duplicates_before = len(target.duplicates)
    quarantines_before = len(target.quarantines)
    figures_before = len(target.figures)
    accepted = 0
    source_pdf = source.per_pdf[0]["source_pdf"]
    figures_by_id = {item["question_id"]: item for item in source.figures}
    for record in source.questions:
        question_id = record["id"]
        if question_id in seen:
            target.duplicates.append(
                {
                    "question_id": question_id,
                    "source_pdf": source_pdf,
                    "reason": "duplicate question id; first record kept",
                }
            )
            continue
        seen.add(question_id)
        target.questions.append(record)
        if question_id in figures_by_id:
            target.figures.append(figures_by_id[question_id])
        accepted += 1
    target.total += source.total
    target.duplicates.extend(source.duplicates)
    target.quarantines.extend(source.quarantines)
    stats = source.per_pdf[0]
    target.per_pdf.append(
        {
            "source_pdf": stats["source_pdf"],
            "total": source.total,
            "accepted": accepted,
            "duplicates": len(target.duplicates) - duplicates_before,
            "figures": len(target.figures) - figures_before,
            "quarantines": len(target.quarantines) - quarantines_before,
        }
    )


def parse_all(pdf_paths: Iterable[Any], output_dir: Any) -> ParseReport:
    """Parse PDFs, save valid questions/images, and return a corpus report."""
    output = Path(output_dir)
    image_dir = output / "images"
    output.mkdir(parents=True, exist_ok=True)
    image_dir.mkdir(parents=True, exist_ok=True)
    combined = ParseReport(output_path=str(output / "questions.json"))
    seen = set()

    for raw_path in pdf_paths:
        path = Path(raw_path)
        try:
            with pdfplumber.open(str(path)) as pdf:
                text = "\n".join(page.extract_text() or "" for page in pdf.pages)
                parsed = parse_extracted_text(text, source=str(path))
                for record in list(parsed.questions):
                    if record["id"] in seen:
                        continue
                    if not record.get("has_figure"):
                        continue
                    question_id = record["id"]
                    try:
                        page = _find_question_page(pdf, question_id)
                        if page is None:
                            raise ValueError("question page not found")
                        _crop_figure(page, question_id, image_dir / f"{question_id}.png")
                        if record.get("figure_type") == "table":
                            table = _extract_usable_table(page)
                            if table:
                                record["table"] = table
                    except Exception as exc:
                        parsed.questions.remove(record)
                        parsed.figures = [
                            item for item in parsed.figures if item["question_id"] != question_id
                        ]
                        parsed.quarantines.append(
                            {
                                "question_id": question_id,
                                "source_pdf": str(path),
                                "reasons": [
                                    f"figure extraction exception: {type(exc).__name__}: {exc}"
                                ],
                            }
                        )
                parsed.per_pdf[0].update(
                    {
                        "accepted": len(parsed.questions),
                        "figures": len(parsed.figures),
                        "quarantines": len(parsed.quarantines),
                    }
                )
        except Exception as exc:
            parsed = ParseReport(
                per_pdf=[
                    {
                        "source_pdf": str(path),
                        "total": 0,
                        "accepted": 0,
                        "duplicates": 0,
                        "figures": 0,
                        "quarantines": 1,
                    }
                ],
                quarantines=[
                    {
                        "question_id": "",
                        "source_pdf": str(path),
                        "reasons": [f"PDF exception: {type(exc).__name__}: {exc}"],
                    }
                ],
            )
        _merge_reports(combined, parsed, seen)

    (output / "questions.json").write_text(
        json.dumps(combined.questions, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (output / "parse-report.json").write_text(
        json.dumps(combined.to_dict(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (output / "quarantine.json").write_text(
        json.dumps(combined.quarantines, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    if combined.quarantines:
        print(json.dumps({"quarantines": combined.quarantines}, indent=2, ensure_ascii=False))
    return combined


def _collect_pdf_paths(root: Path) -> List[Path]:
    return sorted(root.rglob("*.pdf")) if root.is_dir() else [root]


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="A PDF or a directory containing PDFs")
    parser.add_argument("output_dir", type=Path, help="Directory for questions.json and images")
    args = parser.parse_args(argv)
    report = parse_all(_collect_pdf_paths(args.source), args.output_dir)
    print(
        f"Accepted {report.accepted}/{report.total}; "
        f"duplicates={len(report.duplicates)}; figures={len(report.figures)}; "
        f"quarantines={len(report.quarantines)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
