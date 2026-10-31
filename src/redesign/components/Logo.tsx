export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="logo">
      <span className="logo__seal zh" aria-hidden="true">
        清
      </span>
      {!compact && <span className="logo__word">Clarity</span>}
    </span>
  )
}
