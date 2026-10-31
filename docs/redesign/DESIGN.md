# Mistake Notebook — design system and game

The redesign preview at `/redesign.html` (dev server only). The live site at `/` and
the app at `/app` are untouched: `redesign.html` is not in `vite.config.ts`’s build
inputs, and the game saves under its own key (`clarity-redesign:v1`).

```sh
npm run dev
# then open http://localhost:5173/redesign.html
# (published beta: https://satclarity.com/app/new/)
```

## The idea

Chinese students keep a 错题本 — a mistake notebook of every question they got wrong.
In the product it's called the Mistake Notebook. Clarity’s
whole product is that notebook made automatic: each miss comes back on the day you’d
forget it until you beat it. The redesign makes the notebook the game board: grid
paper, highlighters, red correction pen, paper clips, stamps, stickers.

It replaces the live site’s calm paper-ink-cinnabar look and avoids the edtech default
(blue gradients, white cards, stock students).

## Visual system

**Palette.** Flat highlighter inks, never tinted into gradients:

| Token | Hex | Role |
|---|---|---|
| `--yellow` | `#FFE53B` | brand field, HUD, today, primary highlight |
| `--pink` | `#FF6FB1` | Craft and Structure; the Mistake Notebook tab |
| `--green` | `#5BEA8E` | Information and Ideas; correct answers; path |
| `--orange` | `#FFA23A` | Standard English Conventions; streak |
| `--blue` | `#4CC9FF` | Expression of Ideas; water drops; Exams |
| `--violet` | `#B79BFF` | Speed Round |
| `--red` | `#E5262D` | the red pen only: crosses, ticks, clips, stamps, due |
| `--ink` | `#17183B` | gel-pen navy, all text |
| `--paper` | `#FBFCFF` | cool white grid paper (never cream) |

Holo foil (a conic gradient that follows the pointer) is the one exception, and only
on reward stickers.

**Type.** Anybody (variable width, 118 wdth / 860 wght) for display; Onest for UI;
Source Serif 4 for SAT passages; Gochi Hand for red-pen notes; ZCOOL KuaiLe for 清,
Mistake Notebook and 汤圆.

**Materials.** Notebook sheets with a red margin rule; divider tabs as navigation
(left rail on desktop, bottom on phones); scantron bubbles for every choice and
progress dot; rubber stamps; paper clips; die-cut stickers; correction tape.

**State is a mark, not a colour.** Done = filled bubble or highlighter swipe. Due =
red paper clip. Beaten = four dots filled. Wrong = red cross and strike-through.

**Motion.** Highlighter swipes draw left to right; the red pen draws ticks and
crosses with stroke-dashoffset; stamps land with a small overshoot; pages turn
between questions (and between screens via View Transitions). Everything respects
`prefers-reduced-motion`.

## The game

| 洋葱学园 | Clarity redesign | Why it fits Clarity |
|---|---|---|
| Interactive video with a question every minute | **2-minute lesson**: 汤圆 explains the skill (from `skillLessonIndex.json`), you flip three trap cards, then a checkpoint question you must answer to finish | Lessons stay short; the checkpoint keeps “attempt before reveal” |
| 洋葱币 | **Ink** — earned per answer, doubled for comebacks | Pays most for going back to misses |
| Outfits, S/A/B tiers | **汤圆 wardrobe** (7 outfits) bought with ink; holo stickers unlock outfits | Uses the existing mascot |
| Gacha draws | **Sticker packs**: one per page, plain / gloss / holo, holo guaranteed by pack 10 | Variable reward with a floor; nothing for sale |
| 试炼场 PK, 青铜 → 学霸 | **Speed Round**: 5 questions vs a rival, 30 s each. Ranks: Pencil → Ballpoint → Gel Pen → Fountain Pen → 800 Club | Only mode with instant feedback; misses still go to the Mistake Notebook |
| 能力 radar | **Skill radar** over the 10 skills + **30 stars** (each skill × Easy/Medium/Hard, earned at 4/5) | Shows where the next page should go |
| Friends leaderboard | **Weekly study group** league (sample rivals, top 3 promote) | Labelled as sample until real groups exist |
| Mistake Notebook / 高频错题 | **The Mistake Notebook tab**: every miss clipped with its trap, due date and 4 beat dots; filter by trap; “X has caught you N times” insight | The core loop, now the centre of the game |

**A page, start to finish**

1. **Answer** 5 questions (plus up to 2 due comebacks, choices shuffled), each with
   Sure / Leaning / Guessing. No feedback. Keyboard: A–D, then 1–3.
2. **Turn in.** The red pen marks the whole page in one sweep; a score stamp lands.
3. **Fix each miss:** redo it with your first answer crossed out, name the trap,
   then read the explanation. The miss is clipped to come back tomorrow.
4. **Rewards:** XP and level, ink, streak, star (if earned), quest progress, and a
   sticker pack to tear open.

