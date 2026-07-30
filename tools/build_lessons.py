"""Turn the parsed docx lessons into the paged content the app renders.

Writes two files, relative to the repo root you pass in:
  src/content/skillLessonIndex.json   bundled summaries (small)
  public/lessons/skill-lessons.json   fetched article pages (large)

Usage: python3 tools/build_lessons.py <docx> <repo-root>
"""

import json
import os
import re
import sys

from parse_lessons import parse

# Which app skill (as it appears in the question bank) each doc article feeds.
# Command of Evidence is one skill in the bank but two articles in the doc, so
# it becomes one lesson with two parts.
ARTICLE_TO_SKILL = {
    'Command of Evidence: Textual': ('Command of Evidence', 'Information and Ideas'),
    'Command of Evidence: Quantitative': ('Command of Evidence', 'Information and Ideas'),
    'Central Ideas and Details': ('Central Ideas and Details', 'Information and Ideas'),
    'Inferences': ('Inferences', 'Information and Ideas'),
    'Words in Context': ('Words in Context', 'Craft and Structure'),
    'Text Structure and Purpose': ('Text Structure and Purpose', 'Craft and Structure'),
    'Cross-Text Connections': ('Cross-Text Connections', 'Craft and Structure'),
    'Transitions': ('Transitions', 'Expression of Ideas'),
    'Rhetorical Synthesis': ('Rhetorical Synthesis', 'Expression of Ideas'),
    'Form, Structure, and Sense': ('Form, Structure, and Sense', 'Standard English Conventions'),
    'Boundaries': ('Boundaries', 'Standard English Conventions'),
}

PART_TITLE = {
    'Command of Evidence: Textual': 'Part 1 · Textual evidence',
    'Command of Evidence: Quantitative': 'Part 2 · Quantitative evidence',
}

PART_SUBTITLE = {
    'Command of Evidence: Textual':
        'The passage is all words. You pick the quotation or finding that backs the claim.',
    'Command of Evidence: Quantitative':
        'The passage comes with a graph or table. You pick the data point that backs the claim.',
}

