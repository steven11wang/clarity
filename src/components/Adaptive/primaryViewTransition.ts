export type PrimaryConsoleView =
  | 'lessons'
  | 'library'
  | 'practice'
  | 'exam'
  | 'reviews'
  | 'reflect'
  | 'words'

// Nav order, left to right: Learn (lessons + library), Practice (its own rail
// plus the exam and the vault), Reflect (the daily return and the error
// record), Words. The transition reads direction off this list, so it has to
// match what the header shows.
const PRIMARY_VIEW_ORDER: PrimaryConsoleView[] = [
  'lessons',
  'library',
  'practice',
  'exam',
  'reviews',
  'reflect',
  'words',
]

export function primaryViewDirection(
  from: PrimaryConsoleView,
  to: PrimaryConsoleView,
): -1 | 0 | 1 {
  return Math.sign(
    PRIMARY_VIEW_ORDER.indexOf(to) - PRIMARY_VIEW_ORDER.indexOf(from),
  ) as -1 | 0 | 1
}
