#!/usr/bin/env python3
"""
Enhance practice-test explanations using GPT-4o.

For each question the script sends the full passage, stem, choices, answer,
and current explanation, then asks the model to rewrite the explanation with:
  - Specific textual evidence ("The phrase '...' after the colon tells you...")
  - Clear reasoning for why the correct answer works
  - Specific reasoning for why each wrong answer fails
  - Target: ~150-250 words total per explanation

Usage:
    python3 tools/enhance-explanations.py
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import re
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

API_KEY = os.environ.get("OPENAI_API_KEY", "")
if not API_KEY:
    # Try to load from .env.local
    env_path = Path(__file__).resolve().parent.parent / ".env.local"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("OPENAI_API_KEY="):
                API_KEY = line.split("=", 1)[1].strip()
                break

MODEL = "gpt-4o"
CONCURRENCY = 5  # max parallel requests
DATA_DIR = Path(__file__).resolve().parent.parent / "public" / "data" / "practice-exams"

EXAM_FILES = [
    "cooksat-test-1.json",
    "cooksat-mock-exam-2.json",
    "dsat-june-2026-exam-1.json",
    "dsat-aug-2025-us-v2.json",
]

# Track which questions we've already enhanced (for resumability)
PROGRESS_FILE = Path(__file__).resolve().parent.parent / ".enhance-progress.json"


def load_progress() -> set:
    """Return set of question IDs already enhanced."""
    if PROGRESS_FILE.exists():
        return set(json.loads(PROGRESS_FILE.read_text()))
    return set()


def save_progress(done: set):
    PROGRESS_FILE.write_text(json.dumps(sorted(done)))


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are a expert SAT Reading & Writing tutor. You write clear, helpful explanations \
for practice-test questions. Your explanations teach students both WHY the correct \
answer is right and WHY each wrong answer fails.

RULES:
1. The "summary" field should be 3-5 sentences (~100-150 words). It MUST:
   - Quote or closely reference the specific words/phrases/sentences in the passage \
that point to the answer (e.g. "The phrase 'just one of over ninety' after the colon \
tells you the discoveries are large in number").
   - Explain the reasoning chain: what clue in the text → what it means → why it \
leads to the answer.
   - For Words in Context: quote the surrounding words and explain what meaning they \
demand.
   - For Transitions: identify the ideas before and after the blank and name the \
logical relationship.
   - For Text Structure / Rhetorical Synthesis: outline the text's structure and \
explain how the answer reflects it.

2. Each per-choice explanation should be 1-3 sentences (~20-40 words):
   - For the CORRECT choice: briefly confirm why it fits, referencing the passage.
   - For WRONG choices: explain specifically what meaning/logic it would create and \
why that contradicts or doesn't match the passage. Don't just say "it's wrong."

3. Total length target: ~150-250 words per explanation. Be helpful but concise — \
not a 1000-word essay.

4. Keep the same tone as the originals: direct, second-person where natural, \
no filler phrases like "Let's dive in" or "Great question."

5. Start the correct choice text with "Correct." (matching the existing format).

6. Do NOT include the choice letter in the per-choice text (they're keyed separately).

Return valid JSON with exactly this shape:
{
  "summary": "...",
  "choices": {
    "A": "...",
    "B": "...",
    "C": "...",
    "D": "..."
  }
}
Return ONLY the JSON object, no markdown fences, no extra text."""


def build_user_prompt(question: dict) -> str:
    passage_text = "\n".join(question["passage"])
    choices_text = "\n".join(
        f"  {c['letter']}) {c['text']}" for c in question["choices"]
    )
    current_exp = question.get("explanation", {})
    current_summary = current_exp.get("summary", "(none)") if current_exp else "(none)"
    current_choices = ""
    if current_exp and current_exp.get("choices"):
        current_choices = "\n".join(
            f"  {letter}: {text}"
            for letter, text in current_exp["choices"].items()
        )
    else:
        current_choices = "(none)"

    subtopic = question.get("subtopic", "General")

    return f"""\
QUESTION TYPE: {subtopic}
CORRECT ANSWER: {question.get('answer', '?')}

PASSAGE:
{passage_text}

STEM: {question['stem']}

CHOICES:
{choices_text}

CURRENT EXPLANATION (too brief — enhance it):
Summary: {current_summary}
Per-choice:
{current_choices}

Rewrite this explanation following the rules. Return only the JSON object."""


# ---------------------------------------------------------------------------
# API call with retry
# ---------------------------------------------------------------------------

try:
    from openai import AsyncOpenAI
except ImportError:
    print("ERROR: openai package not installed. Run: pip3 install openai")
    sys.exit(1)

client: AsyncOpenAI | None = None
semaphore: asyncio.Semaphore | None = None


