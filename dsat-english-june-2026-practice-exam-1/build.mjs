/* Assembles a 2 x 27 DSAT Reading & Writing practice exam from the June 2026 bank.
   Run: node build.mjs   (regenerates the .md and everything under assets/) */
import fs from 'node:fs';
import path from 'node:path';

const BANK = '/Users/s/Desktop/clarity/dsat-english-june-2026-int-us-bank/raw/bank-717-raw.json';
const BANK_ASSETS = '/Users/s/Desktop/clarity/dsat-english-june-2026-int-us-bank/assets';
const OUT_DIR = '/Users/s/Desktop/clarity/dsat-english-june-2026-practice-exam-1';
const ASSET_DIR = path.join(OUT_DIR, 'assets');
fs.rmSync(ASSET_DIR, { recursive: true, force: true });
fs.mkdirSync(ASSET_DIR, { recursive: true });

const data = JSON.parse(fs.readFileSync(BANK, 'utf8'));

/* ---------------- HTML -> Markdown (same rules as the bank file) ---------------- */
const ENT = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&nbsp;': ' ', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…',
  '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”',
};
const decode = (s) => s.replace(/&[a-z#0-9]+;/gi, (m) => ENT[m] ?? m);
function inline(html) {
  let s = html;
  s = s.replace(/<em>([\s\S]*?)<\/em>/gi, (_, t) => `*${t.trim()}*`);
  s = s.replace(/<strong>([\s\S]*?)<\/strong>/gi, (_, t) => `**${t.trim()}**`);
  s = s.replace(/<span[^>]*>/gi, '').replace(/<\/span>/gi, '');
  return decode(s).replace(/[ \t]+/g, ' ').trim();
}
const cellText = (h) => inline(h.replace(/<br\s*\/?>/gi, ' ')).replace(/\|/g, '\\|').trim();
function tableToMd(tableHtml) {
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
    [...m[1].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi)].map((c) => cellText(c[2]))
  );
  if (!rows.length) return '';
  const thead = /<thead[\s\S]*?<\/thead>/i.exec(tableHtml);
  const headCount = thead ? ([...thead[0].matchAll(/<tr[^>]*>/gi)].length || 1) : 1;
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r) => { const c = r.slice(); while (c.length < width) c.push(''); return c; };
  const head = rows.slice(0, headCount).map(pad);
  const body = rows.slice(headCount).map(pad);
  const header = head.length > 1
    ? head[0].map((_, i) => head.map((h) => h[i]).filter(Boolean).join(' '))
    : head[0];
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
}

function passageToMd(html, assetBase, notes) {
  const parts = [];
  const re = /(<figure[\s\S]*?<\/figure>|<section[^>]*>[\s\S]*?<\/section>)/gi;
  let last = 0, m;
  while ((m = re.exec(html))) {
    if (m.index > last) parts.push({ type: 'html', v: html.slice(last, m.index) });
    parts.push({ type: 'fig', v: m[0] });
    last = m.index + m[0].length;
  }
  if (last < html.length) parts.push({ type: 'html', v: html.slice(last) });

  const blocks = [];
  for (const part of parts) {
    if (part.type === 'fig') {
      const capM = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i.exec(part.v) || /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(part.v);
      const caption = capM ? cellText(capM[1]) : '';
      const svgM = /<svg[\s\S]*?<\/svg>/i.exec(part.v);
      const tblM = /<table[\s\S]*?<\/table>/i.exec(part.v);
      if (svgM) {
        const file = `${assetBase}-figure.svg`;
        fs.writeFileSync(path.join(ASSET_DIR, file), svgM[0].replace(/<svg /i, '<svg xmlns="http://www.w3.org/2000/svg" ') + '\n');
        notes.push({ file, kind: 'captured' });
        blocks.push(`**${caption}**\n\n![${caption}](assets/${file})`);
      } else if (tblM) {
        blocks.push(`**${caption}**\n\n${tableToMd(tblM[0])}`);
      } else if (/<div/i.test(part.v)) {
        fs.copyFileSync(path.join(BANK_ASSETS, 'question-125-figure-recreated.svg'),
          path.join(ASSET_DIR, `${assetBase}-figure-recreated.svg`));
        notes.push({ file: `${assetBase}-figure-recreated.svg`, kind: 'recreated' });
        blocks.push(`**${caption}**\n\n![${caption}](assets/${assetBase}-figure-recreated.svg)\n\n> *Graphic redrawn as SVG — the source page builds this chart from CSS \`<div>\` bars, so there was no image to capture. Values and labels are taken verbatim from the page markup.*`);
      }
      continue;
    }
    const s = part.v.replace(/<style[\s\S]*?<\/style>/gi, '');
    for (const p of s.split(/<\/p>/i).map((x) => x.replace(/<p[^>]*>/gi, '')).filter((x) => x.trim())) {
      if (/•/.test(p)) {
        const lines = p.split(/<br\s*\/?>/i).map((x) => inline(x)).filter(Boolean);
        blocks.push(lines.map((l) => (l.startsWith('•') ? `- ${l.replace(/^•\s*/, '')}` : l)).join('\n'));
      } else {
        const t = inline(p.replace(/<br\s*\/?>/gi, '\n'));
        if (t) blocks.push(t);
      }
    }
  }
  return blocks.filter(Boolean).join('\n\n');
}

