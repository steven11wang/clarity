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
          stem: 'Question stem 1',
          choices: [
            { letter: 'A', text: 'Option A' },
            { letter: 'B', text: 'Option B' },
          ],
          answer: 'A',
          topic: 'Craft and Structure',
          subtopic: 'Words in Context',
          difficulty: 'medium',
        },
        {
          id: 'q2',
          number: 2,
          passage: ['Passage 2'],
          figure: null,
          stem: 'Question stem 2',
          choices: [
            { letter: 'A', text: 'Option A' },
            { letter: 'B', text: 'Option B' },
          ],
          answer: 'B',
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
const { getPracticeExamDraft, savePracticeExamDraft, clearPracticeExamDraft } = await import(
  '../../storage/index.ts'
)

const container = dom.window.document.getElementById('root')!
const root = createRoot(container)

after(() => {
  act(() => root.unmount())
})

function openStep(title: string) {
  const rows = [...container.querySelectorAll<HTMLElement>('.step__row')]
  const row = rows.find((item) => item.querySelector('.step__title')?.textContent === title)
  assert.ok(row, `step "${title}" should render`)
  if (row.getAttribute('aria-expanded') !== 'true') row.click()
}

describe('Practice Exam Draft Persistence', () => {
  beforeEach(() => {
    dom.window.localStorage.clear()
    act(() => {
      root.render(null)
    })
  })

  it('saves draft state when starting a test and making progress', async () => {
    savePracticeExamDraft({
      examId: 'cooksat-mock-exam-2',
      paceId: 'untimed',
      customMinutes: 20,
      moduleIndex: 0,
      questionIndex: 1,
      screen: 'question',
      answers: { q1: 'A' },
      flagged: { q1: true },
      crossOuts: {},
      highlights: {},
      timeLeft: {},
      overtimeLog: {},
      questionSeconds: { q1: 15 },
      secondsLeft: 0,
      extraSeconds: 15,
      overtimeMode: false,
      updatedAt: Date.now(),
    })

    const draft = getPracticeExamDraft('cooksat-mock-exam-2')
    assert.ok(draft, 'draft should exist')
    assert.equal(draft.answers['q1'], 'A')
    assert.equal(draft.questionIndex, 1)
  })

  it('displays Resume test button when a draft exists and restores progress on click', async () => {
    savePracticeExamDraft({
      examId: 'cooksat-mock-exam-2',
      paceId: 'untimed',
      customMinutes: 20,
      moduleIndex: 0,
      questionIndex: 1,
      screen: 'question',
      answers: { q1: 'A' },
      flagged: { q1: true },
      crossOuts: {},
      highlights: {},
      timeLeft: {},
      overtimeLog: {},
      questionSeconds: { q1: 15 },
      secondsLeft: 0,
      extraSeconds: 15,
      overtimeMode: false,
      updatedAt: Date.now(),
    })

    await act(async () => {
      root.render(createElement(PracticeExamPanel))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    await act(async () => {
      openStep('Untimed exam 2 of 4')
    })

    const resumeBtn = [...container.querySelectorAll<HTMLButtonElement>('.exam-button')].find(
      (btn) => btn.textContent?.includes('Resume test'),
    )
    assert.ok(resumeBtn, 'Resume test button should be present when a draft exists')

    const startFreshBtn = [...container.querySelectorAll<HTMLButtonElement>('.exam-button')].find(
      (btn) => btn.textContent?.includes('Start fresh'),
    )
    assert.ok(startFreshBtn, 'Start fresh button should be present alongside Resume test')

    // Click resume
    await act(async () => {
      resumeBtn.click()
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    // Should open ExamRunner directly on question index 1 (Question stem 2)
    const stem = dom.window.document.querySelector('.exam-stem')?.textContent
    assert.match(stem ?? '', /Question stem 2/)
  })

  it('allows starting fresh to clear existing draft', async () => {
    savePracticeExamDraft({
      examId: 'cooksat-mock-exam-2',
      paceId: 'untimed',
      customMinutes: 20,
      moduleIndex: 0,
      questionIndex: 1,
      screen: 'question',
      answers: { q1: 'A' },
      flagged: {},
      crossOuts: {},
      highlights: {},
      timeLeft: {},
      overtimeLog: {},
      questionSeconds: {},
      secondsLeft: 0,
      extraSeconds: 15,
      overtimeMode: false,
      updatedAt: Date.now(),
    })

    await act(async () => {
      root.render(createElement(PracticeExamPanel))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    await act(async () => {
      openStep('Untimed exam 2 of 4')
    })

    const startFreshBtn = [...container.querySelectorAll<HTMLButtonElement>('.exam-button')].find(
      (btn) => btn.textContent?.includes('Start fresh'),
    )
    assert.ok(startFreshBtn, 'Start fresh button should exist')

    await act(async () => {
      startFreshBtn.click()
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    // Old progress (q1 answer, questionIndex 1) should be cleared and reset to fresh run
    const freshDraft = getPracticeExamDraft('cooksat-mock-exam-2')
    assert.ok(freshDraft)
    assert.equal(freshDraft.answers['q1'], undefined)
    assert.equal(freshDraft.questionIndex, 0)
  })
})
