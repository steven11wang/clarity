export type PrimaryConsoleView =
  | 'practice'
  | 'exam'
  | 'lessons'
  | 'reviews'
  | 'words'
  | 'library'
  | 'insights'

const PRIMARY_VIEW_ORDER: PrimaryConsoleView[] = [
  'practice',
  'exam',
  'lessons',
  'reviews',
  'words',
  'library',
  'insights',
]

export function primaryViewDirection(
  from: PrimaryConsoleView,
  to: PrimaryConsoleView,
): -1 | 0 | 1 {
  return Math.sign(
    PRIMARY_VIEW_ORDER.indexOf(to) - PRIMARY_VIEW_ORDER.indexOf(from),
  ) as -1 | 0 | 1
}
