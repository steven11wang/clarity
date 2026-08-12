import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
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
globals.IS_REACT_ACT_ENVIRONMENT = true

const { createElement } = await import('react')
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { ExamRunner } = await import('./ExamRunner.tsx')
type ExamResult = import('./ExamRunner.tsx').ExamResult
const { ExamReport } = await import('./ExamReport.tsx')
const { ExamReview } = await import('./ExamReview.tsx')
const { examDurationMinutes, moduleDurationSeconds } = await import('./examData.ts')
type PracticeExam = import('./examData.ts').PracticeExam

const container = dom.window.document.getElementById('root')!
const root = createRoot(container)

after(() => {
  act(() => root.unmount())
})

function question(
  id: string,
  number: number,
  answer: string,
  subtopic = 'Words in Context',
) {
  return {
    id,
    number,
    passage: [`Passage for ${id}.`],
    figure: null,
    stem: `Stem for ${id}?`,
    choices: [
      { letter: 'A', text: 'First choice' },
      { letter: 'B', text: 'Second choice' },
    ],
    answer,
    topic: 'Craft and Structure',
    subtopic,
    difficulty: 'medium' as const,
    explanation: {
      summary: `Reasoning for ${id}.`,
      choices: {
        A: `Line for ${id} choice A.`,
        B: `Line for ${id} choice B.`,
      },
    },
  }
}

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
      durationSeconds: 1920,
      questions: [
        question('m1-q1', 1, 'A'),
        question('m1-q2', 2, 'B', 'Text Structure and Purpose'),
      ],
    },
    {
      id: 'm2',
      number: 2,
      subject: 'Reading and Writing',
      label: 'Module 2',
      durationSeconds: 1920,
      questions: [question('m2-q1', 1, 'A')],
    },
  ],
}

// One second per module, so the clock runs out inside the test.
const oneSecondPerModule = {
  kind: 'fixed' as const,
  minutesPerModule: 1 / 60,
  label: 'One second per module',
}

function button(label: string) {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('button'),
  ).find((entry) => entry.textContent?.trim() === label)
}

async function tick(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
}

async function startRunner(onFinish: (result: ExamResult) => void) {
  // Clear whatever the previous test left mounted so the runner starts fresh.
  await act(async () => {
    root.render(null)
  })
  await act(async () => {
    root.render(
      createElement(ExamRunner, {
        exam,
        learnerName: 'Test Learner',
        theme: 'dark' as const,
        timing: oneSecondPerModule,
        onToggleTheme: () => {},
        onExit: () => {},
        onFinish,
      }),
    )
  })
  const begin = button('Begin module')
  assert.ok(begin, 'the module interstitial opens first')
  await act(async () => begin.click())
}

describe('exam timing options', () => {
  it('stretches, fixes, or drops the module clock', () => {
    const module = exam.modules[0]
    assert.equal(
      moduleDurationSeconds(module, { kind: 'scaled', factor: 1, label: 'Official pace' }),
      1920,
    )
    assert.equal(
      moduleDurationSeconds(module, { kind: 'scaled', factor: 1.5, label: 'Extended' }),
      2880,
    )
    assert.equal(
      moduleDurationSeconds(module, { kind: 'fixed', minutesPerModule: 20, label: '20' }),
      1200,
    )
    assert.equal(
      moduleDurationSeconds(module, { kind: 'untimed', label: 'Untimed' }),
      null,
    )
    assert.equal(
      examDurationMinutes(exam, { kind: 'fixed', minutesPerModule: 20, label: '20' }),
      40,
    )
    assert.equal(examDurationMinutes(exam, { kind: 'untimed', label: 'Untimed' }), null)
  })
})

describe('running out of time', () => {
  it('offers to keep working instead of closing the module', async () => {
    await startRunner(() => {})
    await tick(1400)

    const dialog = container.querySelector('.exam-timeup')
    assert.ok(dialog, 'the time-up dialog opens when the clock hits zero')
    assert.match(dialog.textContent ?? '', /Module 1 has run out of time/)
    assert.ok(button('Keep working'))
    assert.ok(button('Submit this section'))

    // Still on the question, not pushed into the next module.
    assert.ok(container.querySelector('.exam-choices'))
  })

  it('counts up past the clock when the learner keeps working', async () => {
    const keepWorking = button('Keep working')
    assert.ok(keepWorking)
    await act(async () => keepWorking.click())

    assert.equal(container.querySelector('.exam-timeup'), null)
    await tick(1200)

    const clock = container.querySelector('.exam-clock')
    assert.ok(clock?.className.includes('exam-clock--overtime'))
    assert.match(clock?.textContent ?? '', /^\+\d+:\d\d/)
  })

  it('submits the section and moves to the next module', async () => {
    let finished: ExamResult | null = null
    await startRunner((result) => {
      finished = result
    })
    await tick(1400)

    const submit = button('Submit this section')
    assert.ok(submit)
    await act(async () => submit.click())

    assert.match(container.textContent ?? '', /Module 2/)
    assert.equal(container.querySelector('.exam-timeup'), null)

    // Module 2 is the last one, so its dialog submits the whole exam.
    const begin = button('Continue')
    assert.ok(begin)
    await act(async () => begin.click())
    await tick(1400)

    const submitExam = button('Submit the exam')
    assert.ok(submitExam)
    await act(async () => submitExam.click())

    assert.ok(finished)
    assert.equal((finished as ExamResult).timingLabel, 'One second per module')
    assert.deepEqual(Object.keys((finished as ExamResult).overtime).sort(), ['m1', 'm2'])

    // The clock bills whichever question was on screen while it ticked.
    const seconds = (finished as ExamResult).questionSeconds
    assert.ok(seconds['m1-q1'] > 0, 'module 1 question 1 collected time')
    assert.ok(seconds['m2-q1'] > 0, 'module 2 question 1 collected time')
  })
})