**Comebacks** return at 1, 3, 7 and 21 days. Beating one moves it out a stage; missing
it sends it back to tomorrow; beating all four clears it for good.

**Streak:** one page a day. Correction tape covers a missed day (hold two; earn one
every 7 days; or buy one for 50 ink). The daily goal (1, 2 or 4 pages) is separate.

**Daily quests** (3 a day, “Turn in a page” always first) and a **weekly stamp card**
(starts with one stamp; six stamps = two packs and 60 ink).

## Round two: sign-in, exams, friends, sound

**Sign in** (`#/signin`, `#/signup`) is a student card on the yellow desk. Same
Supabase calls as the live app (Google, email + password, reset link, display name),
so an account made here is the same account in `/app`. On a server without Supabase
it says so and keeps a profile on this device. The front page’s Sign in links now go
here instead of the old page. *Supabase only redirects to allow-listed URLs: add
`/redesign.html` under Auth → URL configuration to test Google sign-in.*

**Navigation:** tabs are Today · Path · Mistake Notebook · Arena · Exams. Me moved to the 汤圆
avatar in the header, next to the sound switch.

**Exams** (`#/exams`, `#/exam/:id`): the live app’s five full R&W tests as booklets
(Diagnostic + Practice Tests 1–4), three paces (test day 32 min/module, extra time
1.5×, untimed), saved after every answer so a sitting resumes. Test day is plain
paper, no game layer, no sound: hideable clock, five-minute warning, mark for review,
cross-outs, question grid, a review page, and a break between modules. The report
card gives the live app’s scaled estimate, domain bars in the domain inks, the gap to
the target picked at onboarding, every miss with its explanation — and clips answered
misses into the Mistake Notebook (blanks are pacing, so they’re counted but not clipped).

**Arena** (`#/arena`): Speed Round vs a sample rival (ranked, as before); **Play a
friend** — Invite gives a six-character code, copy-code, copy-link and share; Have a
code takes the code, a messy paste, or the whole link; `#/arena/join/CODE` joins
straight from a link. Friend matches are live: both see the same five questions, the
other side’s ticks and crosses land on the scoreboard as they happen, stickers and
four preset phrases fly across (mutable), rematch is one tap for both, and the
opponent can be saved as a friend. **Your friends** shows who’s in the hall now with a
Challenge button. **Study Hall**: live presence, preset phrases and stickers only,
cheers, challenges, hide. (Round four turned this into a moderated chat; see below.)

Transport: Supabase Realtime (broadcast + presence) when configured, speaking the live
app’s Arena protocol so codes interoperate; otherwise BroadcastChannel between tabs of
one browser (each tab its own player), labelled “tabs on this computer only”.

**Sound** (`src/redesign/sound.ts`): 21 synthesised cues (pencil tap, page turn, red
pen tick/cross, stamp, clip, pack rip, sticker reveal, holo shimmer, level up, streak,
comeback beaten, clock ticks, win/lose, emote, friend joined…). Header switch + Me
volume; remembered; exams silent; iPhone ringer switch respected.

## Round three: path, names, drops

- **Path:** every section's first stop is open from day one; inside a section, a stop
  opens when the one before it is done. Open stops in other sections are inked in
  their domain colour with an “open” tag.
- **Names:** the notebook is the **Mistake Notebook** (tab: Mistakes); the currency is
  **water drops** (was ink).
- **Drops for money:** 10 drops = $1, four packs, a shop at `#/shop` (the drops count
  in the header opens it). Prices were rescaled so items cost $1–$6. Full setup, prices
  and open decisions in [PAYMENTS.md](PAYMENTS.md); research in RESEARCH.md §7.

## Round four: Arena in three tabs, Study Hall chat

- **Arena tabs** — `#/arena` (Play), `#/arena/ranks`, `#/arena/hall`. Notebook index
  tabs on a ruled line; the selected one is a paper card and its label gets a
  highlighter swipe in its own ink (Play yellow, Ranks blue, Study Hall violet).
  Arrow keys move between them; every panel stays mounted, so a hosted friend code
  or a half-read chat survives a switch. New messages put a red count on the Study
  Hall tab.
- **Play** — the Speed Round card (rank, RP, progress, Find a rival), Your friends,
  and Play a friend.
- **Ranks** — “From Pencil to 800 Club”: the five pens joined by a stroke that inks in
  as you climb, your rank filled with its colour, RP to go on the rest. Beside it, “A
  little friendly perspective”: four sample players and you, sorted by RP, labelled
  as examples.
- **Study Hall** — a chat: theirs on the left in paper, yours on the right in violet.
  Four quick phrases (Good luck today! · Anyone up for a Speed Round? · Just beat a
  comeback! · Nice one!), stickers, and a message box checked by
  `chatModeration.ts` (RESEARCH.md §4). Flag or hide on every message; people here
  now with cheer, challenge, add friend, hide; hall rules beside it.

## Round five: gem avatars and founding members