# Hand-written framing per skill: the one-sentence job, and the traps that
# cost students the most points. Shown on the lesson cover and the recap.
SKILL_META = {
    'Command of Evidence': {
        'nutshell':
            'You are given a claim and asked which piece of evidence — a quotation, '
            'a research finding, or a data point — most directly supports it.',
        'watchOut': [
            'A choice that is true but proves something slightly different from the claim.',
            'A choice that needs two or three extra assumptions before it supports the claim.',
            'Prompts that ask you to *weaken* or *challenge* the claim instead of support it.',
        ],
        'oneMove':
            'Rewrite the claim as a short test phrase (“sail = faster turns”), then hold every '
            'choice against that phrase.',
    },
    'Central Ideas and Details': {
        'nutshell':
            'You summarize what the passage is mainly about, or locate one stated detail in it.',
        'watchOut': [
            'A choice built from one sentence only, when the question asks for the main idea.',
            'A choice that sounds sophisticated but adds an idea the passage never states.',
            'Confusing the topic (what it is about) with the main idea (what it says about it).',
        ],
        'oneMove':
            'Say the passage back in one plain sentence before you look at a single choice.',
    },
    'Inferences': {
        'nutshell':
            'You finish the passage with the conclusion its own evidence forces — nothing more.',
        'watchOut': [
            'Choices that are reasonable in the real world but unsupported by this passage.',
            'Absolute words — always, never, all, only — that overshoot the evidence.',
            'Choices that reverse the logical direction of the passage.',
        ],
        'oneMove':
            'Cover the choices, predict the ending yourself, then find the choice closest to '
            'your prediction.',
    },
    'Words in Context': {
        'nutshell':
            'You choose the word that fits this sentence most precisely — not merely a word '
            'that is close in meaning.',
        'watchOut': [
            'A word you know that is a synonym in general but wrong in this context.',
            'Ignoring the sentence’s tone: positive, negative, or neutral.',
            'Ignoring transition words like but, however, and therefore, which flip the meaning.',
        ],
        'oneMove':
            'Cover the choices and write your own word in the blank first.',
    },
    'Text Structure and Purpose': {
        'nutshell':
            'You describe what the author is *doing* — the job a sentence or a whole text '
            'performs — not what it says.',
        'watchOut': [
            'Choices that accurately summarize content but name the wrong function.',
            'Choices that describe a different part of the text than the one underlined.',
            'Function verbs that are almost right: “elaborates” when the text “introduces”.',
        ],
        'oneMove':
            'Give the sentence a two-word job label — “introduces problem”, “gives '
            'counterexample” — before reading the choices.',
    },
    'Cross-Text Connections': {
        'nutshell':
            'You read two short texts and work out how the second author would respond to '
            'the first.',
        'watchOut': [
            'Mixing up which author holds which view.',
            'Choices that overstate the disagreement — partial agreement is common.',
            'Choices that describe Text 2 accurately but not as a response to Text 1.',
        ],
        'oneMove':
            'Write a one-line stance for each author before you read the choices.',
    },
    'Transitions': {
        'nutshell':
            'You name the logical relationship between two sentences, then pick the transition '
            'that signals it.',
        'watchOut': [
            'Picking a transition that “sounds smooth” instead of matching the logic.',
            'Treating however / therefore / furthermore as interchangeable.',
            'Ignoring what comes *after* the blank — the relationship runs both ways.',
        ],
        'oneMove':
            'Cover the choices and say the relationship out loud: continue, contrast, cause, '
            'or example.',
    },
    'Rhetorical Synthesis': {
        'nutshell':
            'You are given bullet-point research notes and a goal, and you pick the sentence '
            'that achieves the goal using those notes.',
        'watchOut': [
            'Choices that use the notes accurately but achieve the wrong goal.',
            'Choices that achieve the goal but misstate the notes.',
            'Reading the bullets before the prompt — the goal is what filters everything.',
        ],
        'oneMove':
            'Read the prompt first, underline the goal, and only then read the bullets.',
    },
    'Form, Structure, and Sense': {
        'nutshell':
            'You apply a Standard English rule — subject-verb agreement, verb form, pronouns, '
            'or modifier placement — to pick the correct version.',
        'watchOut': [
            'Words between the subject and the verb that disguise the real subject.',
            'A pronoun with no clear antecedent, or a plural pronoun for a singular noun.',
            'A modifier sitting next to the wrong noun.',
        ],
        'oneMove':
            'Find the subject, strip everything between it and the verb, and read them '
            'side by side.',
    },
    'Boundaries': {
        'nutshell':
            'You decide where one sentence ends and the next begins, then punctuate '
            'that boundary correctly.',
        'watchOut': [
            'Comma splices — two complete sentences joined by a comma alone.',
            'A comma or dash cutting a subject away from its verb.',
            'Choosing punctuation by how it sounds instead of by clause structure.',
        ],
        'oneMove':
            'Label each side of the punctuation as a complete or incomplete sentence '
            'before you choose.',
    },
}

