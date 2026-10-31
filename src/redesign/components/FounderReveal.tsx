// The moment a founding-member code goes in. A sealed card shakes, bursts open
// on a ring of light, the Summer Scholar pops out among paper confetti, the
// honor title stamps itself under your name, and the drops count up. About two
// seconds; a click or a key skips to the end, Esc closes. With reduced motion
// everything simply fades in.

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

import { FOUNDER } from "../game/content.ts";
import { getGame } from "../game/store.ts";
import { go } from "../router.ts";
import { play } from "../sound.ts";
import { FounderBadge } from "./FounderCode.tsx";
import { InkGlyph } from "./Glyphs.tsx";
import { useCountUp } from "./hooks.ts";
import { Tangyuan } from "./Tangyuan.tsx";

const INKS = [
  "var(--yellow)",
  "var(--pink)",
  "var(--green)",
  "var(--blue)",
  "var(--orange)",
  "var(--violet)",
];

// the beats, in ms; the CSS uses the same numbers
const BEATS = { open: 700, title: 1300, drops: 1750 };

export function FounderReveal({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [skipped, setSkipped] = useState(false);
  const [drops, setDrops] = useState(0);
  const shown = useCountUp(drops, 700);
  const name = getGame().name.trim() || "Founder";

  // paper scraps, thrown once
  const confetti = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => {
        const angle = (i / 30) * Math.PI * 2 + Math.random() * 0.4;
        const reach = 140 + Math.random() * 170;
        return {
          x: Math.cos(angle) * reach,
          y: Math.sin(angle) * reach * 0.8 - 40,
          r: Math.round(Math.random() * 540 - 270),
          ink: INKS[i % INKS.length],
          w: 6 + Math.round(Math.random() * 7),
          delay: Math.round(Math.random() * 90),
        };
      }),
    [],
  );

  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    const timers = [
      window.setTimeout(() => play("rip"), BEATS.open - 80),
      window.setTimeout(() => play("holo"), BEATS.open + 60),
      window.setTimeout(() => play("stamp"), BEATS.title),
      window.setTimeout(() => {
        setDrops(FOUNDER.welcomeDrops);
        play("ink");
      }, BEATS.drops),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const skip = () => {
    if (skipped) return;
    setSkipped(true);
    setDrops(FOUNDER.welcomeDrops);
  };

  const close = (to?: string) => {
    dialog.current?.close();
    onClose();
    if (to) go(to);
  };

  return (
    <dialog
      ref={dialog}
      className={`reveal ${skipped ? "is-skipped" : ""}`}
      aria-labelledby="reveal-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={skip}
      onKeyDown={(event) => {
        if (event.key !== "Escape" && event.key !== "Tab") skip();
      }}
    >
      <div className="reveal__stage">
        <div className="reveal__focus">
          <div className="reveal__burst" aria-hidden="true">
            <span className="reveal__rays" />
            <span className="reveal__ring" />
            {confetti.map((bit, i) => (
              <span
                key={i}
                className="reveal__bit"
                style={{
                  ["--x" as string]: `${bit.x}px`,
                  ["--y" as string]: `${bit.y}px`,
                  ["--r" as string]: `${bit.r}deg`,
                  ["--d" as string]: `${bit.delay}ms`,
                  width: bit.w,
                  height: bit.w * 1.6,
                  background: bit.ink,
                }}
              />
            ))}
            <span className="reveal__card">
              <span className="reveal__seal">GS</span>
            </span>
          </div>

          <div className="reveal__hero">
            <Tangyuan outfit={FOUNDER.outfit} size={190} mood="wow" />
          </div>
        </div>

        <div className="reveal__words">
          <p className="reveal__kicker">Welcome to Clarity,</p>
          <h2 className="reveal__name display" id="reveal-title">
            {name}
          </h2>
          <span className="reveal__honor">
            <FounderBadge size="lg" />
          </span>
          <p className="reveal__drops num">
            <InkGlyph size={20} /> +{shown} drops{" "}
            <span>
              · {FOUNDER.goalDrops} more on your {FOUNDER.goalDays}th study day
            </span>
          </p>
        </div>

        <div className="reveal__actions">
          <button
            type="button"
            className="btn btn--lg btn--hl"
            onClick={(event) => {
              event.stopPropagation();
              close("/me");
            }}
          >
            See my profile <ArrowRight />
          </button>
          <button
            type="button"
            className="btn btn--ghost reveal__later"
            onClick={(event) => {
              event.stopPropagation();
              close();
            }}
          >
            Keep going
          </button>
        </div>
      </div>
    </dialog>
  );
}
