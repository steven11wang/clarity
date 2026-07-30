export type PrimaryConsoleView =
  | 'practice'
  | 'lessons'
  | 'library'
  | 'insights'

const PRIMARY_VIEW_ORDER: PrimaryConsoleView[] = [
  'practice',
  'lessons',
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
