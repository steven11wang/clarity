// Answer keys for the three exams whose sources ship without one.
//
// CookSAT and TestAdvantage both validate answers server-side and never send
// the correct choice to the page, so these were worked out question by question
// against the passages, tables, and figures. The exams that use them are marked
// `derived` in the JSON, and the player says as much on the report.
//
// The Kaplan diagnostic is not listed here - its key comes with the source.

export const ANSWER_KEYS = {
  'cooksat-test-1': {
    'module-1': {
      1: 'C', 2: 'D', 3: 'C', 4: 'D', 5: 'A', 6: 'D', 7: 'B', 8: 'A', 9: 'B',
      10: 'D', 11: 'C', 12: 'D', 13: 'B', 14: 'A', 15: 'B', 16: 'A', 17: 'A',
      18: 'B', 19: 'C', 20: 'C', 21: 'B', 22: 'C', 23: 'A', 24: 'D', 25: 'B',
      26: 'B', 27: 'C',
    },
    'module-2': {
      1: 'D', 2: 'A', 3: 'A', 4: 'C', 5: 'C', 6: 'C', 7: 'B', 8: 'A', 9: 'D',
      10: 'A', 11: 'C', 12: 'C', 13: 'B', 14: 'B', 15: 'B', 16: 'D', 17: 'A',
      18: 'B', 19: 'C', 20: 'D', 21: 'D', 22: 'B', 23: 'C', 24: 'D', 25: 'B',
      26: 'A', 27: 'B',
    },
  },
  'dsat-june-2026-exam-1': {
    'module-1': {
      1: 'A', 2: 'D', 3: 'B', 4: 'D', 5: 'C', 6: 'C', 7: 'D', 8: 'B', 9: 'B',
      10: 'C', 11: 'A', 12: 'A', 13: 'D', 14: 'B', 15: 'D', 16: 'D', 17: 'D',
      18: 'B', 19: 'D', 20: 'D', 21: 'B', 22: 'C', 23: 'D', 24: 'B', 25: 'A',
      26: 'C', 27: 'D',
    },
    'module-2': {
      1: 'D', 2: 'A', 3: 'D', 4: 'D', 5: 'A', 6: 'A', 7: 'C', 8: 'A', 9: 'A',
      10: 'A', 11: 'C', 12: 'D', 13: 'D', 14: 'C', 15: 'A', 16: 'D', 17: 'B',
      18: 'D', 19: 'D', 20: 'B', 21: 'A', 22: 'D', 23: 'D', 24: 'A', 25: 'D',
      26: 'D', 27: 'B',
    },
  },
  'dsat-aug-2025-us-v2': {
    'module-1': {
      1: 'D', 2: 'D', 3: 'B', 4: 'A', 5: 'D', 6: 'D', 7: 'A', 8: 'B', 9: 'B',
      10: 'D', 11: 'B', 12: 'B', 13: 'D', 14: 'D', 15: 'B', 16: 'C', 17: 'B',
      18: 'D', 19: 'A', 20: 'B', 21: 'D', 22: 'A', 23: 'A', 24: 'A', 25: 'C',
      26: 'D', 27: 'D',
    },
    'module-2': {
      1: 'C', 2: 'A', 3: 'A', 4: 'D', 5: 'C', 6: 'C', 7: 'B', 8: 'A', 9: 'D',
      10: 'D', 11: 'D', 12: 'B', 13: 'C', 14: 'A', 15: 'B', 16: 'C', 17: 'B',
      18: 'C', 19: 'A', 20: 'C', 21: 'A', 22: 'A', 23: 'D', 24: 'A', 25: 'A',
      26: 'C', 27: 'A',
    },
  },
}