async def enhance_one(question: dict, exam_id: str) -> dict | None:
    """Call GPT-4o and return the enhanced explanation dict, or None on failure."""
    assert client is not None and semaphore is not None

    user_prompt = build_user_prompt(question)
    q_id = f"{exam_id}:{question['id']}"

    for attempt in range(3):
        try:
            async with semaphore:
                response = await asyncio.wait_for(
                    client.chat.completions.create(
                        model=MODEL,
                        temperature=0.3,
                        max_tokens=800,
                        messages=[
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": user_prompt},
                        ],
                    ),
                    timeout=60,
                )
            text = response.choices[0].message.content.strip()

            # Strip markdown fences if present
            if text.startswith("```"):
                text = re.sub(r"^```(?:json)?\s*", "", text)
                text = re.sub(r"\s*```$", "", text)

            result = json.loads(text)

            # Validate structure
            if "summary" not in result or "choices" not in result:
                raise ValueError("Missing summary or choices key")
            if not isinstance(result["choices"], dict):
                raise ValueError("choices is not a dict")

            # Ensure all choice letters are present
            expected_letters = {c["letter"] for c in question["choices"]}
            got_letters = set(result["choices"].keys())
            if not expected_letters.issubset(got_letters):
                missing = expected_letters - got_letters
                raise ValueError(f"Missing choice letters: {missing}")

            return result

        except json.JSONDecodeError as e:
            print(f"  ⚠ {q_id} attempt {attempt+1}: JSON parse error: {e}")
            if attempt < 2:
                await asyncio.sleep(2 ** attempt)
        except Exception as e:
            print(f"  ⚠ {q_id} attempt {attempt+1}: {e}")
            if attempt < 2:
                await asyncio.sleep(2 ** attempt)

    print(f"  ✗ {q_id}: FAILED after 3 attempts, keeping original")
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def process_exam(exam_file: str, done: set) -> int:
    """Process one exam file. Returns count of newly enhanced questions."""
    filepath = DATA_DIR / exam_file
    exam_id = exam_file.replace(".json", "")

    print(f"\n{'='*60}")
    print(f"Processing: {exam_id}")
    print(f"{'='*60}")

    with open(filepath) as f:
        exam = json.load(f)

    # Collect all questions that need enhancement
    tasks = []
    for mod in exam["modules"]:
        for q in mod["questions"]:
            q_id = f"{exam_id}:{q['id']}"
            if q_id in done:
                continue
            if not q.get("explanation"):
                continue
            tasks.append((mod, q, q_id))

    if not tasks:
        print(f"  All questions already enhanced. Skipping.")
        return 0

    print(f"  {len(tasks)} questions to enhance...")

    enhanced_count = 0

    # Process in batches
    for i in range(0, len(tasks), CONCURRENCY):
        batch = tasks[i : i + CONCURRENCY]
        batch_label = f"  Batch {i // CONCURRENCY + 1}/{(len(tasks) + CONCURRENCY - 1) // CONCURRENCY}"
        print(f"{batch_label}: questions {i+1}-{min(i+len(batch), len(tasks))}", flush=True)

        results = await asyncio.gather(
            *[enhance_one(q, exam_id) for _, q, _ in batch]
        )

        for (mod, q, q_id), result in zip(batch, results):
            if result is not None:
                q["explanation"] = result
                done.add(q_id)
                enhanced_count += 1

        # Save progress + exam after each batch
        save_progress(done)
        with open(filepath, "w") as f:
            json.dump(exam, f, indent=2, ensure_ascii=False)
            f.write("\n")

        print(f"  ... {enhanced_count} enhanced so far", flush=True)

        # Small delay between batches
        if i + CONCURRENCY < len(tasks):
            await asyncio.sleep(2)

    print(f"  ✓ Enhanced {enhanced_count}/{len(tasks)} questions in {exam_id}")
    return enhanced_count


async def main():
    global client, semaphore

    if not API_KEY:
        print("ERROR: No OPENAI_API_KEY found in environment or .env.local")
        sys.exit(1)

    client = AsyncOpenAI(api_key=API_KEY)
    semaphore = asyncio.Semaphore(CONCURRENCY)

    done = load_progress()
    print(f"Previously enhanced: {len(done)} questions")

    total_enhanced = 0
    start = time.time()

    for exam_file in EXAM_FILES:
        count = await process_exam(exam_file, done)
        total_enhanced += count

    elapsed = time.time() - start
    print(f"\n{'='*60}")
    print(f"DONE. Enhanced {total_enhanced} questions in {elapsed:.1f}s")
    print(f"{'='*60}")

    # Clean up progress file on successful completion
    if PROGRESS_FILE.exists():
        PROGRESS_FILE.unlink()
        print("Cleaned up progress file.")


if __name__ == "__main__":
    asyncio.run(main())