// One miss cleared: find the key among the redo choices, click it, answer the
// contrast and cause screens, then step to the next miss.
function fixChoice(letter: string) {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('.exam-fix .exam-choice'),
  ).find((entry) => entry.querySelector('.exam-choice__letter')?.textContent === letter)
}

async function fixOneMiss(keyLetter: string) {
  const key = fixChoice(keyLetter)
  assert.ok(key, `the redo offers choice ${keyLetter}`)
  await act(async () => key.click())

  const select = container.querySelector<HTMLSelectElement>('.exam-fix__select')
  if (select) {
    await act(async () => {
      select.value = 'It contradicted the text'
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
    })
  }
  const proceed = button('Continue')
  assert.ok(proceed, 'the breakdown offers a way forward')
  await act(async () => proceed.click())

  const cause = container.querySelector<HTMLButtonElement>('.exam-fix__cause')
  assert.ok(cause, 'the cause screen lists error causes')
  await act(async () => cause.click())

  const next = container.querySelector<HTMLButtonElement>('.exam-fix__done .exam-button')
  assert.ok(next, 'the done screen steps on')
  await act(async () => next.click())
}

const reportResult: ExamResult = {
  answers: { 'm1-q1': 'A', 'm1-q2': 'A' },
  flagged: ['m1-q2'],
  finishedAt: Date.now(),
  timeLeft: { m1: 0, m2: 0 },
  overtime: { m1: 90, m2: 0 },
  questionSeconds: { 'm1-q1': 65, 'm1-q2': 30 },
  untimed: false,
  timingLabel: 'Official pace',
}

async function renderReport() {
  await act(async () => {
    root.render(null)
  })
  await act(async () => {
    root.render(
      createElement(ExamReport, {
        exam,
        result: reportResult,
        onRetake: () => {},
        onChangeTiming: () => {},
        onExit: () => {},
      }),
    )
  })
}

describe('fixing misses before the key', () => {
  it('opens on the fix pass with the review locked', async () => {
    await renderReport()

    // m1-q2 was answered wrong and m2-q1 was left blank: two misses.
    assert.ok(container.querySelector('.exam-fix'), 'the fix pass renders first')
    assert.match(container.textContent ?? '', /Fix your misses · 0 of 2 cleared/)

    const review = button('Review every question')
    assert.ok(review?.disabled, 'the review tab stays locked')
  })

  it('hides the answer key on the score summary while misses remain', async () => {
    const summaryTab = button('Score summary')
    assert.ok(summaryTab)
    await act(async () => summaryTab.click())

    assert.match(container.textContent ?? '', /answer key stays hidden/)
    const keys = Array.from(
      container.querySelectorAll('.exam-report__table tbody tr'),
    ).map((row) => row.querySelectorAll('td')[1]?.textContent)
    assert.deepEqual(keys, ['•', '•', '•'])
  })

  it('keeps the redo open until the key is found, then shows the breakdown', async () => {
    const fixTab = button('Fix your misses (2)')
    assert.ok(fixTab)
    await act(async () => fixTab.click())

    // The answer given on the exam is marked and locked out.
    const chosen = fixChoice('A')
    assert.ok(chosen?.disabled)
    assert.match(chosen.textContent ?? '', /You chose this/)
    assert.equal(container.querySelector('.exam-explain'), null)

    await act(async () => fixChoice('B')!.click())

    const explain = container.querySelector('.exam-explain')
    assert.ok(explain, 'the breakdown opens once the key is found')
    assert.match(explain.textContent ?? '', /Reasoning for m1-q2/)
    assert.match(explain.textContent ?? '', /Line for m1-q2 choice A/)
    assert.match(explain.textContent ?? '', /Line for m1-q2 choice B/)
  })

  it('unlocks the review once every miss is cleared', async () => {
    const select = container.querySelector<HTMLSelectElement>('.exam-fix__select')
    assert.ok(select, 'the wrong-answer reasons are offered')
    await act(async () => {
      select.value = 'It contradicted the text'
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
    })
    await act(async () => button('Continue')!.click())
    await act(async () => container.querySelector<HTMLButtonElement>('.exam-fix__cause')!.click())
    await act(async () => container.querySelector<HTMLButtonElement>('.exam-fix__done .exam-button')!.click())

    // The blank one is next: nothing to contrast, so it goes straight on.
    assert.match(container.textContent ?? '', /Fix your misses · 1 of 2 cleared/)
    assert.match(container.textContent ?? '', /You left this one blank/)
    await fixOneMiss('A')

    assert.ok(container.querySelector('.exam-review-page'), 'the review opens once cleared')
    assert.equal(button('Review every question')?.disabled, false)
  })

  it('persists fixed misses so re-entering the report reloads cleared progress', async () => {
    const updatedResult = { ...reportResult, fixedMisses: { 'm1-q2': true, 'm2-q1': true } }
    await act(async () => {
      root.render(null)
    })
    await act(async () => {
      root.render(
        createElement(ExamReport, {
          exam,
          result: updatedResult,
          onRetake: () => {},
          onChangeTiming: () => {},
          onExit: () => {},
        }),
      )
    })
    assert.equal(button('Review every question')?.disabled, false)
    assert.match(container.textContent ?? '', /Score summary/)
  })
})

