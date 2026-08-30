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
  parseWiktionary,
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

/** The shape Wiktionary's REST view returns: HTML fragments, grouped by part of speech. */
function wiktionaryResponse(groups: unknown) {
  return { ok: true, status: 200, json: async () => ({ en: groups }) } as unknown as Response
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

describe('parseWiktionary', () => {
  it('flattens every sense the service returns', () => {
    const senses = parseWiktionary({
      en: [
        {
          partOfSpeech: 'Adjective',
          definitions: [
            { definition: 'Having <i>mixed</i> feelings.', examples: ['She was ambivalent.'] },
            { definition: 'Simultaneously attracted and repelled.' },
          ],
        },
        {
          partOfSpeech: 'Noun',
          definitions: [{ definition: 'One who is ambivalent.' }],
        },
      ],
    })

    assert.deepEqual(senses, [
      {
        partOfSpeech: 'adjective',
        definition: 'Having mixed feelings.',
        example: 'She was ambivalent.',
      },
      {
        partOfSpeech: 'adjective',
        definition: 'Simultaneously attracted and repelled.',
        example: null,
      },
      { partOfSpeech: 'noun', definition: 'One who is ambivalent.', example: null },
    ])
  })

  it('closes the gap a stripped link leaves in front of punctuation', () => {
    const [sense] = parseWiktionary({
      en: [
        {
          partOfSpeech: 'Noun',
          definitions: [{ definition: 'The act of <a href="/wiki/portray">portraying</a>.' }],
        },
      ],
    })
    assert.equal(sense.definition, 'The act of portraying.')
  })

  it('shortens a long definition to something readable mid-passage', () => {
    const [sense] = parseWiktionary({
      en: [
        {
          partOfSpeech: 'Noun',
          definitions: [{ definition: `A ${'very '.repeat(60)}long entry.` }],
        },
      ],
    })

    assert.ok(sense.definition.length <= 181)
    assert.ok(sense.definition.endsWith('…'))
  })

  it('survives a payload with no English section', () => {
    assert.deepEqual(parseWiktionary({ fr: [] }), [])
    assert.deepEqual(parseWiktionary('not a page'), [])
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
      return wiktionaryResponse([
        {
          partOfSpeech: 'Adjective',
          definitions: [{ definition: 'Having <i>mixed</i> feelings.' }],
        },
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
      return wiktionaryResponse([
        { partOfSpeech: 'Adjective', definitions: [{ definition: 'Using few words.' }] },
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
    // The word and the lemma it could be an inflection of - then the miss is
    // cached, so the second tap asks nobody.
    assert.equal(calls, 2)
  })

  it('treats an entry with no usable definitions as missing', async () => {
    clearDictionaryCache()
    const fetchImpl = (async () => wiktionaryResponse([])) as unknown as typeof fetch
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

  it('reads an inflected word off its base form rather than shrugging', async () => {
    clearDictionaryCache()
    const asked: string[] = []
    const fetchImpl = (async (url: string) => {
      asked.push(String(url))
      if (String(url).endsWith('/portrayal')) {
        return wiktionaryResponse([
          { partOfSpeech: 'Noun', definitions: [{ definition: 'A description of someone.' }] },
        ])
      }
      return notFound()
    }) as unknown as typeof fetch

    const result = await lookupWord('portrayals', { fetchImpl })

    assert.equal(result.status, 'found')
    assert.ok(asked.some((url) => url.endsWith('/portrayals')))
  })

  it('tries the doubled-consonant base of an inflected verb', async () => {
    clearDictionaryCache()
    const asked: string[] = []
    const fetchImpl = (async (url: string) => {
      asked.push(String(url))
      if (String(url).endsWith('/run')) {
        return wiktionaryResponse([
          { partOfSpeech: 'Verb', definitions: [{ definition: 'To move swiftly on foot.' }] },
        ])
      }
      return notFound()
    }) as unknown as typeof fetch

    const result = await lookupWord('running', { fetchImpl })

    assert.equal(result.status, 'found')
    assert.ok(asked.some((url) => url.endsWith('/run')))
  })

  it('drops a "plural of" entry, which defines nothing on its own', () => {
    const senses = parseWiktionary({
      en: [
        {
          partOfSpeech: 'Noun',
          definitions: [{ definition: '<span>plural of</span> <i>portrayal</i>' }],
        },
      ],
    })
    assert.deepEqual(senses, [])
  })

  it('gives up on a service that hangs instead of spinning forever', async () => {
    clearDictionaryCache()
    // dictionaryapi.dev goes down by accepting the connection and never
    // answering, so a hang has to read as a failure the popup can retry.
    const fetchImpl = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })) as unknown as typeof fetch

    await assert.rejects(
      () => lookupWord('reticent', { fetchImpl, timeoutMs: 10 }),
      /timed out/,
    )
  })

  it('does not cache a failed request', async () => {
    clearDictionaryCache()
    let offline = true
    const fetchImpl = (async () => {
      if (offline) throw new Error('offline')
      return wiktionaryResponse([
        { partOfSpeech: 'Adjective', definitions: [{ definition: 'Not revealing much.' }] },
      ])
    }) as unknown as typeof fetch

    await assert.rejects(() => lookupWord('reticent', { fetchImpl }))
    offline = false
    const retried = await lookupWord('reticent', { fetchImpl })
    assert.equal(retried.status, 'found')
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
      return wiktionaryResponse([
        { partOfSpeech: 'Adjective', definitions: [{ definition: 'Hopeful but impractical.' }] },
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
