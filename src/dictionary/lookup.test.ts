import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  bakedWordCount,
  cachedLookup,
  clearDictionaryCache,
  guessPartOfSpeech,
  isLookupable,
  lookupWord,
  normalizeWord,
  parseBaked,
  parseEntries,
  pickSense,
  preloadDictionary,
  type WordSense,
} from './lookup.ts'

function apiResponse(word: string, meanings: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => [{ word, meanings }],
  } as unknown as Response
}

function notFound() {
  return { ok: false, status: 404, json: async () => ({}) } as unknown as Response
}

describe('normalizeWord', () => {
  it('strips surrounding punctuation and case', () => {
    assert.equal(normalizeWord('“Ambivalent,”'), 'ambivalent')
    assert.equal(normalizeWord('(re-entry)'), 're-entry')
    assert.equal(normalizeWord("committee's"), 'committee')
  })

  it('rejects tokens with nothing to look up', () => {
    assert.equal(isLookupable('1996'), false)
    assert.equal(isLookupable('—'), false)
    assert.equal(isLookupable('a'), false)
    assert.equal(isLookupable('ambivalent.'), true)
  })
})

describe('parseEntries', () => {
  it('flattens every sense the service returns', () => {
    const senses = parseEntries([
      {
        word: 'temper',
        meanings: [
          { partOfSpeech: 'noun', definitions: [{ definition: 'A state of mind.' }] },
          {
            partOfSpeech: 'verb',
            definitions: [
              { definition: 'To moderate or soften.', example: 'tempered his praise' },
              { definition: '' },
            ],
          },
        ],
      },
    ])
    assert.deepEqual(senses, [
      { partOfSpeech: 'noun', definition: 'A state of mind.', example: null },
      {
        partOfSpeech: 'verb',
        definition: 'To moderate or soften.',
        example: 'tempered his praise',
      },
    ])
  })

  it('shortens a long definition to something readable mid-passage', () => {
    const long = `A ${'very '.repeat(60)}long definition.`
    const [sense] = parseEntries([
      { meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: long }] }] },
    ])
    assert.ok(sense.definition.length <= 181, sense.definition.length.toString())
    assert.ok(sense.definition.endsWith('…'))
  })

  it('survives a payload that is not an entry list', () => {
    assert.deepEqual(parseEntries({ title: 'No Definitions Found' }), [])
  })

  it('carries one synonym list per part of speech, deduped and capped', () => {
    const senses = parseEntries([
      {
        word: 'onset',
        meanings: [
          {
            partOfSpeech: 'noun',
            synonyms: ['storming', 'beginning', 'start', 'beginning', '', 'storming'],
            definitions: [
              { definition: 'An attack; an assault.' },
              { definition: 'A beginning.', example: 'the onset of puberty' },
            ],
          },
          { partOfSpeech: 'verb', definitions: [{ definition: 'To set about; to begin.' }] },
        ],
      },
    ])

    assert.deepEqual(senses[0].synonyms, ['storming', 'beginning', 'start'])
    // Same list on every sense of that part of speech, same as MW's own panel.
    assert.deepEqual(senses[1].synonyms, ['storming', 'beginning', 'start'])
    // No synonyms field at all where the service did not send any - not an
    // empty array, so callers can tell "none" from "not asked yet".
    assert.equal(senses[2].synonyms, undefined)
  })
})

describe('pickSense', () => {
  const senses: WordSense[] = [
    { partOfSpeech: 'noun', definition: 'A state of mind or emotion.', example: null },
    {
      partOfSpeech: 'verb',
      definition: 'To moderate the harshness of a claim or judgement.',
      example: 'she tempered her criticism',
    },
    { partOfSpeech: 'noun', definition: '(archaic) The mixture of humours in a body.', example: null },
  ]

  it('picks the sense whose wording matches the sentence', () => {
    const sense = pickSense(
      senses,
      'The critic tempered her harsh judgement of the novel.',
      'tempered',
    )
    assert.equal(sense?.partOfSpeech, 'verb')
  })

  it('prefers the noun reading after a determiner', () => {
    const sense = pickSense(senses, 'He lost his temper.', 'temper')
    assert.equal(sense?.definition, 'A state of mind or emotion.')
  })

  it('never lands on an archaic sense by default', () => {
    const sense = pickSense(senses, 'The temper of the room shifted.', 'temper')
    assert.ok(!sense?.definition.includes('archaic'))
  })

  it('returns null when the service gave nothing', () => {
    assert.equal(pickSense([], 'A sentence.', 'word'), null)
  })
})

