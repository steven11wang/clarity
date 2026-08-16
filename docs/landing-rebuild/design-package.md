# Clarity landing rebuild · design package

The single source for the rebuild. Every line of copy below ships word for word.
The band ranges are starting points, validated later by the flick test.

## 1 · The brand premise

One character carries the whole site: 回, return. It is the name of the bronze
fret pattern that runs around old ritual vessels, a line that leaves and comes
back to itself, and it is exactly what Clarity does with a question you got wrong.
The page teaches one idea: practice only works when what you missed comes back.
Every section serves that, or it does not belong.

## 2 · Palette

Sampled from the hero painting so the page and the footage read as one place.
Bronze is the fusion note and stays a detail: a fret, a rule, a hover state,
never a field of colour.

```css
:root{
  --paper:      #F2EEE3;   /* 宣纸, the ground. never white */
  --paper-lift: #F7F4EC;
  --paper-deep: #E7E0D0;

  --ink:    #14110C;       /* 墨, five values, never black */
  --ink-80: rgba(20,17,12,.80);
  --ink-58: rgba(20,17,12,.58);
  --ink-38: rgba(20,17,12,.38);
  --ink-18: rgba(20,17,12,.18);
  --ink-10: rgba(20,17,12,.10);

  --patina:      #3F7D72;  /* 青铜 patina. the fret, the counters, the loop */
  --patina-soft: rgba(63,125,114,.22);
  --bronze:      #9A7B3F;  /* oxidized bronze. rules, hover, small marks */
  --bronze-soft: rgba(154,123,63,.20);

  --thread: #4A6B8A;       /* the blue grey drawn line inside the artwork */
  --cinnabar: #B3382B;     /* the seal and the one CTA. nothing else */
}
```

The old `--azure: #2459C4` retires. It was louder than anything in the paintings
and it was why the plates looked pasted on.

## 3 · Type

- Display: **Cormorant Garamond**, 300 and 400.
- Body: **Instrument Sans**, 400 and 500.
- Labels: **JetBrains Mono**, 500.
- Chinese: **Noto Serif SC**, 300.

Ma Shan Zheng gets dropped. It was loading a whole brush font to draw one glyph;
the 清 seal becomes an inline SVG instead, which also makes it the favicon.

## 4 · The band map

Hero is 450vh of scroll driving one 3.80 second shot (the 6 second raw, cut at its cleanest arrival; the reason is at the end of `asset-prompts.md`).

| Band | Range | Footage moment | Copy (verbatim) | Entrance |
|---|---|---|---|---|
| 1 | 0.00 to 0.30 | high vantage, mist lying in the valley | "The score stops moving. / The practice tests keep coming." | drift-down, one time load ramp |
| 2 | 0.34 to 0.62 | descent, ridges parting one by one | "Doing more questions was never the fix. / Going back to the ones you missed is." | blur to sharp, echoing the mist clearing |
| 3 | 0.70 to 1.00 | arrived in the valley, the river running through it | "Clarity through practice" / "Everything you get wrong comes back, on the day you were about to lose it." / CTA "Start practicing" | word by word rise into a staged settle |

Bands sit in the left of frame, where the painting keeps its open wash. The action
lane on the right stays clear.

## 5 · Static hero copy (phones and reduced motion)

Over the settle frame, no journey behind it:

- Headline: "Clarity through practice"
- Subline: "Everything you get wrong comes back, on the day you were about to lose it."
- CTA: "Start practicing"

## 6 · Below the fold

Order, revised 15 August after the first review: the doubts come first, because
that is what a visitor is actually holding when they land. Then how it works,
then the features with the pictures given real room, then the moment they perform
themselves, then the close.

1. Straight answers (the objections)
2. How it works (the three steps)
3. Features (four wide plates, sides alternating)
4. Watch a question come back
5. The close

Every section funnels to the same one call to action: **Start practicing**. The
plans page is a quiet secondary link, never a second competing button.

**a · How it works.** One vertical sequence, not three columns: numbered beads
on a bronze thread that draws itself down the left, the third one in cinnabar
because the return is the point.
- Attempt · "You answer first, before anything is explained."
- Reflect · "Then you see why the right answer is the right one."
- Return · "It comes back later, timed to the day you were about to forget it."