/* ---------------- classify bank categories into official domains ---------------- */
const CS = 'Craft and Structure', II = 'Information and Ideas',
      SEC = 'Standard English Conventions', EOI = 'Expression of Ideas';

const SUBTYPE = {
  'Domain 2 | Words in Context': [CS, 'Words in Context'],
  'Domain 2 | Logical Completion': [CS, 'Words in Context'],
  'Domain 2 | Structure': [CS, 'Text Structure and Purpose'],
  'Domain 2 | Purpose': [CS, 'Text Structure and Purpose'],
  'Domain 2 | Function of Underlined Portion': [CS, 'Text Structure and Purpose'],
  'Domain 2 | Cross Text Connections': [CS, 'Cross-Text Connections'],
  'Domain 2 | Author Response': [CS, 'Cross-Text Connections'],
  'Domain 1 | Main Idea': [II, 'Central Ideas and Details'],
  'Domain 1 | Major Detail': [II, 'Central Ideas and Details'],
  'Domain 1 | Illustrate the Claim': [II, 'Command of Evidence: Textual'],
  'Domain 1 | Support': [II, 'Command of Evidence: Textual'],
  'Domain 1 | Weaken': [II, 'Command of Evidence: Textual'],
  'Domain 1 | Graph': [II, 'Command of Evidence: Quantitative'],
  'Domain 1 | Data Completes a Statement': [II, 'Command of Evidence: Quantitative'],
  'Domain 1 | Logical Conclusion': [II, 'Inferences'],
  'Domain 1 | Inference': [II, 'Inferences'],
};
const BOUNDARIES = /Introducing a List|Two Independent Clauses|Dependent \+ Independent|Supplementary Elements|Items in a Series|No Punctuation Needed|Restrictive vs Nonrestrictive/;

function classify(cats) {
  const leaf = (cats || []).slice(-1)[0] || '';
  if (SUBTYPE[leaf]) return SUBTYPE[leaf];
  if (leaf.startsWith('Domain 4')) return [SEC, BOUNDARIES.test(leaf) ? 'Boundaries' : 'Form, Structure, and Sense'];
  if (leaf.startsWith('Domain 3 | Transitions')) return [EOI, 'Transitions'];
  if (leaf.startsWith('Domain 3 | Notes')) return [EOI, 'Rhetorical Synthesis'];
  return [II, 'Central Ideas and Details'];
}

