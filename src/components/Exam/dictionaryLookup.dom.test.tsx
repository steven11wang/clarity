import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import { JSDOM } from 'jsdom'

const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true },
)

const globals = globalThis as unknown as Record<string, unknown>
globals.window = dom.window
globals.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: dom.window.navigator,
})
globals.HTMLElement = dom.window.HTMLElement
globals.Element = dom.window.Element
globals.Node = dom.window.Node
globals.localStorage = dom.window.localStorage
// Saving a word writes through the storage layer, which announces the change
// with a CustomEvent - jsdom only accepts its own Event classes.
globals.CustomEvent = dom.window.CustomEvent
globals.IS_REACT_ACT_ENVIRONMENT = true

let fetchCalls: string[] = []
let respond: (url: string) => Response = () => okResponse()

/** The dictionaryapi.dev shape, used for words the baked file does not carry. */
function okResponse(
  meanings: unknown = [
    {
      partOfSpeech: 'adjective',
      definitions: [{ definition: 'Having mixed feelings about something.' }],
    },
  ],
) {
  return {
    ok: true,
    status: 200,
    json: async () => [{ word: 'ambivalent', meanings }],
  } as unknown as Response
}

/** The build-time file: senses packed as [partOfSpeech, definition, example?]. */
function bakedResponse(words: Record<string, unknown> = BAKED_WORDS) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ version: 1, words }),
  } as unknown as Response
}

const BAKED_WORDS = {
  ambivalent: {
    s: [['adjective', 'having very different feelings about something at the same time',
      'He felt ambivalent about his job.']],
  },
}

let bakedWords: Record<string, unknown> = BAKED_WORDS

globals.fetch = (async (url: string) => {
  fetchCalls.push(String(url))
  // One stub for both sources: the baked file, then the live fallback.
  if (String(url).includes('dictionary.json')) return bakedResponse(bakedWords)
  return respond(String(url))
}) as unknown as typeof fetch

