import { useEffect, useState } from 'react'

export type ExamTheme = 'dark' | 'light'

const STORAGE_KEY = 'clarity-exam-theme'

// The exam opens in Clarity's dark console skin by default; the light skin is
// the College Board testing-app look, kept behind the in-exam toggle so a
// student can rehearse in the surface they'll actually sit in.
export function useExamTheme(): [ExamTheme, (theme: ExamTheme) => void] {
  const [theme, setThemeState] = useState<ExamTheme>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // A blocked storage quota shouldn't take the exam down.
    }
  }, [theme])

  return [theme, setThemeState]
}
