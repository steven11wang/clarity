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
globals.CustomEvent = dom.window.CustomEvent
globals.IS_REACT_ACT_ENVIRONMENT = true

const mockExam = {
  id: 'cooksat-mock-exam-2',
  title: 'CookSAT Practice Test 2',
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
      durationSeconds: 1920,
      questions: [
        {
          id: 'q1',
          number: 1,
          passage: ['Passage 1'],
          figure: null,
          stem: 'Stem 1',
          choices: [{ letter: 'A', text: 'A' }, { letter: 'B', text: 'B' }],
          answer: 'A',
          topic: 'Craft and Structure',
          subtopic: 'Words in Context',
          difficulty: 'medium',
        },
      ],
    },
  ],
}

globals.fetch = (async () => {
  return {
    ok: true,
    json: async () => mockExam,
  }
}) as unknown as typeof fetch


const { createElement } = await import('react')
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { PracticeExamPanel } = await import('./PracticeExamPanel.tsx')
import type { PracticeExamRecord } from '../../storage/index.ts'
const { saveExamRecord, getExamRecords } = await import('../../storage/index.ts')



const container = dom.window.document.getElementById('root')!
const root = createRoot(container)

after(() => {
  act(() => root.unmount())
})

function openStep(title: string) {
  const rows = [...container.querySelectorAll<HTMLElement>('.step__row')]
  const row = rows.find((item) => item.querySelector('.step__title')?.textContent === title)
  assert.ok(row, `step "${title}" should render`)
  // Both tests share one React root, so the step may already be open.
  if (row.getAttribute('aria-expanded') !== 'true') row.click()
}

describe('Practice Exam History Persistence', () => {
  beforeEach(() => {
    dom.window.localStorage.clear()
  })

  it('persists a past record and lists it under its programme step', async () => {
    const record: PracticeExamRecord = {
      id: 'exam_record_1700000000000_cooksat-mock-exam-2',
      examId: 'cooksat-mock-exam-2',
      examTitle: 'CookSAT Practice Test 2',
      finishedAt: 1700000000000,
      result: {
        answers: { 'q1': 'A', 'q2': 'B' },
        flagged: [],
        finishedAt: 1700000000000,
        timeLeft: {},
        overtime: {},
        questionSeconds: {},
        untimed: false,
        timingLabel: 'Official pace',
      },
    }
    saveExamRecord(record)

    await act(async () => {
      root.render(createElement(PracticeExamPanel))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    await act(async () => {
      openStep('Untimed exam 2 of 4')
    })

    const attempt = container.querySelector('.step__attempt')
    assert.ok(attempt, 'the attempt should be listed under its step')
    assert.match(attempt.textContent ?? '', /Official pace/)

    const recordsInStorage = getExamRecords()
    assert.equal(recordsInStorage.length, 1)
    assert.equal(recordsInStorage[0].id, record.id)
  })

  it('allows deleting a past exam record', async () => {
    const record: PracticeExamRecord = {
      id: 'exam_record_1700000000001_cooksat-mock-exam-2',
      examId: 'cooksat-mock-exam-2',
      examTitle: 'CookSAT Practice Test 2',
      finishedAt: 1700000000001,
      result: {
        answers: {},
        flagged: [],
        finishedAt: 1700000000001,
        timeLeft: {},
        overtime: {},
        questionSeconds: {},
        untimed: true,
        timingLabel: 'Untimed',
      },
    }
    saveExamRecord(record)
    assert.equal(getExamRecords().length, 1)

    await act(async () => {
      root.render(createElement(PracticeExamPanel))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    await act(async () => {
      openStep('Untimed exam 2 of 4')
    })

    const deleteBtn = container.querySelector<HTMLButtonElement>('.step__delete')
    assert.ok(deleteBtn, 'Delete button should be rendered')

    await act(async () => {
      deleteBtn.click()
    })

    assert.equal(getExamRecords().length, 0)
    assert.equal(container.querySelector('.step__attempt'), null)
  })
})