const { createElement, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { ExamRunner } = await import('./ExamRunner.tsx')
const { clearDictionaryCache } = await import('../../dictionary/lookup.ts')
const { getWordBankEntries } = await import('../../storage/index.ts')
type PracticeExam = import('./examData.ts').PracticeExam

const container = dom.window.document.getElementById('root')!
const root = createRoot(container)

after(() => {
  act(() => root.unmount())
})

const PASSAGE =
  'The committee was ambivalent about the proposal. Its members wanted more time.'

const exam: PracticeExam = {
  id: 'mock',
  title: 'Mock Exam',
  section: 'Reading and Writing',
  subject: 'Reading and Writing',
  answerKeySource: 'derived',
  assetBase: '',
  modules: [
    {
      id: 'm1',
      number: 1,
      subject: 'Reading and Writing',
      label: 'Module 1',
      durationSeconds: 600,
      questions: [
        {
          id: 'q1',
          number: 1,
          passage: [PASSAGE],
          figure: null,
          stem: 'What does the passage suggest?',
          choices: [
            { letter: 'A', text: 'First choice' },
            { letter: 'B', text: 'Second choice' },
          ],
          answer: 'A',
          topic: 'Craft and Structure',
          subtopic: 'Words in Context',
          difficulty: 'medium',
          explanation: null,
        },
      ],
    },
  ],
}

function findButton(label: string) {
  return [...container.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === label,
  )
}

async function click(element: Element | undefined) {
  assert.ok(element, 'expected the element to be in the document')
  await act(async () => {
    element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })
}

async function renderRunner() {
  // A fresh mount per test, so every run starts on the module interstitial.
  await act(async () => {
    root.render(null)
  })
  await act(async () => {
    root.render(
      createElement(ExamRunner, {
        exam,
        learnerName: 'Learner',
        theme: 'dark' as const,
        timing: { kind: 'untimed' as const, label: 'Untimed' },
        onToggleTheme: () => {},
        onExit: () => {},
        onFinish: () => {},
      }),
    )
  })
  await click(findButton('Begin module'))
}

describe('the passage dictionary', () => {
  beforeEach(async () => {
    fetchCalls = []
    respond = () => okResponse()
    bakedWords = BAKED_WORDS
    dom.window.localStorage.clear()
    clearDictionaryCache()
    await renderRunner()
  })

  it('leaves the passage untouched until the tool is turned on', async () => {
    assert.equal(container.querySelectorAll('.exam-word').length, 0)
    await click(findButton('Dictionary'))
    assert.ok(container.querySelectorAll('.exam-word').length > 5)
  })

  it('defines a clicked word and files it with the sentence it was read in', async () => {
    await click(findButton('Dictionary'))
    const word = [...container.querySelectorAll('.exam-word')].find(
      (button) => button.textContent === 'ambivalent',
    )
    await click(word)

    const popup = container.querySelector('.exam-lookup')
    assert.ok(popup, 'the definition popup should be open')
    assert.match(popup.textContent ?? '', /having very different feelings about something/)
    assert.match(popup.textContent ?? '', /adjective/)
    // The baked file is the only thing fetched: no per-word request.
    assert.equal(fetchCalls.length, 1)
    assert.match(fetchCalls[0], /dictionary\.json$/)

    await click(findButton('Save to Word Bank'))

    const saved = getWordBankEntries()
    assert.equal(saved.length, 1)
    assert.equal(saved[0].word, 'ambivalent')
    assert.equal(saved[0].partOfSpeech, 'adjective')
    assert.equal(
      saved[0].definition,
      'having very different feelings about something at the same time',
    )
    // Only the sentence, never the whole passage.
    assert.equal(saved[0].sentence, 'The committee was ambivalent about the proposal.')
    assert.equal(saved[0].source?.questionId, 'q1')
  })

  it('falls back to the live service for a word that was never baked', async () => {
    // The baked file is pulled down as the runner mounts, so an empty one has
    // to be in place before this test's own mount.
    bakedWords = {}
    clearDictionaryCache()
    fetchCalls = []
    await renderRunner()

    await click(findButton('Dictionary'))
    const word = [...container.querySelectorAll('.exam-word')].find(
      (button) => button.textContent === 'ambivalent',
    )
    await click(word)

    assert.match(
      container.querySelector('.exam-lookup')?.textContent ?? '',
      /Having mixed feelings about something\./,
    )
    assert.equal(fetchCalls.length, 2)
    assert.match(fetchCalls[1], /entries\/en\/ambivalent$/)
  })

  it('serves a repeat lookup from the cache', async () => {
    await click(findButton('Dictionary'))
    const words = [...container.querySelectorAll('.exam-word')]
    const target = words.find((button) => button.textContent === 'ambivalent')

    await click(target)
    await click(container.querySelector('.exam-lookup__close') ?? undefined)
    await click(target)

    assert.ok(container.querySelector('.exam-lookup'), 'the popup should reopen')
    assert.equal(fetchCalls.length, 1)
  })

  it('says so plainly when the dictionary has no entry', async () => {
    respond = () => ({ ok: false, status: 404, json: async () => ({}) }) as unknown as Response
    await click(findButton('Dictionary'))
    const word = [...container.querySelectorAll('.exam-word')].find(
      (button) => button.textContent === 'committee',
    )
    await click(word)

    const popup = container.querySelector('.exam-lookup')
    assert.match(popup?.textContent ?? '', /No dictionary entry/)
    assert.equal(findButton('Save to Word Bank'), undefined)
  })

  it('offers a retry when the network fails', async () => {
    respond = () => {
      throw new Error('offline')
    }
    await click(findButton('Dictionary'))
    const word = [...container.querySelectorAll('.exam-word')].find(
      (button) => button.textContent === 'proposal.',
    )
    await click(word)

    assert.match(container.querySelector('.exam-lookup')?.textContent ?? '', /Could not reach/)

    respond = () => okResponse()
    await click(findButton('Try again'))
    assert.match(
      container.querySelector('.exam-lookup')?.textContent ?? '',
      /Having mixed feelings/,
    )
  })

  it('quietly retries once before showing an error, so a single blip stays invisible', async () => {
    let liveCalls = 0
    respond = () => {
      liveCalls += 1
      if (liveCalls === 1) throw new Error('offline')
      return okResponse()
    }
    await click(findButton('Dictionary'))
    const word = [...container.querySelectorAll('.exam-word')].find(
      (button) => button.textContent === 'proposal.',
    )
    await click(word)

    assert.match(
      container.querySelector('.exam-lookup')?.textContent ?? '',
      /Having mixed feelings/,
    )
    assert.equal(liveCalls, 2)
  })

  it('gives up and offers a retry after two failures in a row', async () => {
    let liveCalls = 0
    respond = () => {
      liveCalls += 1
      throw new Error('offline')
    }
    await click(findButton('Dictionary'))
    const word = [...container.querySelectorAll('.exam-word')].find(
      (button) => button.textContent === 'proposal.',
    )
    await click(word)

    assert.match(container.querySelector('.exam-lookup')?.textContent ?? '', /Could not reach/)
    assert.equal(liveCalls, 2)
  })

  it('shows a synonyms list from the live dictionary, when it has one', async () => {
    respond = () =>
      okResponse([
        {
          partOfSpeech: 'adjective',
          synonyms: ['torn', 'undecided', 'conflicted'],
          definitions: [{ definition: 'Having mixed feelings about something.' }],
        },
      ])
    await click(findButton('Dictionary'))
    const word = [...container.querySelectorAll('.exam-word')].find(
      (button) => button.textContent === 'proposal.',
    )
    await click(word)

    const popup = container.querySelector('.exam-lookup')
    assert.match(popup?.textContent ?? '', /Synonyms of proposal/)
    assert.match(popup?.textContent ?? '', /torn, undecided, conflicted/)
  })

  it('closes the popup when the tool is switched back off', async () => {
    await click(findButton('Dictionary'))
    const word = [...container.querySelectorAll('.exam-word')].find(
      (button) => button.textContent === 'ambivalent',
    )
    await click(word)
    assert.ok(container.querySelector('.exam-lookup'))

    await click(findButton('Dictionary'))
    assert.equal(container.querySelector('.exam-lookup'), null)
    assert.equal(container.querySelectorAll('.exam-word').length, 0)
  })

  it('allows looking up words in question stem and choices', async () => {
    await click(findButton('Dictionary'))

    const stemWord = [...container.querySelectorAll('.exam-stem .exam-word')].find(
      (element) => element.textContent?.includes('suggest'),
    )
    assert.ok(stemWord, 'stem words should be lookupable in dictionary mode')

    const choiceWord = [...container.querySelectorAll('.exam-choice__text .exam-word')].find(
      (element) => element.textContent?.includes('choice'),
    )
    assert.ok(choiceWord, 'choice words should be lookupable in dictionary mode')

    await click(choiceWord)
    assert.ok(container.querySelector('.exam-lookup'), 'clicking choice word should open definition popover')
  })

  it('captures passage sentence context when saving a word from an answer choice', async () => {
    await click(findButton('Dictionary'))
    const choiceWord = [...container.querySelectorAll('.exam-choice__text .exam-word')].find(
      (element) => element.textContent?.includes('choice'),
    )
    await click(choiceWord)
    assert.ok(container.querySelector('.exam-lookup'))

    await click(findButton('Save to Word Bank'))
    const saved = getWordBankEntries()
    assert.ok(saved.length > 0)
    assert.ok(saved[0].sentence.length > 5, 'saved sentence should have surrounding context')
  })
})
