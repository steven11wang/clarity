import type { Question } from '../types.ts'

const QUESTIONS_PATH = '/data/questions.json'

export async function loadQuestions(): Promise<Question[]> {
  const response = await fetch(QUESTIONS_PATH)

  if (!response.ok) {
    throw new Error('Unable to load questions')
  }

  return response.json() as Promise<Question[]>
}
