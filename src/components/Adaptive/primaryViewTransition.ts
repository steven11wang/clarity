export type PrimaryConsoleView =
  | 'lessons'
  | 'library'
  | 'practice'
  | 'drill'
  | 'exam'
  | 'reviews'
  | 'reflect'
  | 'arena'
  | 'words'

// Nav order, left to right: Learn (lessons + library), Practice (its own rail
// plus drills and the exam), Reflect (the daily return, the vault, and the
// error record), Arena, Words. Drills sit between the paths and the exam
// because that is where the rail tile is - a built set is a step up from a
// path lesson and a step down from sitting the whole section. The vault sits
// just after Reflect because that is the only place you now open it from. The
// transition reads direction off this list, so it has to match what the header
// shows.
const PRIMARY_VIEW_ORDER: PrimaryConsoleView[] = [
  'lessons',
  'library',
  'practice',
  'drill',
  'exam',
  'reflect',
  'reviews',
  'arena',
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