**b · Features.** One wide plate per row with the writing beside it, sides
alternating so no two rows share a skeleton. The pictures run about 800px on a
1440 screen, roughly two and a half times the old card size.
- 01 Paced path · "Learn at the right pace" · "A guided route through every domain and skill, so you always know what to work on next."
- 02 One place · "Everything in one place" · "Lessons, domain practice, full exams, the guide and your words. One place, not six tabs."
- 03 Dictionary · "Words, understood fast" · "Look a word up inside the passage you are reading. The digital SAT tests words in context, so that is where you learn them."
- 04 Return loop · "What you miss returns" · "Missed questions and words come back on a schedule built around when people forget."

**c · The interactive moment.** Section titled "Watch a question come back."
Press and hold the bronze fret and it draws itself into a full 回; when the line
closes, a question you missed reappears with its explanation. Release early and
the line eases back rather than snapping. Reduced motion gets the finished state
with no holding. Microcopy: "Hold to close the loop." Finished state: "That is the
whole idea."

**d · The objections, in the words people actually use.**
- "My score is stuck around 1200. Does this help?" · "A plateau usually means the same mistakes keep coming back untouched. That is the one thing this is built to fix: your misses return on a schedule instead of waiting for you to remember them."
- "I already use Bluebook and Khan Academy." · "Keep them. Take your practice tests where you like. This is where the questions you got wrong go afterward, so they stop repeating."
- "Do I need to memorize a thousand words?" · "No. The digital SAT asks what a word is doing in a sentence, so you look it up inside the passage and it returns to you later in context."
- "How much time does this take a day?" · "Fifteen minutes clears a normal day's returns. A missed exam takes longer, because more comes back."

**e · The close.** The re-rendered drawing, the watermark in open paper beside her,
and the last CTA.
- Eyebrow: "Focus · Reflect · Master"
- Line: "Start with the questions you already got wrong."
- CTA: "Start practicing"

**f · Footer.** wresearch, the plans link, GitHub, and one plain line noting the
artwork is generated for Clarity.

No form. The product is used directly, so the call to action opens the app instead
of collecting an address, and nothing on the page pretends to send mail it cannot
send.

**g · Pricing.** No free tier. Two paid plans, both opening with a 3 day free
trial: **Pro at $79 a month** for the season around a test date, and **Master at
$668 a year** for the whole build, which works out at $55.67 a month and saves
$280 against paying monthly. The trial terms are stated once, above the sheet:
cancel inside the app before day three and nothing is charged.

## 7 · The vector layer

Drawn by hand as SVG, in patina and bronze:

- **The 回 fret rule.** The signature. A meander band that draws itself on scroll
  as the divider between every major section. Path length animated by
  `stroke-dashoffset`, driven by an IntersectionObserver, final state shown under
  reduced motion.
- **The loop badge.** A small closed 回 that completes as the interactive moment
  is held.
- **Corner marks** on the plate sheet, two strokes per corner, bronze at low
  opacity.
- **Ink motes.** Six to nine slow drifting specks in one fixed background layer,
  60 second cycle, paused off screen and on hidden tabs. This is the one fixed
  environment layer that makes the page feel like a place.
- **The 清 seal**, inline SVG, cinnabar, also the favicon.

## 8 · The engineering standard

The scrub hero gets all of it: the streamed Blob fetch with an honest loading ring,
the frame rate normalized lerp that rests when it converges, gated seeks that never
overlap, DOM writes only on change, bands paced in scroll distance and validated by
the flick test, the four layer legibility system audited against each band's worst
frame, the five static hero gates kept live with change listeners, and a page that
is complete and beautiful if the video never loads. Around it: nothing snaps, one
living element per section at whisper level, one interactive moment, transform and
opacity only, reduced motion honoured in both directions.

## 9 · Measured, not assumed

Verified on the built page, 1440 by 900:

- Worst-frame contrast under the hero text: 6.29:1 across nine samples, floor is 3.5:1.
- Flick test: bands hold full opacity for 7, 6 and 11 steps of 120px; nothing is skippable at 360px.
- Phones and reduced motion never request the video, and the static hero carries the page.
- With the video blocked, the hero fails cleanly to the poster and the page stays complete.
- No sideways overflow at 1440 or 375. Zero console errors. First contentful paint 264ms.

## 10 · The copy gate

Every viewer facing line above ships verbatim. Before anyone sees the build it must
grep clean: zero em dashes, zero instances of leverage, seamless, empower, unlock,
robust, actionable, data-driven, solutions, plus a sweep for the quieter tells.
The deliberate devices here are craft and stay: the three verbs, and the plain
staccato of "One place, not six tabs."
