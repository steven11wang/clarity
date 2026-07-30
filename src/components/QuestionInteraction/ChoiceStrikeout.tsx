type AbcToggleProps = {
  active: boolean
  onToggle: () => void
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
