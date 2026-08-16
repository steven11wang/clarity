import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  entryMatches,
  isMissPayload,
  parseMerriamWebster,
  parseThesaurusSynonyms,
  stripMarkup,
} from './merriamWebster.ts'

/** Trimmed from the live response for "temper", which the popup has to handle. */
const TEMPER = [
  {
    meta: { id: 'temper:1', stems: ['temper', 'tempers'] },
    fl: 'noun',
    shortdef: ['the tendency of someone to become angry'],
    def: [
      {
        sseq: [
          [
            ['sense', {
              sn: '1 a',
              dt: [
                ['text', '{bc}the tendency of someone to become angry '],
                ['vis', [{ t: 'She has a bad {it}temper{/it}.' }]],
                ['text', '{dx}see also {dxt|short temper||}{/dx}'],
              ],
            }],
          ],
          [
            ['sense', {
              sn: '2',
              dt: [
                ['text', '{bc}calmness of mind {bc}{sx|composure||} '],
                ['vis', [{ t: '{phrase}Tempers flared{/phrase} [=people became angry]' }]],
              ],
            }],
          ],
        ],
      },
    ],
  },
  {
    meta: { id: 'temper:2', stems: ['temper', 'tempered', 'tempering'] },
    fl: 'verb',
    shortdef: ['to make (something) less severe or extreme'],
    def: [
      {
        sseq: [
          [
            ['sense', {
              sn: '1',
              sls: ['formal'],
              dt: [
                ['text', '{bc}to make (something) less severe or extreme '],
                ['uns', [[
                  ['text', 'often + {it}with{/it} '],
                  ['vis', [{ t: 'He {it}tempered{/it} his criticism {it}with{/it} praise.' }]],
                ]]],
              ],
            }],
          ],
        ],
      },
    ],
  },
  // Archaic senses are dropped before they can reach a learner.
  {
    meta: { id: 'temper:3', stems: ['temper'] },
    fl: 'noun',
    def: [{ sseq: [[['sense', { sls: ['archaic'], dt: [['text', '{bc}a mixture of ingredients']] }]]] }],
  },
]

describe('stripMarkup', () => {
  it('unwraps formatting and link tokens', () => {
    assert.equal(stripMarkup('He {it}tempered{/it} his tone.'), 'He tempered his tone.')
    assert.equal(stripMarkup('{bc}calmness of mind {bc}{sx|composure||}'), 'calmness of mind: composure')
    assert.equal(stripMarkup('{ldquo}stop{rdquo}'), '“stop”')
  })

  it('drops cross-references to other entries', () => {
    assert.equal(stripMarkup('a fixed idea {dx}see also {dxt|obsession||}{/dx}'), 'a fixed idea')
  })
})

describe('parseMerriamWebster', () => {
  const senses = parseMerriamWebster(TEMPER, 'temper')

  it('walks the sense tree rather than settling for shortdef', () => {
    assert.equal(senses[0].definition, 'the tendency of someone to become angry')
    assert.equal(senses[1].definition, 'calmness of mind: composure')
    // shortdef alone would have lost the second sense entirely.
    assert.ok(senses.length > 2)
  })

  it('keeps one plain example per sense', () => {
    assert.equal(senses[0].example, 'She has a bad temper.')
    // The bracketed gloss is an editor's aside, not part of the sentence.
    assert.equal(senses[1].example, 'Tempers flared')
  })

  it('reaches illustrations nested inside a usage note', () => {
    const verb = senses.find((sense) => sense.partOfSpeech === 'verb')
    assert.equal(verb?.example, 'He tempered his criticism with praise.')
  })

  it('labels each sense with the part of speech of its entry', () => {
    assert.deepEqual([...new Set(senses.map((sense) => sense.partOfSpeech))], ['noun', 'verb'])
  })

  it('drops senses the SAT will never test', () => {
    assert.ok(!senses.some((sense) => /mixture of ingredients/.test(sense.definition)))
  })

  it('falls back to shortdef when an entry has no walkable senses', () => {
    const crossReference = [
      { meta: { id: 'tempered', stems: ['tempered'] }, fl: 'adjective', shortdef: ['brought to the desired hardness'] },
    ]
    assert.deepEqual(parseMerriamWebster(crossReference, 'tempered'), [
      { partOfSpeech: 'adjective', definition: 'brought to the desired hardness', example: null },
    ])
  })
})

describe('entryMatches', () => {
  it('accepts the headword and any inflection listed under it', () => {
    assert.equal(entryMatches(TEMPER[1], 'temper'), true)
    // MW answers a lookup of "tempered" with the "temper:2" entry.
    assert.equal(entryMatches(TEMPER[1], 'tempered'), true)
  })

  it('rejects a near-miss entry for a different word', () => {
    assert.equal(entryMatches(TEMPER[0], 'temperature'), false)
    assert.equal(entryMatches('temperance', 'temper'), false)
  })
})

// Trimmed from the live Intermediate Thesaurus response for "onset".
const ONSET_THESAURUS = [
  {
    meta: {
      id: 'onset',
      stems: ['onset', 'onsets'],
      syns: [
        [
          'aggression', 'assault', 'attack', 'blitzkrieg', 'charge', 'descent',
          'offense', 'offensive', 'onslaught', 'raid', 'rush', 'strike',
        ],
        [
          'alpha', 'beginning', 'birth', 'commencement', 'dawn', 'genesis',
          'inception', 'incipiency', 'launch', 'morning', 'outset', 'start', 'threshold',
        ],
      ],
      ants: [['close', 'conclusion', 'end', 'ending']],
    },
    fl: 'noun',
  },
]

describe('parseThesaurusSynonyms', () => {
  it('flattens every sense cluster into one capped list per part of speech', () => {
    const synonyms = parseThesaurusSynonyms(ONSET_THESAURUS, 'onset')
    assert.deepEqual(synonyms.noun, [
      'aggression', 'assault', 'attack', 'blitzkrieg', 'charge', 'descent', 'offense', 'offensive',
    ])
  })

  it('answers no entry for a part of speech the word has none for', () => {
    const synonyms = parseThesaurusSynonyms(ONSET_THESAURUS, 'onset')
    assert.equal(synonyms.verb, undefined)
  })

  it('reports nothing for a miss payload or a near-miss entry', () => {
    assert.deepEqual(parseThesaurusSynonyms(['onsett', 'unset'], 'onset'), {})
    assert.deepEqual(parseThesaurusSynonyms(ONSET_THESAURUS, 'inset'), {})
  })
})

describe('isMissPayload', () => {
  it('recognises the spelling-suggestion answer', () => {
    assert.equal(isMissPayload(['buzzword', 'sent word']), true)
    assert.equal(isMissPayload([]), true)
    assert.equal(isMissPayload(TEMPER), false)
  })
})
