import { BookA } from 'lucide-react'

type AbcToggleProps = {
  active: boolean
  onToggle: () => void
}

export function DictionaryToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`dictionary-toggle ${active ? 'dictionary-toggle--active' : ''}`}
      aria-label={active ? 'Turn off dictionary' : 'Turn on dictionary'}
      aria-pressed={active}
      title="Click any word in the passage, question, or choices to see what it means"
      onClick={onToggle}
    >
      <BookA size={16} strokeWidth={1.6} aria-hidden="true" />
      <span>Dictionary</span>
    </button>
  )
}

export function AbcToggle({ active, onToggle }: AbcToggleProps) {
  return (
    <button
      type="button"
      className={`abc-toggle ${active ? 'abc-toggle--active' : ''}`}
      aria-label={active ? 'Hide answer markers' : 'Show answer markers'}
      aria-pressed={active}
      onClick={onToggle}
    >
      <span aria-hidden="true">ABC</span>
      <span className="abc-toggle__slash" aria-hidden="true" />
    </button>
  )
}

type ChoiceMarkerProps = {
  letter: string
  struck: boolean
  disabled?: boolean
  onToggle: () => void
}

export function ChoiceMarker({ letter, struck, disabled = false, onToggle }: ChoiceMarkerProps) {
  return (
    <button
      type="button"
      className={`choice-marker ${struck ? 'choice-marker--struck' : ''}`}
      aria-label={`${struck ? 'Restore' : 'Strike out'} choice ${letter}`}
      aria-pressed={struck}
      disabled={disabled}
      onClick={onToggle}
    >
      <span aria-hidden="true">{letter}</span>
    </button>
  )
}