# The source doc's two Standard English Conventions articles are overview-only:
# no worked example, and a "Learn more" page that links out to lessons Clarity
# doesn't host. These authored pages replace that dead end with a rule sheet and
# two practice items so the conventions skills teach as well as the others.
AUTHORED_PAGES = {
    'Boundaries': [
        {
            'id': 'boundaries-worked-example',
            'kicker': 'Worked example',
            'title': 'Watch the three steps run',
            'blocks': [
                {
                    'type': 'lead',
                    'text': 'Here is a boundaries question solved with the approach above.',
                },
                {
                    'type': 'example',
                    'label': 'BOUNDARIES: EXAMPLE',
                    'passage': [
                        'The Antikythera mechanism, recovered from a Greek shipwreck in 1901, '
                        'is often called the first analog computer. Its bronze gears tracked '
                        'the movements of the sun and ______ modern scans have revealed at '
                        'least thirty interlocking wheels inside the corroded shell.',
                    ],
                    'prompt': 'Which choice completes the text so that it conforms to the '
                              'conventions of Standard English?',
                    'choices': {
                        'A': 'moon,',
                        'B': 'moon;',
                        'C': 'moon',
                        'D': 'moon, which',
                    },
                    'answer': 'B',
                    'explanation': [
                        {
                            'type': 'p',
                            'text': 'Step 1: Investigate the blank. The choices only change '
                                    'the punctuation after “moon”, so this is a boundary '
                                    'question, not a word-choice question.',
                        },
                        {
                            'type': 'p',
                            'text': 'Step 2: Find the focus. Test each side. “Its bronze gears '
                                    'tracked the movements of the sun and moon” is a complete '
                                    'sentence. “Modern scans have revealed at least thirty '
                                    'interlocking wheels inside the corroded shell” is also a '
                                    'complete sentence. Two independent clauses means we need '
                                    'punctuation strong enough to separate them.',
                        },
                        {
                            'type': 'p',
                            'text': 'Step 3: Eliminate the obvious errors. Choice A joins two '
                                    'complete sentences with a comma alone — a comma splice. '
                                    'Choice C joins them with nothing at all — a run-on. Choice '
                                    'D starts a relative clause with “which”, but the words '
                                    'that follow already form a complete sentence, so “which” '
                                    'has no job to do.',
                        },
                        {
                            'type': 'p',
                            'text': 'Choice B uses a semicolon, which is exactly strong enough '
                                    'to separate two independent clauses. Choice B is the answer.',
                        },
                    ],
                },
            ],
        },
        {
            'id': 'boundaries-rule-sheet',
            'kicker': 'Rule sheet',
            'title': 'The three jobs punctuation does here',
            'blocks': [
                {
                    'type': 'lead',
                    'text': 'Almost every boundaries question is one of these three jobs. '
                            'Name the job and the rule follows.',
                },
                {'type': 'h4', 'text': '1. Linking two complete sentences'},
                {
                    'type': 'p',
                    'text': 'If both sides of the blank can stand alone, you need a period, a '
                            'semicolon, a colon, or a comma plus a coordinating conjunction '
                            '(for, and, nor, but, or, yet, so). A comma by itself is a comma '
                            'splice — the single most common wrong answer on this skill.',
                },
                {
                    'type': 'li',
                    'text': '✓ The rain stopped. We left.  ✓ The rain stopped; we left.  '
                            '✓ The rain stopped, so we left.',
                },
                {'type': 'li', 'text': '✗ The rain stopped, we left.'},
                {'type': 'h4', 'text': '2. Setting off a supplement'},
                {
                    'type': 'p',
                    'text': 'Non-essential information gets a matched pair of marks: two commas, '
                            'two dashes, or two parentheses. Never mix one kind with another. '
                            'Test it by deleting the supplement — the sentence should still work.',
                },
                {
                    'type': 'li',
                    'text': '✓ Hicks, a printmaker by training, turned to textiles.  '
                            '✗ Hicks, a printmaker by training — turned to textiles.',
                },
                {'type': 'h4', 'text': '3. Not punctuating at all'},
                {
                    'type': 'p',
                    'text': 'A single comma never separates a subject from its verb, or a verb '
                            'from its object. When a choice offers no punctuation, that is often '
                            'because the sentence needs none.',
                },
                {
                    'type': 'li',
                    'text': '✗ The collection of fossils she unearthed, is housed in London.',
                },
                {
                    'type': 'p',
                    'text': 'And remember the top tip above: the SAT never tests style. If two '
                            'choices are grammatically interchangeable — a period and a '
                            'semicolon, say — both must be wrong.',
                },
            ],
        },
        {
            'id': 'boundaries-your-turn',
            'kicker': 'Your turn',
            'title': 'Try one before the quiz',
            'blocks': [
                {
                    'type': 'lead',
                    'text': 'Label each side of the blank complete or incomplete first, then '
                            'choose.',
                },
                {
                    'type': 'example',
                    'label': 'BOUNDARIES: PRACTICE',
                    'passage': [
                        'Marine biologist Ayana Elizabeth Johnson has argued that coastal '
                        'restoration deserves a place in climate ______ mangroves and seagrass '
                        'beds store carbon at rates that rival those of old-growth forests.',
                    ],
                    'prompt': 'Which choice completes the text so that it conforms to the '
                              'conventions of Standard English?',
                    'choices': {
                        'A': 'policy,',
                        'B': 'policy:',
                        'C': 'policy',
                        'D': 'policy, which',
                    },
                    'answer': 'B',
                    'explanation': [
                        {
                            'type': 'p',
                            'text': 'Both sides are complete sentences, and the second one '
                                    'explains why the first is true. A colon is built for '
                                    'exactly that: a complete sentence, then the explanation '
                                    'it sets up.',
                        },
                        {
                            'type': 'p',
                            'text': 'A is a comma splice. C fuses the two sentences with no '
                                    'punctuation. D adds “which”, which would need an '
                                    'incomplete clause after it, not a full sentence. Choice B '
                                    'is the answer.',
                        },
                    ],
                },
            ],
        },
    ],
    'Form, Structure, and Sense': [
        {
            'id': 'fss-worked-example',
            'kicker': 'Worked example',
            'title': 'Watch the three steps run',
            'blocks': [
                {
                    'type': 'lead',
                    'text': 'Here is a form, structure, and sense question solved with the '
                            'approach above.',
                },
                {
                    'type': 'example',
                    'label': 'FORM, STRUCTURE, AND SENSE: EXAMPLE',
                    'passage': [
                        'The collection of fossils that the paleontologist Mary Anning '
                        'unearthed along the crumbling cliffs of Lyme Regis ______ now housed '
                        'in museums across Britain.',
                    ],
                    'prompt': 'Which choice completes the text so that it conforms to the '
                              'conventions of Standard English?',
                    'choices': {
                        'A': 'are',
                        'B': 'is',
                        'C': 'were',
                        'D': 'have been',
                    },
                    'answer': 'B',
                    'explanation': [
                        {
                            'type': 'p',
                            'text': 'Step 1: Investigate the blank. Every choice is a form of '
                                    '“to be”, so the question is about the verb — either its '
                                    'agreement or its tense.',
                        },
                        {
                            'type': 'p',
                            'text': 'Step 2: Find the focus. Three of the four choices are '
                                    'plural and one is singular, so agreement is the focus. '
                                    'Find the subject and strip out everything between it and '
                                    'the verb: “The collection ______ now housed in museums.” '
                                    'The subject is “collection” — singular. “Fossils” is '
                                    'plural, but it sits inside the phrase “of fossils”, and a '
                                    'noun inside a prepositional phrase can never be the '
                                    'subject.',
                        },
                        {
                            'type': 'p',
                            'text': 'Step 3: Eliminate the obvious errors. A, C, and D are all '
                                    'plural verbs, so all three disagree with the singular '
                                    'subject. Only choice B is singular.',
                        },
                        {
                            'type': 'p',
                            'text': 'Choice B is the answer. Notice how the long modifier '
                                    'between subject and verb is doing all the work of the '
                                    'question — that is the trap on nearly every agreement item.',
                        },
                    ],
                },
            ],
        },
        {
            'id': 'fss-rule-sheet',
            'kicker': 'Rule sheet',
            'title': 'The five conventions, with the test for each',
            'blocks': [
                {
                    'type': 'lead',
                    'text': 'Each rule has a fast physical test. Run the test instead of '
                            'trusting your ear.',
                },
                {'type': 'h4', 'text': 'Subject-verb agreement'},
                {
                    'type': 'p',
                    'text': 'Test: cross out everything between the subject and the verb, then '
                            'read them side by side. Prepositional phrases (“of fossils”), '
                            '“that” clauses, and appositives never contain the subject.',
                },
                {'type': 'h4', 'text': 'Pronoun-antecedent agreement'},
                {
                    'type': 'p',
                    'text': 'Test: point to the exact noun the pronoun replaces. Singular noun, '
                            'singular pronoun. Watch “each”, “every”, “either”, and “neither” — '
                            'all singular. A pronoun with no clear antecedent is always wrong.',
                },
                {'type': 'h4', 'text': 'Verb forms'},
                {
                    'type': 'p',
                    'text': 'Test: find another verb in the passage and match its timeline. Use '
                            '“has/have + past participle” for something that started earlier and '
                            'still matters; “had + past participle” for the earlier of two past '
                            'events.',
                },
                {'type': 'h4', 'text': 'Subject-modifier placement'},
                {
                    'type': 'p',
                    'text': 'Test: when a sentence opens with a descriptive phrase, the very '
                            'next noun must be the thing described. “Trained as a printmaker, '
                            'the loom became her tool” fails — the loom was not trained.',
                },
                {'type': 'h4', 'text': 'Plural and possessive nouns'},
                {
                    'type': 'p',
                    'text': 'Test: ask whether the noun owns something. More than one → dogs. '
                            'One owner → dog’s. More than one owner → dogs’. No ownership and '
                            'no plural → dog. Also: “its” is possessive; “it’s” is “it is”.',
                },
            ],
        },
        {
            'id': 'fss-your-turn',
            'kicker': 'Your turn',
            'title': 'Try one before the quiz',
            'blocks': [
                {
                    'type': 'lead',
                    'text': 'Look at what changes from choice to choice, name the convention, '
                            'then choose.',
                },
                {
                    'type': 'example',
                    'label': 'FORM, STRUCTURE, AND SENSE: PRACTICE',
                    'passage': [
                        'Trained as a printmaker in the studios of Yale, ______ to textiles in '
                        'the 1950s and became known for weavings that blur the line between '
                        'craft and fine art.',
                    ],
                    'prompt': 'Which choice completes the text so that it conforms to the '
                              'conventions of Standard English?',
                    'choices': {
                        'A': 'the loom became Sheila Hicks’s primary tool when she turned',
                        'B': 'textiles offered Sheila Hicks a new medium after she turned',
                        'C': 'Sheila Hicks turned',
                        'D': 'it was Sheila Hicks who turned',
                    },
                    'answer': 'C',
                    'explanation': [
                        {
                            'type': 'p',
                            'text': 'The choices rearrange the whole clause rather than change '
                                    'a verb ending, and the sentence opens with a descriptive '
                                    'phrase. That points to subject-modifier placement.',
                        },
                        {
                            'type': 'p',
                            'text': '“Trained as a printmaker” has to describe the noun that '
                                    'comes next. In A that noun is “the loom”; in B it is '
                                    '“textiles”; in D it is “it”. None of those were trained as '
                                    'a printmaker.',
                        },
                        {
                            'type': 'p',
                            'text': 'Only choice C puts Sheila Hicks — the person who actually '
                                    'trained as a printmaker — directly after the modifier. '
                                    'Choice C is the answer.',
                        },
                    ],
                },
            ],
        },
    ],
}

