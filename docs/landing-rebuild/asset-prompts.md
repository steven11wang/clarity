# Clarity landing rebuild · asset prompts

Generate in this order. The start frame comes first because the video is made from
it, and the four plates copy its grade. Every prompt already carries the standing
guard ("no text, no logos, no lettering anywhere") because generators love to sneak
in fake calligraphy and seals, and a single stray glyph fails the whole shot.

**The world, in one line:** warm sepia ink wash on aged cream rice paper, five ink
values, verdigris bronze as the cool note, oxidized bronze gold as the warm one,
and at most one dot of cinnabar per image.

**The bronze rule.** Bronze is the fusion element and it stays a detail, never a
wash: a fret band in the cloud, a bell at a pavilion, patina caught in a pine
shadow. If bronze reads as the subject of the image, it is too much, and the image
gets re-rolled.

---

## 1 · Hero start frame (image)

Aspect 16:9, 2K or larger. This is frame one of the video, so it must be composed
as a beginning, not as a finished picture.

```
A Song dynasty ink wash landscape on warm cream rice paper, seen from a high
vantage looking down a river valley, composed as the first moment of a slow
descent that will follow the river down through parting mist to a still pool.
Soft morning light from the upper right, mist lying along the valley floor.
Warm sepia ink in five values from pale wash to near black, one cool blue grey
thread in the water. High in the sky a band of cloud is drawn as a verdigris
bronze fret pattern, weathered and patinated like an old ritual vessel, and one
small pavilion on a far ridge carries an oxidized bronze roof with a single dot
of cinnabar red at its ridgepole. The left half of the frame is far mist and
receding sky, painted as continuous soft grey wash going back into depth; the
near ridges and pines mass on the right. Fine brush texture, visible paper
grain, cinematic, 16:9. No text, no logos, no lettering anywhere.
```

Check before animating: no invented calligraphy or seal marks anywhere, the bronze
fret reads as cloud rather than as machinery, and the left half stays open enough
for headlines to sit in it.

---

## 2 · Hero video (image to video, from the frame above)

1080p, 6 seconds, standard mode, no audio. Not 4K: the web copy gets re-encoded and
compressed anyway.

```
One continuous shot, no cuts. The camera descends slowly down the river valley,
from the high vantage to the water, following the river's bend as parting mist
opens the ridges one after another. The mist stays alive: it drifts and thins
across the pines, and the water carries slow ripples the whole way down. The
verdigris bronze fret in the cloud band drifts with the mist and passes out of
frame overhead as the camera sinks. Ink blooms softly at the edge of each ridge
as it enters frame, as if the painting is still wet. As the camera passes
through the last band of mist the lens softens for a beat and clears again.
The shot ends at rest: the camera settled low over a still pool, the river
arriving into it in one slow closed curve, a small pavilion with an oxidized
bronze roof on the right bank, the water almost motionless in warm cream paper
light. Nothing moves at the end but the faintest ripple on the pool.
No text or lettering anywhere.
```

Why this shot: scrolling down reads as descending, it is one subject on one
unbroken path, and everything in it (mist, water, distant silhouettes) is what AI
video renders cleanly. The ending is the product's own thesis, the river closing
back into itself, and that resting frame becomes the still image the page settles
on.

---

## 3 · The four plates (images)

Aspect 3:2, 2048 x 1365 or larger. Same grade as the hero, so the row finally
reads as one set instead of four unrelated pictures. Append this clause to every
one of the four:

```
Warm sepia ink wash on aged cream rice paper, five ink values, one cool blue
grey accent line, one verdigris bronze detail, at most one dot of cinnabar,
fine brush texture, visible paper grain, 3:2. No text, no logos, no lettering
anywhere.
```

**01 · Paced path**

```
An ink wash mountain seen from the side, a stone path climbing it in clear
stages, each stage a little higher than the last, small bridges spanning the
gaps between them, two tiny walking figures partway up. A thin blue grey line
traces the whole route from the foot to the summit pavilion. The pavilion's
bell is verdigris bronze.
```

**02 · Everything in one place**

```
A scholar's courtyard seen from slightly above, four open rooms facing one
shared central court, a single old pine at its centre, readers at low desks in
each room. One thin blue grey line runs from room to room across the courtyard,
linking all four. A verdigris bronze water basin sits at the centre of the
court.
```

**03 · Words, understood fast**

```
A reader at a low desk beside an open window, one book open in front of them,
a single thin ink thread lifting off the open page and curling into a small
soft cloud above it. The cloud's inner edge is drawn as a fine verdigris bronze
fret. A blue grey line runs from the page to the cloud.
```

**04 · What you miss returns**

```
A river bending back on itself in a full closed circle around one small island
with a single pavilion on it, still water, low mist along the banks. The blue
grey line follows the river all the way round and meets itself. The pavilion
roof is oxidized bronze with one dot of cinnabar at its ridgepole.
```

---

## 4 · The closing drawing (image, re-render)

The current one is the page's weakest asset: it is a 2400 pixel wide JPEG stretched
across the full window, so on any modern screen the browser is enlarging it past
its real size, and JPEG smears fine pencil hairlines. This re-render fixes the
resolution, the codec, and the composition in one pass.

Export at 3200 x 1800 or larger, and save as **PNG**, not JPEG. Line art on near
white is the one case where JPEG visibly fails.

```
A fine pencil line drawing on warm cream paper: a young woman in flowing robes
standing and reading an open book, drawn in delicate hatching, her long hair
falling loose. She stands to the right of centre, turned slightly toward the
left of frame. The upper left third of the paper is open and empty, only faint
paper texture. Far ink wash ridges sit low at both edges of the frame, small
and pale, with a pine on the right ridge. The drawing has generous margin below
her hands, so her figure is complete and nothing is cut off at the bottom edge.
One small verdigris bronze hair ornament is the only colour in the drawing.
No text, no logos, no lettering anywhere.
```

The empty upper left matters: the page's watermark type sits there. In the current
build the watermark runs across her face and hair, which is what makes that section
look like a mistake.

---

## What I derive myself, at no cost

The scrub encode, the poster frame, the settle still, the social preview image, and
the favicon. Nothing there needs generating.


---

## What actually shipped, and one thing to know

Generated 15 August 2026, processed the same day.

**The video came back strong and was trimmed rather than re-rolled.** The raw clip
runs 6 seconds. From about 4.0 seconds a pavilion fades in over the mist on the
right: its roof is drawn in a flat graphic style that does not match the brush
work around it, and it reads as floating. Two repair passes were tried on the
pixels and both looked worse than the flaw, so the clip is cut at 3.80 seconds,
where the composition arrives cleanly and the artifact has not appeared yet.

Nothing is lost by the cut. The page maps scroll position to progress, not to
seconds, so the full descent still plays across the whole hero; it simply ends at
a better frame. The resting frame is now the river arriving through the valley
with the ridge and pines massed right.

If you ever want the last two seconds back, re-roll the video with one line added
to the prompt: the pavilion on the right bank sits firmly on the rock, painted in
the same ink brush as the ridge, with no flat colour. Then re-encode without the
`-t 3.80` trim.

**Processed files, all in `public/brand/landing/`:**

- `hero-scrub.mp4`, 1920 by 1080, 3.80 seconds, 4.8 MB, a keyframe every 8 frames
- `hero-poster.jpg` and `hero-ending.jpg`, pulled from the encode
- `plate-01.jpg` to `plate-04.jpg`, 1600px wide, one clean pass
- `reader-close.jpg`, the full 3200px drawing
- `/og.png`, cut from the resting frame

The raws stay in `~/Downloads/Assets` and never enter the deploy folder.
