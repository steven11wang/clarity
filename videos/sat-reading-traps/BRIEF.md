---
workflow: general-video
destination: youtube-shorts / tiktok / reels
aspect: 1080x1920 (9:16)
length: 40.5s
voice: ElevenLabs "Laura" (FGY2WhTYpPnrIDTdsKH5), eleven_multilingual_v2, speed 1.08
style: Mistake Notebook (docs/redesign/DESIGN.md)
---

## Intent

Clarity's own take on the "SAT Reading tips" Short format (reference: Gohar Khan,
youtube.com/shorts/I36gc0OuLMw — the reference itself could not be downloaded from
the build machine, so no footage, audio or wording from it is used). Original script
built on Clarity's five named traps and its return-loop thesis.

## Hook decisions (research summary)

- Frame 0 is never blank: headline and a crossed-out answer card are on screen at t=0.
  Most guidance puts the swipe decision at 2–3 s on Shorts, which tolerates a slow
  build less than TikTok.
- Problem-first / loss-framed opener ("You're losing SAT Reading points on questions
  you actually understood") — problem–solution and pain-point hooks are reported as
  the strongest for educational niches.
- Open loop immediately ("Here's why… one of five traps") plus a 5-bubble progress
  HUD, so viewers know how much is left.
- Pattern interrupt roughly every 3–4 s (page turn, stamp, red-pen mark, flip).
- Captions burned in, word-synced from ElevenLabs timestamps, for sound-off viewing.

Evidence is mostly creator/vendor blogs, so figures are directional. Sources:
- https://dev.to/bulkdl/hook-engineering-the-science-of-the-first-3-seconds-in-short-form-video-2026-2jp9
- https://shortsfast.com/blog/faceless-shorts-hooks-retention-2026/
- https://www.clipspeed.ai/blog/viral-hook-formulas-shorts-tiktok.html
- https://blitzcutai.com/blog/best-youtube-shorts-hooks-2026

## Safe zones (1080x1920)

All reading content sits in x 92–930, y 220–1420: clear of the top ~200 px title
overlay, the bottom ~480 px caption/description bar and the right ~150 px button rail
(conservative union of Shorts/TikTok/Reels guides, e.g.
https://reap.video/blog/short-form-video-safe-zones). Preview in each app before posting.

## Rebuild

    npx --yes hyperframes@0.9.13 render -q standard -o renders/sat-reading-traps-1080x1920.mp4

Voice: script.txt -> ElevenLabs /v1/text-to-speech/{voice}/with-timestamps;
assets/voice.mp3 + assets/alignment.json; assets/words.js holds word timings.