# Pages whose only content is a list of links to lessons Clarity doesn't host.
DROPPED_PAGE_TITLES = {'Learn more'}

SLUG_STRIP = re.compile(r'[^a-z0-9]+')


def slug(text):
    return SLUG_STRIP.sub('-', text.lower()).strip('-')


def normalize_example(block):
    """Drop empty fields and turn non-multiple-choice blocks into callouts."""
    if block['prompt'] and block['choices'] and block['answer']:
        example = {
            'type': 'example',
            'passage': block['passage'],
            'prompt': block['prompt'],
            'choices': block['choices'],
            'answer': block['answer'],
            'explanation': [b for b in block['explanation'] if b['text'] != 'Answer explanation:'],
        }
        if block['label']:
            example['label'] = block['label']
        if block['figure']:
            example['figure'] = block['figure']
        if block['table']:
            example['table'] = block['table']
        if block['notes']:
            example['notes'] = block['notes']
        return example

    lines = list(block['passage'])
    if block['prompt']:
        lines.append(block['prompt'])
    callout = {'type': 'callout', 'lines': lines}
    if block['label']:
        callout['label'] = block['label']
    if block['notes']:
        callout['notes'] = block['notes']
    if block['table']:
        callout['table'] = block['table']
    if block['figure']:
        callout['figure'] = block['figure']
    if block['explanation']:
        callout['lines'] = lines + [b['text'] for b in block['explanation']]
    return callout