/* Items the bank's own "appeared_in" marks as reused on an administration that is
   already a separate practice exam in the app. The near-duplicate guard below only
   compares against items chosen for THIS form, so it cannot catch these. The Anna
   Seward verb-forms family (212116/212136/212176) is the whole August 2025 US
   Version 2 overlap; excluding it costs the form one Hard Form/Structure slot,
   which falls back to Intermediate because the bank has no other Hard item there. */
const CROSS_EXAM_EXCLUDE = new Set([212116, 212136, 212176]);

const pool = [];
for (const p of data.items) {
  for (const q of p.questions) {
    if (CROSS_EXAM_EXCLUDE.has(q.id)) continue;
    const [domain, sub] = classify(q.cats);
    pool.push({
      sort: +p.sort, passage: p.passage, title: p.title, cats: q.cats,
      difficulty: q.difficulty, content: q.content, answers: q.answers,
      passageId: p.id, questionId: q.id, domain, sub,
      hasFigure: /<figure|<table|<svg/i.test(p.passage),
    });
  }
}

/* ---------------- near-duplicate guard ----------------------------------------
   The bank ships "variation" families: one item template re-skinned with different
   names or subjects (Anna Seward / Ann Batten Cristall; Canteen Co-op / Artes
   Graficas Chilavert). Those clones carry distinct question ids, so uniqueness by
   id alone still lets two of them into the same exam. Compare content token sets
   and refuse any candidate too close to something already selected. */
const STOP = new Set(('the a an and or of to in for on with that which as is are was were be been by from at ' +
  'it its this these those their his her they them not but has have had can could would should also more than ' +
  'choice text most best completes conventions standard english following student notes researching topic ' +
  'wants use goal accomplish effectively relevant information').split(' '));
