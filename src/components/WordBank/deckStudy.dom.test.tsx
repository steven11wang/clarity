import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})

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
globals.CustomEvent = dom.window.CustomEvent
globals.IS_REACT_ACT_ENVIRONMENT = true

// A two-card core deck and a one-card second deck: enough to exercise the queue,
// the gate and the analysis screen without four hundred rows of fixture.
const DECK_FILE = {
  version: 1,
  decks: [
    {
      id: 'core',
      title: 'Clarity All-Around Words',
      cards: [
        { id: 'core:erratic', word: 'erratic', definition: 'unpredictable, inconsistent' },
        { id: 'core:secluded', word: 'secluded', definition: 'hard to reach, hidden away' },
      ],
    },
    {
      id: 'longshot',
      title: 'Clarity Long-Shot Words',
      cards: [{ id: 'longshot:bazaar', word: 'bazaar', definition: 'a market' }],
    },
  ],
}

globals.fetch = (async (url: string) => {
  if (String(url).includes('word-decks.json')) {
    return { ok: true, status: 200, json: async () => DECK_FILE } as unknown as Response
  }
  throw new Error(`unexpected fetch: ${url}`)
}) as unknown as typeof fetch

const { createElement, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { WordBank } = await import('./WordBank.tsx')
const { resetWordDeckCache } = await import('../../dictionary/wordDecks.ts')
const { getDeckCards, getDeckReviews } = await import('../../storage/index.ts')

const container = dom.window.document.getElementById('root')!
const root = createRoot(container)

after(() => {
  act(() => root.unmount())
})

function findButton(label: string) {
  return [...container.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === label,
  )
}

function findButtonStarting(prefix: string) {
  return [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.trim().startsWith(prefix),
  )
}

async function click(element: Element | undefined) {
  assert.ok(element, 'expected the element to be in the document')
  await act(async () => {
    element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })
}

async function render() {
  await act(async () => {
    root.render(null)
  })
  await act(async () => {
    root.render(createElement(WordBank, { onBack: () => {} }))
  })
  // Let the deck fetch resolve.
  await act(async () => {
    await Promise.resolve()
  })
}

describe('the learning decks', () => {
  beforeEach(async () => {
    dom.window.localStorage.clear()
    resetWordDeckCache()
    await render()
  })

  it('opens on the decks and lists both of them', () => {
    assert.ok(container.textContent?.includes('Clarity All-Around Words'))
    assert.ok(container.textContent?.includes('Clarity Long-Shot Words'))
  })

  it('keeps the second deck shut until the first one is learned', () => {
    assert.ok(container.textContent?.includes('LOCKED'))
    assert.ok(findButton('Finish deck one first')?.hasAttribute('disabled'))
    assert.ok(container.textContent?.includes('0 of 2'))
  })

  it('shows a word, hides the answer, and reveals it on request', async () => {
    await click(findButtonStarting('Study'))
    assert.ok(container.textContent?.includes('What does it mean?'))
    assert.ok(!container.textContent?.includes('unpredictable'))

    await click(findButton('Show the answer'))
    assert.ok(container.textContent?.includes('unpredictable, inconsistent'))
  })

  it('offers Anki’s four buttons with the delay each one would cost', async () => {
    await click(findButtonStarting('Study'))
    await click(findButton('Show the answer'))

    const labels = [...container.querySelectorAll('.deckstudy__button')].map((button) =>
      button.textContent?.trim(),
    )
    assert.equal(labels.length, 4)
    assert.ok(labels[0]?.startsWith('1m'), `Again showed ${labels[0]}`)
    assert.ok(labels[1]?.startsWith('6m'), `Hard showed ${labels[1]}`)
    assert.ok(labels[2]?.startsWith('10m'), `Good showed ${labels[2]}`)
    assert.ok(labels[3]?.startsWith('4d'), `Easy showed ${labels[3]}`)
  })

  it('files the answer against the card and in the review log', async () => {
    await click(findButtonStarting('Study'))
    await click(findButton('Show the answer'))
    await click(container.querySelector('.deckstudy__button--easy') ?? undefined)

    const cards = Object.values(getDeckCards())
    assert.equal(cards.length, 1)
    assert.equal(cards[0].phase, 'review')
    assert.equal(cards[0].intervalDays, 4)

    const log = getDeckReviews()
    assert.equal(log.length, 1)
    assert.equal(log[0].rating, 4)
    assert.equal(log[0].phase, 'new')
    assert.equal(log[0].deckId, 'core')
  })

  it('hands back the next card rather than the one just answered', async () => {
    await click(findButtonStarting('Study'))
    await click(findButton('Show the answer'))
    assert.ok(container.textContent?.includes('erratic'))
    await click(container.querySelector('.deckstudy__button--good') ?? undefined)
    assert.ok(container.textContent?.includes('secluded'), 'expected the second card')
  })

  it('opens the second deck once every card in the first has graduated', async () => {
    await click(findButtonStarting('Study'))
    for (let index = 0; index < 2; index += 1) {
      await click(findButton('Show the answer'))
      await click(container.querySelector('.deckstudy__button--easy') ?? undefined)
    }
    await click(findButton('Back to the decks'))

    assert.ok(!container.textContent?.includes('LOCKED'), 'the gate should have opened')
    assert.ok(findButtonStarting('Study (1)'), 'the long-shot deck should be studiable')
  })

  it('answers Good from the keyboard, the way Anki does', async () => {
    await click(findButtonStarting('Study'))
    await act(async () => {
      dom.window.document.dispatchEvent(
        new dom.window.KeyboardEvent('keydown', { key: ' ', bubbles: true }),
      )
    })
    assert.ok(container.textContent?.includes('unpredictable'), 'space should reveal the answer')

    await act(async () => {
      dom.window.document.dispatchEvent(
        new dom.window.KeyboardEvent('keydown', { key: ' ', bubbles: true }),
      )
    })
    assert.equal(getDeckReviews()[0]?.rating, 3)
  })

  it('draws the analysis screen from the log', async () => {
    await click(findButtonStarting('Study'))
    await click(findButton('Show the answer'))
    await click(container.querySelector('.deckstudy__button--again') ?? undefined)
    await click(findButton('Leave the deck'))
    await click(findButton('Analysis'))

    assert.ok(container.textContent?.includes('True retention'))
    assert.ok(container.textContent?.includes('Future due'))
    assert.ok(container.textContent?.includes('Answer buttons'))
    // One press, and it was an Again.
    const today = container.querySelector('.deckstats__figures')
    assert.ok(today?.textContent?.includes('1'))
  })

  it('says so plainly when there is nothing to analyse yet', async () => {
    await click(findButton('Analysis'))
    assert.ok(container.textContent?.includes('Nothing to analyse yet'))
  })
})

describe('the Words tabs', () => {
  beforeEach(async () => {
    dom.window.localStorage.clear()
    resetWordDeckCache()
    await render()
  })

  it('switches to the saved word bank and back', async () => {
    await click(findButton('Saved from passages'))
    assert.ok(container.textContent?.includes('Every word you'))
    assert.ok(container.textContent?.includes('Nothing saved yet'))

    await click(findButton('Learning decks'))
    assert.ok(container.textContent?.includes('words, on a schedule'))
  })
})
