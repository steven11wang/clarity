"""Parse the SAT Reading & Writing Foundations docx into structured lesson JSON.

Usage: python3 tools/parse_lessons.py <docx> <out.json>
"""

import json
import re
import sys

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph


def iter_body(doc):
    """Yield paragraphs and tables in document order."""
    body = doc.element.body
    for child in body.iterchildren():
        tag = child.tag.split('}')[-1]
        if tag == 'p':
            yield Paragraph(child, doc)
        elif tag == 'tbl':
            yield Table(child, doc)


def split_choices(text):
    """Split 'A. foo B. bar C. baz D. qux' into a dict."""
    marks = []
    for letter in 'ABCD':
        pattern = re.compile(r'(?:^|(?<=[\s”"\'\)\.]))' + letter + r'\.\s')
        best = None
        for match in pattern.finditer(text):
            if not marks or match.start() > marks[-1][1]:
                best = match
                break
        if best is None:
            return None
        marks.append((letter, best.start(), best.end()))
    out = {}
    for index, (letter, _start, end) in enumerate(marks):
        stop = marks[index + 1][1] if index + 1 < len(marks) else len(text)
        out[letter] = text[end:stop].strip()
    return out


CAPS_LABEL = re.compile(r'^[A-Z0-9 :,&\'’/()-]{6,}$')
ANSWER = re.compile(r'^ANSWER:\s*([A-D])', re.IGNORECASE)


def _compact_is_inside_run(items, index):
    """True when a Compact bullet sits between two Block Text nodes.

    Rhetorical Synthesis stimuli embed their research notes as Compact
    bullets in the middle of the Block Text run; trailing Compact bullets
    after the choices belong to the explanation instead.
    """
    for node in items[index:]:
        kind = node.get('kind')
        if kind == 'Block Text':
            return True
        if kind != 'Compact':
            return False
    return False


def parse(path):
    doc = Document(path)
    items = []
    for node in iter_body(doc):
        if isinstance(node, Table):
            rows = [[cell.text.strip() for cell in row.cells] for row in node.rows]
            items.append({'kind': 'table', 'rows': rows})
            continue
        text = node.text.strip()
        if not text:
            continue
        items.append({'kind': node.style.name, 'text': text})

    skills = []
    current = None
    section = None

    def new_section(title, style):
        return {'title': title, 'style': style, 'blocks': []}

    index = 0
    while index < len(items):
        item = items[index]
        kind = item.get('kind')

        if kind == 'Heading 1':
            title = item['text']
            match = re.match(r'^(\d+)\.\s*(.+)$', title)
            if not match:
                index += 1
                continue
            current = {
                'number': int(match.group(1)),
                'title': match.group(2).strip(),
                'unit': None,
                'sections': [],
            }
            skills.append(current)
            section = None
            index += 1
            continue

        if current is None:
            index += 1
            continue

        if kind == 'Heading 2':
            section = new_section(item['text'], 'h2')
            current['sections'].append(section)
            index += 1
            continue

        if kind in ('Heading 3', 'Heading 4'):
            if section is None:
                section = new_section('LESSON', 'h2')
                current['sections'].append(section)
            section['blocks'].append({
                'type': 'h3' if kind == 'Heading 3' else 'h4',
                'text': item['text'],
            })
            index += 1
            continue

        if section is None:
            if current['unit'] is None and item.get('text', '').startswith('Unit'):
                current['unit'] = item['text']
                index += 1
                continue
            section = new_section('LESSON', 'h2')
            current['sections'].append(section)

        # --- Example block: a run of Block Text / table nodes -----------------
        if kind == 'Block Text':
            run = []
            while index < len(items):
                nkind = items[index].get('kind')
                if nkind in ('Block Text', 'table'):
                    run.append(items[index])
                    index += 1
                elif nkind == 'Compact' and _compact_is_inside_run(items, index):
                    # Bulleted research notes embedded in a question stimulus.
                    run.append(items[index])
                    index += 1
                else:
                    break

            example = {
                'type': 'example',
                'label': None,
                'figure': None,
                'table': None,
                'notes': [],
                'passage': [],
                'prompt': None,
                'choices': None,
                'answer': None,
                'explanation': [],
            }

            lines = []
            for node in run:
                if node['kind'] == 'table':
                    example['table'] = node['rows']
                elif node['kind'] == 'Compact':
                    example['notes'].append(node['text'])
                else:
                    lines.append(node['text'])

            if lines and CAPS_LABEL.match(lines[0]) and 'Choose 1' not in lines[0]:
                example['label'] = lines.pop(0)

            choose_at = next(
                (i for i, line in enumerate(lines) if line.lower().startswith('choose 1 answer')),
                None,
            )
            if choose_at is not None:
                if choose_at + 1 < len(lines):
                    example['choices'] = split_choices(lines[choose_at + 1])
                if choose_at > 0:
                    example['prompt'] = lines[choose_at - 1]
                body = lines[:max(0, choose_at - 1)]
            else:
                body = lines

            for line in body:
                if line.startswith('[') and example['figure'] is None:
                    example['figure'] = line.strip('[]')
                else:
                    example['passage'].append(line)

            # Answer + explanation follow the block run.
            if index < len(items):
                match = ANSWER.match(items[index].get('text', ''))
                if match:
                    example['answer'] = match.group(1).upper()
                    index += 1

            while index < len(items):
                nxt = items[index]
                nkind = nxt.get('kind')
                if nkind in ('Heading 1', 'Heading 2', 'Heading 3', 'Heading 4', 'Block Text', 'table'):
                    break
                text = nxt['text']
                if re.match(r'^Example\b', text) and len(text) < 24:
                    break
                example['explanation'].append({
                    'type': 'li' if nkind == 'Compact' else 'p',
                    'text': text,
                })
                index += 1

            section['blocks'].append(example)
            continue

        # --- Plain prose ------------------------------------------------------
        block_type = {
            'Compact': 'li',
            'First Paragraph': 'lead',
            'Body Text': 'p',
        }.get(kind, 'p')
        section['blocks'].append({'type': block_type, 'text': item['text']})
        index += 1

    return skills


def main():
    src, dest = sys.argv[1], sys.argv[2]
    skills = parse(src)
    with open(dest, 'w', encoding='utf-8') as handle:
        json.dump(skills, handle, indent=2, ensure_ascii=False)
    for skill in skills:
        examples = sum(
            1
            for section in skill['sections']
            for block in section['blocks']
            if block['type'] == 'example'
        )
        print(
            f"{skill['number']:>2}. {skill['title']:<40} "
            f"sections={len(skill['sections'])} examples={examples}"
        )


if __name__ == '__main__':
    main()
