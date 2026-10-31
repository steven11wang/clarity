import assert from 'node:assert/strict'
import test from 'node:test'

import { examQid, moduleSeconds, toQuestion, type PracticeExam } from './exams.ts'
import { parseCode } from './friendMatch.ts'
import { PHRASES, cleanName, phraseText } from './hall.ts'

test('a friend code reads from the code, a messy paste, or either kind of link', () => {
  assert.equal(parseCode('K7MPQ4'), 'K7MPQ4')
  assert.equal(parseCode('  k7m-pq4 '), 'K7MPQ4')
  assert.equal(parseCode('http://localhost:5173/redesign.html#/arena/join/K7MPQ4'), 'K7MPQ4')
  assert.equal(parseCode('https://satclarity.com/app/?arena=K7MPQ4'), 'K7MPQ4')
  // look-alikes are not in the alphabet, so a code with them is a typo
  assert.equal(parseCode('K7MPQ0'), null)
  assert.equal(parseCode('K7MPQ'), null)
})

test('preset phrase IDs resolve only to approved phrases', () => {
  assert.equal(phraseText('gl'), 'Good luck today!')
  assert.equal(phraseText('call me at 555-0100'), null)
  assert.ok(PHRASES.every((phrase) => phrase.text.length <= 40))
})

test('nicknames arrive cleaned: short, plain, never empty', () => {
  assert.equal(cleanName('Mina K.'), 'Mina K.')
  assert.equal(cleanName('<b>@mina_insta</b> 📱'), 'bmina_instab')
  assert.equal(cleanName('a'.repeat(40)).length, 20)
  assert.equal(cleanName(''), 'Student')
  assert.equal(cleanName(42), 'Student')
  assert.equal(cleanName('dumbass'), 'Student')
  assert.equal(cleanName('snap mina'), 'Student')
})

test('test-day pace is 32 minutes, extra time is 1.5x, untimed has no clock', () => {
  assert.equal(moduleSeconds(1920, 'test-day'), 1920)
  assert.equal(moduleSeconds(1920, 'relaxed'), 2880)
  assert.equal(moduleSeconds(1920, 'untimed'), null)
})

test('an exam question becomes a Mistake Notebook question that can come back', () => {
  const exam = { id: 'demo-exam', modules: [] } as unknown as PracticeExam
  const question = toQuestion(exam, {
    id: 'module-1-q3',
    number: 3,
    passage: ['First paragraph ______ here.', 'Second paragraph.'],
    figure: null,
    stem: 'Which choice completes the text?',
    choices: [
      { letter: 'A', text: 'one' },
      { letter: 'B', text: 'two' },
      { letter: 'C', text: 'three' },
      { letter: 'D', text: 'four' },
    ],
    answer: 'C',
    topic: 'Craft and Structure',
    subtopic: 'Words in Context',
    difficulty: 'extreme',
    explanation: { summary: 'Because three.', choices: { A: 'No.', C: 'Yes.' } },
  })
  assert.equal(question.id, examQid('demo-exam', 'module-1-q3'))
  assert.equal(question.skill, 'Words in Context')
  assert.equal(question.difficulty, 'Hard')
  assert.equal(question.answer, 'C')
  assert.equal(question.choices.C, 'three')
  assert.match(question.passage, /First paragraph ______ here\.\n\nSecond paragraph\./)
  assert.match(question.rationale, /^Because three\. Choice A: No\. Choice C: Yes\.$/)
})
