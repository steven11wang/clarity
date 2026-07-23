#!/usr/bin/env python3
"""Build the active practice dataset: up to N questions per (difficulty, skill).

Usage:
    python3 build_sample.py <full_corpus_dir> <output_dir> [per_leaf]

Reads <full_corpus_dir>/questions.json (the full parsed corpus) and writes a
curated sample of up to `per_leaf` questions (default 10) for every
difficulty x skill leaf into <output_dir>/questions.json, along with the
matching provenance sidecar and the figure images those questions need. Leaves
with fewer than `per_leaf` questions in the corpus contribute all they have.
"""
import json
import shutil
import sys
from collections import defaultdict
from pathlib import Path


def build(full_dir: Path, out_dir: Path, per_leaf: int = 10) -> None:
    full = json.loads((full_dir / "questions.json").read_text())
    sources = json.loads((full_dir / "question-sources.json").read_text())["question_sources"]

    leaves = defaultdict(list)
    for question in full:
        leaves[(question["difficulty"], question["skill"])].append(question)

    sample = []
    short = []
    for key, questions in sorted(leaves.items()):
        questions.sort(key=lambda q: q["id"])
        picked = questions[:per_leaf]
        sample.extend(picked)
        if len(picked) < per_leaf:
            short.append((key, len(picked)))

    def sidecar(questions):
        return {"version": 1, "question_sources": {q["id"]: sources.get(q["id"], "") for q in questions}}

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "questions.json").write_text(json.dumps(sample, indent=2, ensure_ascii=False) + "\n")
    (out_dir / "questions.sample.json").write_text(json.dumps(sample, indent=2, ensure_ascii=False) + "\n")
    (out_dir / "question-sources.json").write_text(json.dumps(sidecar(sample), indent=2, ensure_ascii=False) + "\n")
    (out_dir / "question-sources.sample.json").write_text(json.dumps(sidecar(sample), indent=2, ensure_ascii=False) + "\n")
    (out_dir / "questions.full.json").write_text(json.dumps(full, indent=2, ensure_ascii=False) + "\n")
    (out_dir / "question-sources.full.json").write_text(json.dumps(sidecar(full), indent=2, ensure_ascii=False) + "\n")

    image_out = out_dir / "images"
    image_out.mkdir(exist_ok=True)
    copied = 0
    for question in sample:
        if question.get("has_figure"):
            source_image = full_dir / "images" / f"{question['id']}.png"
            if source_image.exists():
                shutil.copy2(source_image, image_out / f"{question['id']}.png")
                copied += 1

    print(f"sample={len(sample)} across {len(leaves)} leaves; images={copied}; under {per_leaf}: {short}")


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) < 2:
        raise SystemExit(__doc__)
    build(Path(args[0]), Path(args[1]), int(args[2]) if len(args) > 2 else 10)
