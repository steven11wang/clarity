import type { TrapType } from '../types.ts'

// The five distractor patterns a student classifies in Step 4. The hint is the
// one-line tell that helps them recognize the pattern on future questions.
export const TRAP_TYPES: { id: TrapType; label: string; hint: string }[] = [
  { id: 'too-extreme', label: 'Too extreme', hint: 'Overstated — “always,” “never,” “proves.”' },
  { id: 'half-right', label: 'Half right', hint: 'Starts true, then one part goes wrong.' },
  { id: 'true-but-irrelevant', label: 'True but doesn’t answer', hint: 'A real fact — just not what was asked.' },
  { id: 'out-of-scope', label: 'Out of scope', hint: 'Brings in something the text never covers.' },
  { id: 'opposite', label: 'Opposite', hint: 'Says the reverse of what the text says.' },
]

export const TRAP_LABELS: Record<TrapType, string> = Object.fromEntries(
  TRAP_TYPES.map((trap) => [trap.id, trap.label]),
) as Record<TrapType, string>
