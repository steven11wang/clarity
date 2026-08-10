# Reading/Writing Export Repair

## Goal

Repair `exam_questions_reading_writing.md` so every one of the 54 Reading/Writing questions contains the loaded question content and choices, without browser-interface text.

## Scope

- Re-capture Reading/Writing Modules 1 and 2 only; exclude all Math content.
- Wait for each question number and its content to change before recording a screen.
- Keep passages, prompts, answer choices, correct-answer markers, blanks, punctuation, and question labels.
- Remove site chrome, including timers, navigation buttons, review controls, feedback links, and test headers.
- Preserve the source topic and subtopic labels.
- Replace any `Experimental` difficulty with a single human judgment: `Easy`, `Medium`, or `Hard`.

## Output and validation

The existing Markdown file is overwritten in place. Validation will confirm 54 question headings, no timer/interface text, no `Experimental` labels, and nonempty prompt/choice content for every question.
