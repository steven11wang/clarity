#!/usr/bin/env python3
"""Turn Anki .apkg vocabulary decks into the JSON the Words section loads.

An .apkg is a zip holding collection.anki2, a SQLite database. Every note in
these decks is a Basic card whose fields are separated by U+001F: field 0 is
the word, field 1 is the definition. Nothing else in the package is used - the
scheduling in the original collection is discarded, because Clarity keeps its
own review state per learner in local storage.

Usage:
    python3 tools/build_word_decks.py \
        --deck core:"Clarity All-Around Words":"/path/SAT 360 Core Words.apkg" \
        --deck longshot:"Clarity Long-Shot Words":"/path/SAT 60 Low-Priority Words.apkg" \
        --out public/data/word-decks.json
"""

import argparse
import json
import os
import re
import sqlite3
import sys
import tempfile
import zipfile

FIELD_SEPARATOR = "\x1f"


def slugify(word):
    return re.sub(r"[^a-z0-9]+", "-", word.lower()).strip("-")


def strip_html(value):
    value = re.sub(r"<br\s*/?>", " ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", "", value)
    value = value.replace("&nbsp;", " ").replace("&amp;", "&")
    return re.sub(r"\s+", " ", value).strip()


def read_notes(apkg_path):
    with tempfile.TemporaryDirectory() as work:
        with zipfile.ZipFile(apkg_path) as archive:
            archive.extract("collection.anki2", work)
        connection = sqlite3.connect(os.path.join(work, "collection.anki2"))
        try:
            rows = list(connection.execute("SELECT id, flds FROM notes ORDER BY id"))
        finally:
            connection.close()
    return rows


def build_deck(deck_id, title, apkg_path):
    cards = []
    seen = set()
    for note_id, fields in read_notes(apkg_path):
        parts = fields.split(FIELD_SEPARATOR)
        if len(parts) < 2:
            raise SystemExit(f"{apkg_path}: note {note_id} has {len(parts)} field(s), expected 2")
        word = strip_html(parts[0])
        definition = strip_html(parts[1])
        if not word or not definition:
            raise SystemExit(f"{apkg_path}: note {note_id} is missing a word or definition")
        card_id = f"{deck_id}:{slugify(word)}"
        if card_id in seen:
            raise SystemExit(f"{apkg_path}: duplicate word {word!r}")
        seen.add(card_id)
        cards.append({"id": card_id, "word": word, "definition": definition})
    return {"id": deck_id, "title": title, "cards": cards}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--deck",
        action="append",
        required=True,
        metavar="ID:TITLE:PATH",
        help="deck id, display title, and .apkg path, colon separated",
    )
    parser.add_argument("--out", required=True, help="where to write the JSON")
    args = parser.parse_args()

    decks = []
    for spec in args.deck:
        deck_id, title, path = spec.split(":", 2)
        decks.append(build_deck(deck_id, title, path))

    payload = {"version": 1, "decks": decks}
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    for deck in decks:
        print(f"{deck['id']}: {len(deck['cards'])} cards -> {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