describe('guessPartOfSpeech', () => {
  it('reads the cue in front of the word', () => {
    assert.equal(guessPartOfSpeech('It was a very fleeting moment.', 'fleeting'), 'adjective')
    assert.equal(guessPartOfSpeech('They will temper the claim.', 'temper'), 'verb')
    assert.equal(guessPartOfSpeech('She spoke candidly.', 'candidly'), 'adverb')
  })

  it('reads a copula as a description, not an action', () => {
    assert.equal(
      guessPartOfSpeech('The committee was ambivalent about the proposal.', 'ambivalent'),
      'adjective',
    )
  })

  it('tells a modifier from the noun it modifies', () => {
    assert.equal(guessPartOfSpeech('She burns delicate patterns into wood.', 'delicate'), 'adjective')
    assert.equal(guessPartOfSpeech('He lost his temper.', 'temper'), 'noun')
    assert.equal(
      guessPartOfSpeech('The novel gained a wide following after its release.', 'following'),
      'noun',
    )
  })

  it('falls back to the suffix', () => {
    assert.equal(guessPartOfSpeech('Rapid urbanization followed.', 'urbanization'), 'noun')
    assert.equal(guessPartOfSpeech('Momentous change followed.', 'momentous'), 'adjective')
  })

  it('reads a bare past form as the sentence verb', () => {
    assert.equal(
      guessPartOfSpeech('The critic tempered her harsh judgement.', 'tempered'),
      'verb',
    )
  })
})

describe('lookupWord', () => {
  it('caches a definition so the second tap costs no request', async () => {
    clearDictionaryCache()
    let calls = 0
    const fetchImpl = (async () => {
      calls += 1
      return apiResponse('ambivalent', [
        { partOfSpeech: 'adjective', definitions: [{ definition: 'Having mixed feelings.' }] },
      ])
    }) as unknown as typeof fetch

    const first = await lookupWord('Ambivalent,', { fetchImpl })
    const second = await lookupWord('ambivalent', { fetchImpl })

    assert.equal(calls, 1)
    assert.equal(first.status, 'found')
    assert.deepEqual(second, first)
  })

  it('shares one request between simultaneous taps on the same word', async () => {
    clearDictionaryCache()
    let calls = 0
    const fetchImpl = (async () => {
      calls += 1
      return apiResponse('laconic', [
        { partOfSpeech: 'adjective', definitions: [{ definition: 'Using few words.' }] },
      ])
    }) as unknown as typeof fetch

    const [a, b] = await Promise.all([
      lookupWord('laconic', { fetchImpl }),
      lookupWord('laconic', { fetchImpl }),
    ])

    assert.equal(calls, 1)
    assert.deepEqual(a, b)
  })

  it('reports a word the dictionary does not carry, and caches that too', async () => {
    clearDictionaryCache()
    let calls = 0
    const fetchImpl = (async () => {
      calls += 1
      return notFound()
    }) as unknown as typeof fetch

    const result = await lookupWord('quillfeather', { fetchImpl })
    await lookupWord('quillfeather', { fetchImpl })

    assert.deepEqual(result, { status: 'missing', word: 'quillfeather' })
    assert.equal(calls, 1)
  })

  it('treats an entry with no usable definitions as missing', async () => {
    clearDictionaryCache()
    const fetchImpl = (async () => apiResponse('hollow', [])) as unknown as typeof fetch
    assert.deepEqual(await lookupWord('hollow', { fetchImpl }), {
      status: 'missing',
      word: 'hollow',
    })
  })

  it('rejects on a server failure so the popup can offer a retry', async () => {
    clearDictionaryCache()
    const fetchImpl = (async () =>
      ({ ok: false, status: 502, json: async () => ({}) }) as unknown as Response) as unknown as typeof fetch

    await assert.rejects(() => lookupWord('reticent', { fetchImpl }), /502/)
  })

  it('does not cache a failed request', async () => {
    clearDictionaryCache()
    let calls = 0
    const fetchImpl = (async () => {
      calls += 1
      if (calls === 1) throw new Error('offline')
      return apiResponse('reticent', [
        { partOfSpeech: 'adjective', definitions: [{ definition: 'Not revealing much.' }] },
      ])
    }) as unknown as typeof fetch

    await assert.rejects(() => lookupWord('reticent', { fetchImpl }))
    const retried = await lookupWord('reticent', { fetchImpl })
    assert.equal(retried.status, 'found')
    assert.equal(calls, 2)
  })
})