const tokens = (q) => new Set(
  ((q.passage + ' ' + q.content + ' ' + q.answers.join(' '))
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase()
    .match(/[a-z][a-z'’-]{2,}/g) || []).filter((w) => !STOP.has(w))
);
pool.forEach((q) => { q.tok = tokens(q); });
function jaccard(a, b) {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}
const DUP_THRESHOLD = 0.4;

const used = new Set();
const taken = [];
const cloneOf = (q) => {
  let worst = null;
  for (const t of taken) {
    const j = jaccard(q.tok, t.tok);
    if (j > DUP_THRESHOLD && (!worst || j > worst.j)) worst = { j, t };
  }
  return worst;
};

/* ---------------- blueprint ---------------- */
// per slot: [domain, subtype, module-1 difficulty ramp, module-2 difficulty ramp]
const E = 'Easy', I2 = 'Intermediate', H = 'Hard';
const BLUEPRINT = [
  [CS, 'Words in Context', [E, E, I2, I2], [I2, I2, H, H]],
  [CS, 'Text Structure and Purpose', [E, I2], [I2, H]],
  [CS, 'Cross-Text Connections', [I2], [H]],
  [II, 'Central Ideas and Details', [E, I2], [E, I2]],
  [II, 'Command of Evidence: Textual', [I2, H], [I2, H]],
  [II, 'Command of Evidence: Quantitative', [E, I2], [I2, H]],
  [II, 'Inferences', [H], [H]],
  [SEC, 'Boundaries', [E, E, I2, H], [I2, I2, H, H]],
  [SEC, 'Form, Structure, and Sense', [E, I2, I2, H], [I2, H, H, H]],
  [EOI, 'Transitions', [E, I2, H], [E, H, H]],
  [EOI, 'Rhetorical Synthesis', [E, I2], [I2, H]],
];

// figure-bearing items pinned to quantitative slots so each module carries graphics
const PINNED = {
  1: { 'Command of Evidence: Quantitative': [51, 73] },   // table (Easy) + captured SVG chart
  2: { 'Command of Evidence: Quantitative': [125, 48] },  // recreated SVG chart + table (Hard)
};
const LADDER = { Easy: [E, I2, H], Intermediate: [I2, E, H], Hard: [H, I2, E] };

/* Exact item forced into one blueprint slot, by [module][subtype][index-within-slot].
   Used to hold question numbering stable: dropping the excluded Anna Seward item
   would otherwise let the natural fallback shift every later item in the block up
   one position, and saved attempts key their answers to `module-N-qNN`. */
const SLOT_OVERRIDE = {
  2: { 'Form, Structure, and Sense': { 2: 212106 } },
};
const rejected = [];

function pickModule(mod) {
  const out = [];
  for (const slot of BLUEPRINT) {
    const [domain, sub] = slot;
    const targets = slot[mod === 1 ? 2 : 3];
    const pins = (PINNED[mod][sub] || []).slice();
    for (const [ti, target] of targets.entries()) {
      let q = null;
      const forced = SLOT_OVERRIDE[mod]?.[sub]?.[ti];
      if (forced) {
        q = pool.find((x) => x.questionId === forced && !used.has(x.questionId));
        if (!q) throw new Error(`slot override ${forced} unavailable for ${sub} in module ${mod}`);
      }
      const pinIdx = q ? -1 : pins.findIndex((s) => {
        const c = pool.find((x) => x.sort === s && !used.has(x.questionId));
        return c && c.difficulty === target && !cloneOf(c);
      });
      if (pinIdx > -1) {
        q = pool.find((x) => x.sort === pins[pinIdx] && !used.has(x.questionId));
        pins.splice(pinIdx, 1);
      }
      if (!q) {
        const avail = pool.filter((x) => !used.has(x.questionId) && x.domain === domain && x.sub === sub);
        outer: for (const d of LADDER[target]) {
          const cands = avail.filter((x) => x.difficulty === d)
            .sort((a, b) => (a.hasFigure === b.hasFigure ? a.sort - b.sort : a.hasFigure ? 1 : -1));
          for (const c of cands) {
            const dup = cloneOf(c);
            if (dup) { rejected.push({ id: c.questionId, sub, j: +dup.j.toFixed(2), against: dup.t.questionId }); continue; }
            q = c; break outer;
          }
        }
      }
      if (!q) throw new Error(`no non-duplicate candidate left for ${sub} (${target}) in module ${mod}`);
      used.add(q.questionId);
      taken.push(q);
      out.push(q);
    }
  }
  return out;
}

const modules = [pickModule(1), pickModule(2)];

/* ---------------- render ---------------- */
const LETTERS = ['A', 'B', 'C', 'D'];
const L = [];
const figures = [];

L.push('# DSAT English — Practice Exam 1 (built from the June 2026 Int + US question bank)');
L.push('');
L.push('**Section:** Reading and Writing  ');
L.push('**Format:** 2 modules × 27 questions = 54 questions  ');
L.push('**Timing:** 32 minutes per module (64 minutes total)  ');
L.push('**Source bank:** DSAT English | June 2026 | Int and US | Question Bank ALL (test id 717) — https://thetestadvantage.com/public/passage-page/717  ');
L.push(`**Assembled:** ${new Date().toISOString().slice(0, 10)}`);
L.push('');
L.push('Questions run in official Digital SAT Reading and Writing order — Craft and Structure, then Information and Ideas, then Standard English Conventions, then Expression of Ideas — with easier items early in each domain block. Module 1 is the mixed-difficulty routing module; Module 2 is the harder upper module, as on an adaptive form.');
L.push('');
L.push('Each item keeps the difficulty badge the source site displays, the site question id (so it can be traced back to the bank file), underlines as `<u>...</u>`, and bullet note-sets as lists. **Answer keys are not included** — the source validates answers server-side and never sends the correct choice to the page.');
L.push('');
L.push('The bank contains "variation" families — the same item re-skinned with different names or subjects. Selection rejects any question whose wording overlaps an already-chosen one, so no two items on this form are re-skins of each other.');
L.push('');

for (let mi = 0; mi < 2; mi++) {
  const mod = mi + 1;
  const qs = modules[mi];
  const tally = qs.reduce((a, q) => ((a[q.difficulty] = (a[q.difficulty] || 0) + 1), a), {});
  L.push('---');
  L.push('');
  L.push(`## Module ${mod}${mod === 2 ? ' (harder module)' : ''}`);
  L.push('');
  L.push(`27 questions · 32 minutes · difficulty mix ${tally.Easy || 0} easy / ${tally.Intermediate || 0} intermediate / ${tally.Hard || 0} hard`);
  L.push('');

  let lastDomain = null;
  qs.forEach((q, i) => {
    const n = i + 1;
    if (q.domain !== lastDomain) {
      lastDomain = q.domain;
      L.push(`### ${q.domain}`);
      L.push('');
    }
    const notes = [];
    const body = passageToMd(q.passage, `module-${mod}-question-${n}`, notes);
    notes.forEach((f) => figures.push({ mod, n, ...f }));

    L.push(`#### Module ${mod} — Question ${n}`);
    L.push('');
    L.push(`*${q.sub} · difficulty: **${String(q.difficulty).toUpperCase()}** · bank question id ${q.questionId}*`);
    L.push('');
    L.push(body);
    L.push('');
    L.push(inline(q.content.replace(/<\/?p[^>]*>/gi, '')));
    L.push('');
    q.answers.forEach((a, ai) => L.push(`- **${LETTERS[ai]})** ${inline(a)}`));
    L.push('');
  });
}

L.push('---');
L.push('');
L.push('## Blueprint');
L.push('');
L.push('| Domain | Question type | Per module | Module 1 difficulty | Module 2 difficulty |');
L.push('| --- | --- | --- | --- | --- |');
BLUEPRINT.forEach(([d, s, m1, m2]) =>
  L.push(`| ${d} | ${s} | ${m1.length} | ${m1.map((x) => x[0]).join(' ')} | ${m2.map((x) => x[0]).join(' ')} |`));
L.push('| | **Total** | **27** | | |');
L.push('');
L.push('## Graphics in this exam');
L.push('');
L.push('| Question | File | Origin |');
L.push('| --- | --- | --- |');
figures.forEach((f) => L.push(`| Module ${f.mod}, Q${f.n} | \`assets/${f.file}\` | ${f.kind === 'captured' ? 'captured verbatim from the site (vector SVG)' : '**recreated** — source chart is CSS `<div>` bars, redrawn from the page\'s own values'} |`));
const tableQs = [];
modules.forEach((qs, mi) => qs.forEach((q, i) => { if (/<table/i.test(q.passage)) tableQs.push(`Module ${mi + 1}, Q${i + 1}`); }));
L.push('');
L.push(`Data tables transcribed from the site's HTML: ${tableQs.join('; ') || 'none'}.`);
L.push('');

const mdPath = path.join(OUT_DIR, 'dsat-english-june-2026-practice-exam-1.md');
fs.writeFileSync(mdPath, L.join('\n').replace(/\n{4,}/g, '\n\n\n') + '\n');

console.log('wrote', mdPath);
modules.forEach((qs, mi) => {
  const t = qs.reduce((a, q) => ((a[q.difficulty] = (a[q.difficulty] || 0) + 1), a), {});
  console.log(`module ${mi + 1}: ${qs.length} q`, JSON.stringify(t));
});
console.log('clones skipped during selection:', rejected.length);
console.log('figures:', JSON.stringify(figures));
console.log('tables at:', tableQs.join('; '));

// final audit: worst pairwise overlap across the whole 54
let worst = { j: 0 };
for (let i = 0; i < taken.length; i++)
  for (let k = i + 1; k < taken.length; k++) {
    const j = jaccard(taken[i].tok, taken[k].tok);
    if (j > worst.j) worst = { j, a: i, b: k };
  }
const loc = (i) => `M${i < 27 ? 1 : 2} Q${(i % 27) + 1} (${taken[i].questionId})`;
console.log(`worst remaining overlap: ${worst.j.toFixed(3)} between ${loc(worst.a)} and ${loc(worst.b)}`);
