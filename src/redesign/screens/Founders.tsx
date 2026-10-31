// #/founders — where the Governor's School poster's QR code lands
// (#/founders?code=… fills the code in). Shows the gem collection, the one
// avatar a code unlocks, and the code box.

import { OUTFITS } from '../game/content.ts'
import { useGame } from '../game/store.ts'
import { FounderPanel } from '../components/FounderCode.tsx'
import { GameShell } from '../components/GameShell.tsx'
import { InkGlyph } from '../components/Glyphs.tsx'
import { Tangyuan } from '../components/Tangyuan.tsx'
import '../styles/founders.css'

export function Founders({ code = '' }: { code?: string }) {
  const game = useGame()
  const gems = OUTFITS.filter((outfit) => outfit.art)
  const owned = new Set(game.owned)
  return (
    <GameShell active="me">
      <div className="founders">
        <header className="founders__hero">
          <div>
            <h1 className="display">Founding members</h1>
            <p>
              Clarity started at a Governor’s School summer. Students from that school get a code: the Summer Scholar, a title by
              their name for good, and drops for showing up ten days.
            </p>
          </div>
        </header>

        <FounderPanel initialCode={code} />

        <section aria-labelledby="gems-title">
          <h2 className="title" id="gems-title">
            The gem collection
          </h2>
          <ul className="founders__gems" role="list">
            {gems.map((gem) => (
              <li key={gem.id} className={`gem sheet ${gem.codeOnly ? 'gem--code' : ''}`}>
                <Tangyuan outfit={gem.id} size={112} idle={false} />
                <b>{gem.name}</b>
                <span>{gem.blurb}</span>
                <span className="num">
                  {owned.has(gem.id) ? (
                    'In your wardrobe'
                  ) : gem.codeOnly ? (
                    'Code only'
                  ) : (
                    <>
                      <InkGlyph size={13} /> {gem.price} drops
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </GameShell>
  )
}
