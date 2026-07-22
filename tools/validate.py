#!/usr/bin/env python3
"""Validate Clarity question data and produce explicit quarantine reports."""

import argparse
import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence


CHOICE_LABELS = ("A", "B", "C", "D")
FAILURE_THRESHOLD = 0.02


@dataclass
class ValidationReport:
    per_pdf: List[Dict[str, Any]] = field(default_factory=list)
    total: int = 0
    duplicates: List[Dict[str, Any]] = field(default_factory=list)
    figures: List[Dict[str, Any]] = field(default_factory=list)
    quarantines: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def failure_rate(self) -> float:
        return len(self.quarantines) / self.total if self.total else 0.0

    @property
    def passes(self) -> bool:
        return self.failure_rate < FAILURE_THRESHOLD

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["failure_rate"] = self.failure_rate
        data["passes"] = self.passes
        data["threshold"] = FAILURE_THRESHOLD
        return data


def _record_reasons(record: Dict[str, Any], image_root: Path) -> List[str]:
    reasons = []
    if not str(record.get("passage", "")).strip():
        reasons.append("passage is blank")
    if not str(record.get("prompt", "")).strip():
        reasons.append("prompt is blank")
    choices = record.get("choices")
    if (
        not isinstance(choices, dict)
        or list(choices.keys()) != list(CHOICE_LABELS)
        or any(not str(choices.get(label, "")).strip() for label in CHOICE_LABELS)
    ):
        reasons.append("exactly four choices A-D")
    if record.get("answer") not in CHOICE_LABELS:
        reasons.append("answer must be A-D")
    if not str(record.get("rationale", "")).strip():
        reasons.append("rationale is blank")
    if record.get("has_figure"):
        image_value = str(record.get("image", "")).strip()
        image_path = image_root / Path(image_value).name if image_value else None
        if image_path is None or not image_path.is_file():
            reasons.append("figure image does not exist")
    return reasons


def validate_questions(
    path: Any, image_root: Any, *, write_report: bool = True
) -> ValidationReport:
    """Validate a questions JSON file without mutating its contents."""
    questions_path = Path(path)
    images = Path(image_root)
    report = ValidationReport()
    per_pdf: Dict[str, Dict[str, Any]] = {}
    seen = set()

    try:
        payload = json.loads(questions_path.read_text(encoding="utf-8"))
        if not isinstance(payload, list):
            raise ValueError("questions JSON root must be an array")
    except Exception as exc:
        report.quarantines.append(
            {
                "question_id": "",
                "source_pdf": str(questions_path),
                "reasons": [f"JSON exception: {type(exc).__name__}: {exc}"],
            }
        )
        payload = []

    report.total = len(payload)
    for index, record in enumerate(payload):
        if not isinstance(record, dict):
            source = str(questions_path)
            question_id = ""
            reasons = ["record is not an object"]
        else:
            source = str(record.get("source_pdf") or questions_path.name)
            question_id = str(record.get("id", "")).strip()
            reasons = _record_reasons(record, images)
            if record.get("has_figure"):
                report.figures.append(
                    {
                        "question_id": question_id,
                        "source_pdf": source,
                        "type": record.get("figure_type", ""),
                        "image": record.get("image", ""),
                    }
                )

        stats = per_pdf.setdefault(
            source,
            {
                "source_pdf": source,
                "total": 0,
                "valid": 0,
                "duplicates": 0,
                "figures": 0,
                "quarantines": 0,
            },
        )
        stats["total"] += 1
        if isinstance(record, dict) and record.get("has_figure"):
            stats["figures"] += 1
        if question_id in seen:
            duplicate = {
                "question_id": question_id,
                "source_pdf": source,
                "index": index,
                "reason": "duplicate question id; first record kept",
            }
            report.duplicates.append(duplicate)
            stats["duplicates"] += 1
            reasons.append("duplicate question id")
        else:
            seen.add(question_id)
        if reasons:
            report.quarantines.append(
                {
                    "question_id": question_id,
                    "source_pdf": source,
                    "index": index,
                    "reasons": reasons,
                }
            )
            stats["quarantines"] += 1
        else:
            stats["valid"] += 1

    report.per_pdf = list(per_pdf.values())
    if write_report:
        report_path = questions_path.with_name("validation-report.json")
        quarantine_path = questions_path.with_name("validation-quarantine.json")
        report_path.write_text(
            json.dumps(report.to_dict(), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        quarantine_path.write_text(
            json.dumps(report.quarantines, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        if report.quarantines:
            print(json.dumps({"quarantines": report.quarantines}, indent=2, ensure_ascii=False))
    return report


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("questions", type=Path)
    parser.add_argument("image_root", type=Path)
    args = parser.parse_args(argv)
    report = validate_questions(args.questions, args.image_root)
    print(
        f"Validated {report.total} records; quarantines={len(report.quarantines)}; "
        f"failure_rate={report.failure_rate:.2%}; threshold={FAILURE_THRESHOLD:.2%}"
    )
    return 0 if report.passes else 1


if __name__ == "__main__":
    raise SystemExit(main())
