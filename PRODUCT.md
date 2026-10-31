# Product

<!-- impeccable:product-schema 1 -->

> Written 2026-10-30 without an interview: the owner asked for no questions, so every
> fact below is inferred from HANDOFF.md, landing.html and the shipped app, and is
> marked (inferred) where it goes past what those files state outright.

## Platform

web

## Users

High-school students preparing for the digital SAT Reading and Writing section on
their own, mostly on a laptop or phone after school. Many are aiming at a top-30 US
university and need a score near 1550. A large share read Chinese as well as English
(the brand carries 清, and the owner references 洋葱学园 as a model) (inferred).

## Product Purpose

Clarity turns SAT Reading and Writing practice into a return loop: every wrong
answer is redone, diagnosed in the student's own words, and brought back on a spaced
schedule until it is learned. Success is a student who keeps coming back daily and
whose missed questions stop being missed.

## Positioning

Doing more questions was never the fix; going back to the ones you missed is.
Clarity's mechanism is the resurfacing of misses (disguised with shuffled choices)
on the day the student is about to forget them, plus generation before revelation:
the student attempts and diagnoses before any explanation appears.

## Operating Context

- Practice is two-pass: answer every question with a choice and a confidence
  (Sure / Leaning / Guessing) with no feedback, then review only the misses.
- Paced path through 4 domains and 10 skills (Information and Ideas, Craft and
  Structure, Expression of Ideas, Standard English Conventions).
- Lessons, full-length timed practice exams, an in-passage dictionary, saved words,
  a mistake vault, Reflect, and an Arena (1v1 matches, invite codes).
- Five named trap types: too extreme, half right, true but irrelevant, out of
  scope, opposite.

## Capabilities and Constraints

- Vite + React 19 + TypeScript; Supabase auth optional; offline profiles in
  localStorage. Question data loads from `/data/questions.json` (1,647 questions).
- Production routes: `/` is landing.html, `/app` is the React app. Experimental
  pages must stay out of the production build inputs in vite.config.ts.
- Learning is free: no fees, no credit card to practise. Optional water drops
  (10 drops = $1, owner decision 2026-10-30) buy cosmetics and streak savers only;
  random sticker packs and anything that affects learning are never sold.

## Brand Commitments

- Name: Clarity, with the character 清. Domain: satclarity.com.
- Mascot: 汤圆 (tangyuan), a round rice-ball character, with pet variants.
- The return loop is the thesis; any game layer must reward going back to misses,
  never reward skipping them.

## Evidence on Hand

- Real SAT-style question bank in `public/data/questions.json` with rationales.
- College median SAT figures already shown on the live landing page.
- No testimonials, user counts, score-gain statistics or press. Do not invent them;
  any leaderboard or rival shown in a demo must be labelled as sample data.

## Product Principles

1. The miss is the lesson: every mechanic routes the student back to what they got wrong.
2. Attempt before reveal: no feedback or explanation before the student commits.
3. First value in seconds: a visitor can answer a real question before signing up.
4. Rewards follow learning, not time spent; money buys only cosmetics and streak savers.
5. Calm under pressure on test-day surfaces; play everywhere else.

## Accessibility & Inclusion

Teen audience on mixed devices: WCAG AA contrast, full keyboard play, and
`prefers-reduced-motion` respected by every celebration (inferred).
