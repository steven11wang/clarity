#!/usr/bin/env python3
"""Validate Clarity question data and produce explicit quarantine reports."""

import argparse
import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple


CHOICE_LABELS = ("A", "B", "C", "D")
FAILURE_THRESHOLD = 0.02
QUESTION_SOURCES_FILE = "question-sources.json"


@dataclass
class ValidationReport:
    per_pdf: List[Dict[str, Any]] = field(default_factory=list)
    total: int = 0
    duplicates: List[Dict[str, Any]] = field(default_factory=list)
    figures: List[Dict[str, Any]] = field(default_factory=list)
    quarantines: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def failure_rate(self) -> float:
        if self.total:
            return len(self.quarantines) / self.total
        return 1.0 if self.quarantines else 0.0

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
        question_id = str(record.get("id", "")).strip()
        expected_image = f"/data/images/{question_id}.png"
        image_value = str(record.get("image", "")).strip()
        if image_value != expected_image:
            reasons.append(f"figure image path must be {expected_image}")
        image_path = image_root / f"{question_id}.png"
        if not image_path.is_file():
            reasons.append("figure image does not exist")
    return reasons


def _load_question_sources(
    questions_path: Path, payload: List[Any]
) -> Tuple[Optional[Dict[str, str]], Optional[str]]:
    manifest_path = questions_path.with_name(QUESTION_SOURCES_FILE)
    if questions_path.name.startswith("questions.") and questions_path.suffix == ".json":
        variant = questions_path.name[len("questions") : -len(".json")]
        variant_manifest = questions_path.with_name(f"question-sources{variant}.json")
        # An explicit dataset-specific sidecar overrides the active-data default.
        if variant_manifest.exists():
            manifest_path = variant_manifest
    if not manifest_path.exists():
        return None, None
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if not isinstance(manifest, dict) or set(manifest) != {
            "version",
            "question_sources",
        }:
            raise ValueError("manifest must contain only version and question_sources")
        if manifest["version"] != 1:
            raise ValueError("manifest version must be 1")
        mapping = manifest["question_sources"]
        if not isinstance(mapping, dict) or any(
            not isinstance(question_id, str)
            or not question_id
            or not isinstance(source, str)
            or not source
            for question_id, source in mapping.items()
        ):
            raise ValueError("question_sources must map nonblank IDs to nonblank sources")
        question_ids = [
            record.get("id") if isinstance(record, dict) else None for record in payload
        ]
        if any(not isinstance(question_id, str) or not question_id for question_id in question_ids):
            raise ValueError("questions must have nonblank string IDs")
        if len(question_ids) != len(set(question_ids)):
            raise ValueError("questions must have unique IDs")
        if set(mapping) != set(question_ids):
            raise ValueError("question_sources IDs must exactly match questions")
        return mapping, None
    except Exception as exc:
        return None, f"provenance manifest exception: {type(exc).__name__}: {exc}"


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
        source = str(questions_path)
        report.quarantines.append(
            {
                "question_id": "",
                "source_pdf": source,
                "reasons": [f"JSON exception: {type(exc).__name__}: {exc}"],
            }
        )
        per_pdf[source] = {
            "source_pdf": source,
            "total": 0,
            "valid": 0,
            "duplicates": 0,
            "figures": 0,
            "quarantines": 1,
        }
        payload = []

    report.total = len(payload)
    question_sources, provenance_error = _load_question_sources(questions_path, payload)
    if provenance_error and not payload:
        report.quarantines.append(
            {
                "question_id": "",
                "source_pdf": str(questions_path),
                "reasons": [provenance_error],
            }
        )
    for index, record in enumerate(payload):
        if not isinstance(record, dict):
            source = str(questions_path)
            question_id = ""
            reasons = ["record is not an object"]
        else:
            question_id = str(record.get("id", "")).strip()
            source = (
                question_sources.get(question_id, questions_path.name)
                if question_sources is not None
                else questions_path.name
            )
            reasons = _record_reasons(record, images)
            if provenance_error:
                reasons.append(provenance_error)
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
    parser.add_argument("image_root", nargs="?", type=Path)
    parser.add_argument("--images", type=Path, help="Directory containing figure images")
    args = parser.parse_args(argv)
    image_root = args.images or args.image_root
    if image_root is None:
        parser.error("an image root is required (positional or --images)")
    report = validate_questions(args.questions, image_root)
    print(
        f"Validated {report.total} records; quarantines={len(report.quarantines)}; "
        f"failure_rate={report.failure_rate:.2%}; threshold={FAILURE_THRESHOLD:.2%}"
    )
    return 0 if report.passes else 1


if __name__ == "__main__":
    raise SystemExit(main())