- **Gem collection** — four painted 汤圆 portraits (`src/redesign/assets/avatars/`,
  cut out and resized to 480 px WebP): Jade Atelier 70 drops, Moonlit Scholar 90,
  Obsidian Regent 120, and Summer Scholar, which is code-only. Portraits can't
  change face, so moods show as a tilt or a hop.
- **Founding-member code** for the Governor’s School promotion. Default code
  kept out of the repo (case, spaces and dashes ignored; only its SHA-256 is in the page;
  `VITE_FOUNDER_CODE_SHA256` adds another). It gives the Summer Scholar (worn at
  once), a foil **Founding member** title shown on Me, in the Study Hall and on the
  Ranks board, and $10 of drops split 30 now + 70 on the tenth study day after the
  code: days, not a streak, so a missed day never costs it.
- **Small code line** — in the Shop and under the wardrobe on Me, it's a dashed
  “Have a code?” pill that opens an inline box; afterwards it becomes the ten-day
  walk. Only `#/founders` has the full panel.
- **Honor title** — a notched foil ribbon (the WoW/Halo pattern: a title placed
  after the name). On Me it sits beside your name above the level; in the header
  your avatar gets a foil ring and a star pip; the Study Hall and Ranks board show
  a small “Founder” ribbon.
- **The reveal** — a full-screen `<dialog>`, about two seconds: a sealed card with a
  red GS seal drops in and shakes (0–0.7 s), bursts on a ring of light and turning
  rays, the Summer Scholar pops out among paper confetti (0.75 s), your name rises,
  the ribbon lands like a stamp (1.3 s), +30 drops count up (1.75 s), then “See my
  profile”. Sounds follow the beats. A click or key skips to the end; Esc closes;
  reduced motion drops the burst and fades the same content in, in order.
- **Where to enter it** — `#/founders` (poster/QR page; `#/founders?code=…` fills it
  in), the Shop, and Me. Online with an account, `redeem_founder_code()` in
  `supabase/migrations/202610300002_founder_codes.sql` decides (one per account, use
  cap, end date; not applied yet).

## Beta at /app/new

`redesign.html` is now a build input and is published at `/app/new/` (GitHub Pages
folder from `tools/prepare-pages-build.mjs`; same mapping in `vite.config.ts` and
`server/sitesWorker.ts`). `/app/` is still the current app. On a published build:
buying drops is off until Stripe Payment Links are set (no free test checkout), the
preview tools on Me are hidden, and invite, share and sign-in links point at the
page's own address.

## Files

| Path | What |
|---|---|
| `redesign.html` | Dev-only entry, direction contract in the first body comment |
| `src/redesign/game/engine.ts` | All game rules as pure functions (tested in `engine.test.ts`) |
| `src/redesign/game/content.ts` | Domains, skills, traps, path, stickers, outfits, ranks, quests |
| `src/redesign/game/questions.ts` | Loads `/data/questions.json`, picks pages, disguises comebacks |
| `src/redesign/game/store.ts` | localStorage save + demo clock |
| `src/redesign/game/live.ts` | realtime bus: Supabase Realtime or BroadcastChannel |
| `src/redesign/game/friendMatch.ts` | invite codes, join links, live match moves |
| `src/redesign/game/hall.ts` | Study Hall presence, phrases, typed messages, reports, challenges |
| `src/redesign/game/promo.ts` | founder code check (hashed) |
| `src/redesign/game/chatModeration.ts` | message checks: harm, contact, personal, care, spam (tested) |
| `src/redesign/game/exams.ts` | exam catalogue, sittings, results, exam → Mistake Notebook |
| `src/redesign/sound.ts` | Web Audio cues and the sound switch |
| `src/redesign/game/payments.ts` | drop packs, monthly limit, preview and Stripe checkout |
| `supabase/migrations/202610300001_drop_purchases.sql`, `supabase/functions/drops-webhook/` | server side of drops (not applied or deployed) |
| `src/redesign/screens/` | Landing, SignIn, Start, Today, Path, Play, Notebook, Arena, FriendMatch, ExamHall, ExamRunner, Shop, Me, Lesson |
| `src/redesign/styles/` | `base.css` tokens and primitives, `landing.css`, `game.css`, `auth.css`, `social.css`, `exam.css`, `shop.css`, `arena.css` |

**Preview tools** (Me → Preview tools): jump the clock a day to see comebacks come
due, and reset the preview game.

## Known gaps

- Rivals, the league and the landing radar are sample data and say so on screen.
- Questions with figures or underlined portions are left out of new pages (the plain
  text bank has no underline markup).
- Game progress (XP, Mistake Notebook, friends) still lives in the browser; signing in identifies
  the player but doesn’t sync progress yet — that needs tables in Supabase.
- Friends on other devices need Supabase configured (copy the main checkout’s
  `.env.local` into this worktree); without it, friend matches work between tabs.
- Before an online launch: a server-side moderation API for typed messages, someone
  reading reports daily, and a published contact address (App Store 1.2).