describe('the report review page', () => {
  it('leads the review with the score and the skill breakdown', async () => {
    await renderReport()
    await fixOneMiss('B')
    await fixOneMiss('A')

    assert.match(container.textContent ?? '', /1 of 3 correct/)
    assert.match(container.textContent ?? '', /1:30 past the clock/)

    const review = button('Review every question')
    assert.ok(review)
    await act(async () => review.click())

    const page = container.querySelector('.exam-review-page')
    assert.ok(page, 'the review page renders')

    // One right out of three scored questions, so two wrong: 810 - 2 x 10.
    const summary = container.querySelector('.exam-score-summary')
    assert.match(summary?.textContent ?? '', /790/)
    assert.match(summary?.textContent ?? '', /1\/3/)

    const skills = container.querySelector('.exam-skills')
    assert.match(skills?.textContent ?? '', /Craft and Structure/)
    assert.match(skills?.textContent ?? '', /Words in Context/)

    // The section breakdown opens on module 1 with its tagged columns.
    const table = container.querySelector('.exam-breakdown__table')
    assert.ok(table, 'the section breakdown table renders')
    assert.match(table.textContent ?? '', /Text Structure and Purpose/)
    assert.match(table.textContent ?? '', /Medium/)
    assert.match(table.textContent ?? '', /1:05/)
  })

  it('opens one question from the table and marks it reviewed', async () => {
    const rows = Array.from(
      container.querySelectorAll<HTMLTableRowElement>('.exam-breakdown__table tbody tr'),
    )
    const second = rows[1]?.querySelector<HTMLButtonElement>('.exam-breakdown__review')
    assert.ok(second)
    await act(async () => second.click())

    const detail = container.querySelector('.exam-review-detail')
    assert.ok(detail)
    assert.match(detail.textContent ?? '', /Question 2/)
    assert.match(detail.textContent ?? '', /you chose A, the key is B/)
    assert.match(detail.textContent ?? '', /Correct answer/)
    assert.match(detail.textContent ?? '', /Passage for m1-q2/)

    // Every reviewed question carries the written breakdown, not just the key.
    const explain = detail.querySelector('.exam-explain')
    assert.ok(explain, 'the review detail carries the explanation')
    assert.match(explain.textContent ?? '', /Why B is the answer/)
    assert.match(explain.textContent ?? '', /Line for m1-q2 choice A/)

    const back = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button'),
    ).find((entry) => entry.textContent?.trim() === 'Back to the table')
    assert.ok(back)
    await act(async () => back.click())

    assert.ok(container.querySelector('.exam-breakdown__review--done'))
  })

  it('restores reviewed state from result.reviewedQuestions', async () => {
    const testDiv = dom.window.document.createElement('div')
    dom.window.document.body.appendChild(testDiv)
    const testRoot = createRoot(testDiv)
    await act(async () => {
      testRoot.render(
        <ExamReview
          exam={exam}
          result={{
            answers: { 'm1-q1': 'B' },
            flagged: [],
            finishedAt: 1000,
            timeLeft: {},
            overtime: {},
            questionSeconds: {},
            untimed: false,
            timingLabel: 'Standard (32m)',
            reviewedQuestions: { 'm1-q1': true },
          }}
        />,
      )
    })

    const doneButton = testDiv.querySelector('.exam-breakdown__review--done')
    assert.ok(doneButton, 'restores reviewed status from result prop')
    await act(async () => testRoot.unmount())
  })
})