describe('the baked dictionary', () => {
  function bakedResponse(words: unknown) {
    return { ok: true, status: 200, json: async () => ({ version: 1, words }) } as unknown as Response
  }

  it('unpacks sense tuples, treating a third slot as the example', () => {
    const index = parseBaked({
      version: 1,
      words: {
        undermine: {
          s: [
            ['verb', 'to make someone or something weaker', 'She undermined my authority.'],
            ['verb', 'to dig out the earth beneath something'],
          ],
        },
      },
    })

    assert.deepEqual(index.get('undermine'), {
      status: 'found',
      word: 'undermine',
      senses: [
        { partOfSpeech: 'verb', definition: 'to make someone or something weaker', example: 'She undermined my authority.' },
        { partOfSpeech: 'verb', definition: 'to dig out the earth beneath something', example: null },
      ],
    })
  })

  it('attaches the baked thesaurus list to every sense of that part of speech', () => {
    const index = parseBaked({
      version: 1,
      words: {
        onset: {
          s: [
            ['noun', 'an attack', 'withstand the onset of the army'],
            ['noun', 'a beginning', 'the onset of winter'],
            ['verb', 'to begin'],
          ],
          y: { noun: ['attack', 'assault', 'onslaught'] },
        },
      },
    })

    const senses = index.get('onset')
    assert.equal(senses?.status, 'found')
    if (senses?.status !== 'found') return
    assert.deepEqual(senses.senses[0].synonyms, ['attack', 'assault', 'onslaught'])
    assert.deepEqual(senses.senses[1].synonyms, ['attack', 'assault', 'onslaught'])
    // The thesaurus has nothing for the verb sense - no key, not an empty list.
    assert.equal(senses.senses[2].synonyms, undefined)
  })

  it('reads a null entry as a word the dictionary does not carry', () => {
    const index = parseBaked({ version: 1, words: { bioswales: null } })
    assert.deepEqual(index.get('bioswales'), { status: 'missing', word: 'bioswales' })
  })

  it('answers from the baked file without touching the live service', async () => {
    clearDictionaryCache()
    let liveCalls = 0
    const fetchImpl = (async (url: string) => {
      if (String(url).includes('dictionary.json')) {
        return bakedResponse({ laconic: { s: [['adjective', 'using few words']] } })
      }
      liveCalls += 1
      return notFound()
    }) as unknown as typeof fetch

    await preloadDictionary(fetchImpl)
    const result = await lookupWord('Laconic.', { fetchImpl })

    assert.deepEqual(result, {
      status: 'found',
      word: 'laconic',
      senses: [{ partOfSpeech: 'adjective', definition: 'using few words', example: null }],
    })
    assert.equal(liveCalls, 0)
    // Available synchronously too, so the popup opens already filled in.
    assert.deepEqual(cachedLookup('laconic'), result)
  })

  it('falls back to the live service for a word it has not baked yet', async () => {
    clearDictionaryCache()
    let liveCalls = 0
    const fetchImpl = (async (url: string) => {
      if (String(url).includes('dictionary.json')) return bakedResponse({ laconic: { s: [['adjective', 'using few words']] } })
      liveCalls += 1
      return apiResponse('quixotic', [
        { partOfSpeech: 'adjective', definitions: [{ definition: 'Hopeful but impractical.' }] },
      ])
    }) as unknown as typeof fetch

    await preloadDictionary(fetchImpl)
    const result = await lookupWord('quixotic', { fetchImpl })

    assert.equal(result.status, 'found')
    assert.equal(liveCalls, 1)
  })

  it('keeps working when the baked file cannot be fetched', async () => {
    clearDictionaryCache()
    const fetchImpl = (async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch

    assert.equal((await preloadDictionary(fetchImpl)).size, 0)
    assert.equal(bakedWordCount(), 0)
  })
})