def pages_from_sections(sections):
    """One page per Heading 3. Prose before the first Heading 3 opens the page."""
    pages = []
    current = None

    for section in sections:
        kicker = {
            'LESSON': 'Lesson',
            'TOP TIPS': 'Top tips',
            'OVERVIEW': 'Lesson',
        }.get(section['title'], section['title'].replace('SUB-LESSON: ', 'Deep dive · '))
        pending = []

        for block in section['blocks']:
            if block['type'] == 'h3':
                current = {
                    'id': slug(f"{kicker}-{block['text']}"),
                    'kicker': kicker,
                    'title': block['text'],
                    'blocks': pending,
                }
                pending = []
                pages.append(current)
                continue

            rendered = (
                normalize_example(block) if block['type'] == 'example' else dict(block)
            )
            if current is None:
                pending.append(rendered)
            else:
                current['blocks'].append(rendered)

        if pending and current is not None:
            current['blocks'].extend(pending)

    return [
        page
        for page in pages
        if page['blocks'] and page['title'] not in DROPPED_PAGE_TITLES
    ]


GENERAL_TIPS_TITLE = 'General SAT Reading and Writing top tips'


def build(articles):
    lessons = {}
    general_tips = []
    for article in articles:
        mapping = ARTICLE_TO_SKILL.get(article['title'])
        if mapping is None:
            raise SystemExit(f"Unmapped article: {article['title']}")
        skill, domain = mapping
        lesson = lessons.get(skill)
        if lesson is None:
            meta = SKILL_META[skill]
            lesson = {
                'skill': skill,
                'domain': domain,
                'unit': article['unit'],
                'nutshell': meta['nutshell'],
                'oneMove': meta['oneMove'],
                'watchOut': meta['watchOut'],
                'promptSamples': [],
                'parts': [],
            }
            lessons[skill] = lesson

        pages = pages_from_sections(article['sections'])

        # The four general tips are identical in every article. Hoist them into
        # one shared closing page so a student doesn't reread them ten times.
        kept = []
        for page in pages:
            if page['title'] == GENERAL_TIPS_TITLE:
                if not general_tips:
                    general_tips.extend(page['blocks'])
                continue
            kept.append(page)
        pages = kept

        for authored in AUTHORED_PAGES.get(skill, []):
            if not any(page['id'] == authored['id'] for page in pages):
                pages.append(json.loads(json.dumps(authored)))

        part = {
            'id': slug(article['title']),
            'title': PART_TITLE.get(article['title'], article['title']),
            'pages': pages,
        }
        subtitle = PART_SUBTITLE.get(article['title'])
        if subtitle:
            part['subtitle'] = subtitle
        lesson['parts'].append(part)

        for page in pages:
            for block in page['blocks']:
                if block['type'] == 'example' and block['prompt'] not in lesson['promptSamples']:
                    lesson['promptSamples'].append(block['prompt'])

    ordered = []
    for skill in [
        'Command of Evidence',
        'Central Ideas and Details',
        'Inferences',
        'Words in Context',
        'Text Structure and Purpose',
        'Cross-Text Connections',
        'Transitions',
        'Rhetorical Synthesis',
        'Form, Structure, and Sense',
        'Boundaries',
    ]:
        lesson = lessons[skill]
        lesson['promptSamples'] = lesson['promptSamples'][:4]
        ordered.append(lesson)
    return {'generalTips': general_tips, 'lessons': ordered}


