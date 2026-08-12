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
globals.IS_REACT_ACT_ENVIRONMENT = true

import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { ExamPassage } from './ExamPassage.tsx'

let root: Root | null = null

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>'
  root = createRoot(document.getElementById('root')!)
})

after(() => {
  root?.unmount()
})

describe('ExamPassage bullet notes', () => {
  it('renders bullet lists for note questions', async () => {
    const passage = [
      'While researching a topic, a student has taken the following notes:',
      '• Note line 1 about dragonflies',
      '• Note line 2 about ponds and lakes',
    ]

    await act(async () => {
      root!.render(
        <ExamPassage
          paragraphs={passage}
          highlights={[]}
          annotate={false}
          onHighlightChange={() => {}}
        />,
      )
    })

    const ul = document.querySelector('ul.exam-passage__notes')
    assert.ok(ul, 'renders a ul.exam-passage__notes element')
    const items = ul!.querySelectorAll('li')
    assert.equal(items.length, 2, 'renders 2 bullet items')
    assert.equal(items[0].textContent, 'Note line 1 about dragonflies')
    assert.equal(items[1].textContent, 'Note line 2 about ponds and lakes')
  })

  it('automatically splits concatenated note passages into bullet lists', async () => {
    const passage = [
      'While researching a topic, a student has taken the following notes: - Note line 1 - Note line 2',
    ]

    await act(async () => {
      root!.render(
        <ExamPassage
          paragraphs={passage}
          highlights={[]}
          annotate={false}
          onHighlightChange={() => {}}
        />,
      )
    })

    const intro = document.querySelector('p')
    assert.ok(intro, 'renders intro paragraph')
    assert.equal(
      intro!.textContent,
      'While researching a topic, a student has taken the following notes:',
    )

    const ul = document.querySelector('ul.exam-passage__notes')
    assert.ok(ul, 'renders a ul.exam-passage__notes element')
    const items = ul!.querySelectorAll('li')
    assert.equal(items.length, 2, 'renders 2 bullet items')
    assert.equal(items[0].textContent, 'Note line 1')
    assert.equal(items[1].textContent, 'Note line 2')
  })
})