def write(path, payload):
    with open(path, 'w', encoding='utf-8') as handle:
        json.dump(payload, handle, indent=1, ensure_ascii=False)
        handle.write('\n')


def main():
    src, root = sys.argv[1], sys.argv[2].rstrip('/')
    content = build(parse(src))

    # Two files on purpose. The index is small and bundled with the app, so the
    # skill path can render "has a lesson" and the whole lesson cover with zero
    # latency. The pages carry ~200 KB of article text and are served as a
    # static asset that's fetched when a lesson opens — same pattern as the
    # question bank, and it keeps them out of the initial bundle.
    index = [
        {
            'skill': lesson['skill'],
            'domain': lesson['domain'],
            'unit': lesson['unit'],
            'nutshell': lesson['nutshell'],
            'oneMove': lesson['oneMove'],
            'watchOut': lesson['watchOut'],
            'promptSamples': lesson['promptSamples'],
            'partTitles': [part['title'] for part in lesson['parts']],
            # +1 for the shared general-tips step the pager appends.
            'stepCount': sum(len(part['pages']) for part in lesson['parts']) + 1,
        }
        for lesson in content['lessons']
    ]
    pages = {
        'generalTips': content['generalTips'],
        'parts': {
            lesson['skill']: lesson['parts'] for lesson in content['lessons']
        },
    }

    os.makedirs(f'{root}/public/lessons', exist_ok=True)
    write(f'{root}/src/content/skillLessonIndex.json', index)
    write(f'{root}/public/lessons/skill-lessons.json', pages)

    for lesson in content['lessons']:
        pages = sum(len(part['pages']) for part in lesson['parts'])
        examples = sum(
            1
            for part in lesson['parts']
            for page in part['pages']
            for block in page['blocks']
            if block['type'] == 'example'
        )
        print(
            f"{lesson['skill']:<30} parts={len(lesson['parts'])} "
            f"pages={pages:<3} examples={examples}"
        )


if __name__ == '__main__':
    main()
