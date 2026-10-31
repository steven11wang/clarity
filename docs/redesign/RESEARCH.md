# Redesign research: 洋葱学园, retention, colour

Research behind the Mistake Notebook Neon redesign preview (`/redesign.html`). Written 2026-10-30.

## 1. What 洋葱学园 does

The 洋葱学园 macOS app was opened on this machine, but it stops at an account login
(“个人账号注册/登录” or a teacher-issued account), so the in-app screens below come from
published teardowns rather than direct use. The login screen itself already shows the
house style: white field, a chibi character centred with a speech bubble asking one
question, and one big yellow pill button underneath.

| Mechanic | How 洋葱学园 runs it | Source |
|---|---|---|
| 洋葱币 (coins) | Earned by learning knowledge points, finishing tasks, and 试炼场 practice or PK. Spent on outfits (buy or gacha draw). | woshipm 4230870, haoad123 706 |
| Outfits / 形象 | Anime avatar dressed with coins. Clothing tiers S / A / B; S and A pieces boost coin earnings. Sets give bonuses. Sources: coins, 试炼场 rank rewards, ladder rewards, puzzle fragments. | haoad123 706 |
| 试炼场 PK + ranks | Seasonal ranked arena, 青铜 → 白银 → 黄金 → 钻石 → 学霸, modelled on 王者荣耀. Practice mode doesn't move rank; PK wins earn points, coins and promotion. Losing can drop a tier. | woshipm 4230870, haoad123 706 |
| 能力 radar | A six-dimension ability radar (23 ability points) lit up as knowledge points are learned, like a game power chart, plus an ability leaderboard. | woshipm 4230870, haoad123 706 |
| Interactive video | 5–8 minute animated lessons with a question roughly every minute; the video won’t continue until it’s answered. Wrong answers get an explanation and a similar question. | woshipm 4230870 |
| 葱能 | “Onion energy” growth points tied to behaviour and achievement; the company says extrinsic rewards are meant to hand off to intrinsic motivation. | 163.com JCEMFQ3K |
| Mistake Notebook + 高频错题 | Automatic wrong-question book; a “frequently missed” set with a PK mode on speed and accuracy. | 163.com K510CLB3 |
| Social | Friends, likes, friend leaderboard, weekly performance vs. class average; no chat. | haoad123 706 |
| Characters | A recurring cast (暖暖老师, 李狗蛋, 王小锤…) reused across lessons and the AI companion. | 163.com JCEMFQ3K |

## 2. What keeps learners coming back

| Finding | Evidence | Used in the redesign as |
|---|---|---|
| Separate the streak from the daily goal | Duolingo let one lesson extend the streak instead of the full goal: D14 retention +3.3%, DAUs +1%, learners on 7+ day streaks up 40%+ a year on. | One turned-in page keeps the streak; the daily goal (1/2/4 pages) is its own meter. |
| Streak freezes | Duolingo reports allowing a second freeze lifted daily learners ~0.38% (secondary source). | Correction tape: one roll covers a missed day, hold up to two, earn one every 7 days. |
| Endowed progress | Nunes & Drèze 2006: pre-stamped loyalty cards (2 of 10 done) were redeemed at 34% vs 19% for blank 8-stamp cards. | The weekly stamp card arrives with its first stamp (赠) already on it. |
| Goal gradient | Kivetz, Urminsky & Zheng 2006: people speed up as a reward gets closer. | Visible meters everywhere: level, daily goal, quests, rank, holo-pity countdown. |
| Leagues need to be climbable | Duolingo’s leagues reward engagement because engaged users rise into harder tiers. | Weekly study group, top 3 promote; rival pace tuned so two pages a day reaches the top three. Rivals are labelled sample data. |
| Confusion kills week one | Yu-kai Chou on onboarding: confusion, not boredom, loses new users. | Two taps of onboarding, then straight into page one. The landing page lets a visitor answer a real question before any sign-up. |
| Fun can fight learning | A large-scale math-game experiment found the most engaging (easiest) conditions produced the slowest learning. | Rewards are weighted to the hard part: a beaten comeback pays 20 XP / 10 ink vs. 10 XP / 4 ink first time. No feedback during the answer pass. |
| Extrinsic rewards fade | 洋葱学园’s own framing; standard self-determination theory. | Stars, radar and the Mistake Notebook clearing are the long-term goals; ink and stickers are the short loop. Nothing is for sale. |

## 3. Colour

The research on colour and learning is thin. The best evidence (a systematic review of
LMS colour schemes; an ASU thesis on colouring in multimedia learning) points to:
consistent colour coding and high contrast lower cognitive load; colour raises
enjoyment more than it raises learning. No study supports “more saturated = more
engagement” on its own.

So the palette is bright but disciplined:

- **One ink per domain, always the same.** Craft and Structure = pink, Information and
  Ideas = green, Standard English Conventions = orange, Expression of Ideas = blue. Tags,
  path chapters, radar spokes and tabs all use them, so colour carries meaning.
- **Navy text on every ink.** All highlighter fields pass WCAG AA for body text with
  `#17183B` (pink ≈ 6.6:1, yellow ≈ 13:1).
- **Red only grades.** Red correction pen marks misses, due comebacks and stamps,
  nothing decorative.
- **Gradients only on rewards.** Holo foil stickers are the one gradient in the system.

## 4. World chat? Not an open one — a checked Study Hall chat

**Recommendation: no open, free-text world chat.** Build the social pull with preset
phrases, stickers, presence, friends and challenges instead. Reasons:

- **The audience is mostly minors.** SAT takers are 15–18, and many of Clarity’s
  students are Chinese-speaking. China’s 未成年人网络保护条例 (in force 2024-01-01,
  art. 43) requires a minor mode for social features, and a draft rule would route
  all social service for under-16s through it. The US COPPA rule (amended 2025,
  compliance by 2026-04-22) covers under-13s, and Apple’s guideline 5.1.4 names “the
  ability to chat” as personal data that triggers children’s-privacy duties.
- **Free text means a moderation operation.** App Store guideline 1.2 requires, for
  any user-generated content: a filter for objectionable posts, report with timely
  response, block, and published contact details. It also says apps used for
  “random or anonymous chat” do not belong on the App Store.
- **Open chat is where minors get hurt.** Roblox faced dozens of lawsuits in 2025
  alleging grooming through chat (Louisiana’s attorney general among the
  plaintiffs), and in November 2025 began requiring age checks before anyone can
  chat, limiting minors to similar-age peers. Many suits also name Discord,
  because predators move kids off-platform.
- **Learning apps that tried it pulled back.** Duolingo closed its forums in March
  2022 (no official reason survives; users point to moderation). 洋葱学园 has friends
  and likes but no chat.
- **It doesn’t serve studying.** A chat feed competes with the page for attention;
  presence and cheers support it.

**What was built first (the “Ultimate Safe Chat” model Club Penguin used for kids):**
presence, preset phrases, stickers, cheers, challenges and hide, with no typing.

**Round four — owner decision (2026-10-30): typed messages, kept clean.** The Study
Hall is now a chat: four quick phrases, five 汤圆 stickers, and a message box. What
holds the line on harmful language:

| Layer | What it does |
|---|---|
| Checked twice | `chatModeration.ts` runs on the sender before a message leaves *and* on every receiver before it is shown, so a modified client can’t put a blocked message on anyone’s screen |
| Harm | swearing and sexual words (with spacing, accents, zero-width and 1337 disguises undone), slurs, insults aimed at a person (“you are so …”), threats, “kys”/“go die” |
| Contact | emails (also “at/dot” spelled out), phone-length digit runs, links and domains, @handles, Snap/Insta/Discord/WeChat/QQ…, “dm/text/add me” — the usual first step in moving a minor off-platform |
| Personal | age, school, where you live, photos, “meet up”, real name |
| Care | a message about hurting oneself is never broadcast; the writer privately gets a note pointing to 988 (US) and findahelpline.com |
| Spam | 180-character cap, character floods, shouting, repeats, one message per 2.5 s |
| Accounts | online, typing needs a signed-in account so a report can name the sender; phrases and stickers work without one |
| Report + hide | every message has a flag: the sender is hidden at once and, online, the message goes to the `feedback` table for a person to read |
| Nothing stored | messages ride the live bus and vanish; there is no history to leak |

A word list is not a moderation team. Before an online launch with typed chat:
a moderation API on the server path (OpenAI moderation or Perspective, both free at
this volume), someone reading reports daily (Apple 1.2 asks for “timely response”),
a published contact address, and for China a 未成年人模式 that hides the box.

## 5. Sound effects — yes, small and switchable

The evidence is modest: a 2025 review of serious-game sound found sound mostly used
for motivation, and a small learning-game study (n = 23) found earcons improved
perceived competence, flow and attention. A history-game study found sound alone
didn’t raise test scores. So sound is for feel, not for learning, and must never be
required to understand anything.

Rules used (from the build-game-audio-feedback skill and the research):

- Every cue confirms an action or a reward; nothing plays on its own, nothing loops.
- Short (most under 0.2 s), quiet, and always paired with something visible.
- One switch in the header (in Me on phones), remembered; volume slider in Me.
- Exams are silent regardless of the switch — test day is calm.
- On iPhone the audio session stays “ambient”, so the ringer switch still mutes it
  (Safari’s default; WebKit engineers confirm ambient audio follows the mute switch).
- Synthesised with Web Audio: no files to download, voices capped at 10.

## 6. Playing friends by code

Classroom games (Kahoot, Blooket, Quizlet Live) all join with a short code or a
link, no friend request needed. Clarity’s live app already had six-character
invite codes over Supabase Realtime; the redesign reuses that protocol message for
message, adds the share link (`/redesign.html#/arena/join/CODE`), copy/share
buttons, rematch, and preset-only emotes during the match. Codes skip look-alike
characters (0/O, 1/I/L) so they survive being read aloud.

## 7. Selling water drops (10 = $1)

| Finding | Source | What the shop does |
|---|---|---|
| Card fees are ~2.9% + 30¢; the flat fee is ~30% of a $1 sale and 6% of $5 | NerdWallet, Stripe pricing summaries | Smallest pack is $1.99; packs run $1.99–$19.99 |
| Packs usually come in 3–6 tiers with a bonus that grows with size; higher-tier discounts raise revenue more than a flat discount | Microsoft Xbox store guidance; mobile pricing guides | 0% / +10% / +20% / +30% bonus |
| FTC's Jan 2025 order against Genshin Impact's publisher ($20M): no loot boxes for under-16s without parental consent; disclose odds and virtual-currency exchange rates | FTC, PC Gamer, Bleeping Computer | Random sticker packs are never sold; checkout asks who's paying and routes under-18s to a parent |
| EU consumer authorities' key principles (Mar 2025): show the real-money price wherever virtual currency is spent; don't exploit minors | CPC Network summaries (Reed Smith, Bird & Bird, Linklaters) | Every drop price has a dollar price beside it; the rate is on the shop's first line |
| China caps minors' game top-ups: none under 8; 8–16 ¥50 per payment, ¥200 a month; 16–18 ¥100 / ¥400 | 2019 NPPA notice (via The Paper, IT Home) | A monthly limit ($50) on every account |
| US iOS apps may link to web checkout since the 2025 Epic v. Apple rulings; in-app digital goods otherwise go through Apple IAP | court-ruling summaries (Median, Neonpay) | Web checkout only; noted for a future app |

## Sources

- [洋葱学院产品分析报告 — woshipm](https://www.woshipm.com/evaluating/4230870.html)
- [4600字拆解洋葱学院用户成长体系 — haoad123](https://www.haoad123.com/article/706.html)
- [拆解洋葱学园AI智能学伴 — 网易](https://www.163.com/dy/article/JCEMFQ3K0536W4EI.html)
- [洋葱学园用了220天 — 网易](https://c.m.163.com/news/a/K510CLB30526A92U.html)
- [Improving the streak — Duolingo blog](https://blog.duolingo.com/improving-the-streak/)
- [Behind the product: Duolingo streaks — Lenny’s Newsletter](https://lennysnewsletter.com/p/behind-the-product-duolingo-streaks)
- [Jorge Mazal on Duolingo growth — Glasp](https://glasp.ai/quotes/jorge-mazal)
- [4 experience phases: onboarding — Yu-kai Chou](https://yukaichou.com/gamification-study/4-experience-phases-gamification-2-onboarding-phase/)
- [Optimizing challenge in an educational game — AMiner](https://www.aminer.org/pub/53e9999eb7602d97021e125b/optimizing-challenge-in-an-educational-game-using-large-scale-design-experiments)
- [Endowed progress, car wash study — Silicon Canals](https://siliconcanals.com/t-car-wash-loyalty-cards-endowed-progress/)
- [Goal pursuit / goal gradient — Wikipedia](https://en.wikipedia.org/wiki/Goal_pursuit)
- [UI colour schemes in instructional design — DLSU](https://animorepository.dlsu.edu.ph/conf_shsrescon/2026/BoA_CLI/11)
- [Colouring in multimedia learning — ASU thesis](https://repository.asu.edu/attachments/207638/content/Williams_asu_0010N_18183.pdf)
- [App Review Guidelines (1.2, 5.1.4) — Apple](https://developer.apple.com/app-store/review/guidelines/)
- [Amended COPPA Rule — Federal Register, 2025-04-22](https://www.govinfo.gov/content/pkg/FR-2025-04-22/pdf/2025-05904.pdf)
- [Children’s Online Privacy in 2025: The Amended COPPA Rule — Loeb & Loeb](https://www.loeb.com/en/insights/publications/2025/05/childrens-online-privacy-in-2025-the-amended-coppa-rule)
- [Roblox age-checks everyone who wants to chat — Tubefilter](https://www.tubefilter.com/2025/11/18/roblox-age-verification-system-chat-requirements/)
- [Roblox announces new safety measure amid lawsuits — Good Morning America](https://www.goodmorningamerica.com/news/story/roblox-announces-new-safety-measure-amid-spate-lawsuits-127626071)
- [Duolingo forums shutting down March 22 — MetaFilter](https://metatalk.metafilter.com/26027/Duolingo-forums-shutting-down-March-22)
- [未成年人网络保护条例解读 — 中伦律师事务所](https://www.zhonglun.com/research/articles/56843.html)
- [Club Penguin: making child’s play of online safety — ITPro](https://itpro.com/security/20321/club-penguin-making-child-s-play-online-safety)
- [Serious-game sound design review — SciTePress 2025](https://scitepress.org/Papers/2025/135044/135044.pdf)
- [WebKit bug: Web Audio muted by the ringer switch](https://lists.webkit.org/pipermail/webkit-unassigned/2024-September/1186593.html)
- [AudioSession.type — MDN](https://developer.mozilla.org/docs/Web/API/AudioSession/type)
- [build-game-audio-feedback skill — skills.sh](https://skills.sh/mengto/skills/build-game-audio-feedback)
- [FTC: tips from the Genshin Impact settlement](https://ftc.gov/business-guidance/blog/2025/01/level-tips-businesses-ftcs-settlement-genshin-impact-developer-hoyoverse)
- [FTC Genshin Impact $20M order — PC Gamer](https://www.pcgamer.com/games/rpg/ftc-says-genshin-impact-deceived-children-and-orders-its-publisher-to-pay-a-usd20-million-fine-and-stop-selling-loot-boxes-to-kids)
- [FTC cracks down on Genshin Impact gacha — Bleeping Computer](https://www.bleepingcomputer.com/news/gaming/ftc-cracks-down-on-genshin-impact-gacha-loot-box-practices)
- [Q&As on the EU joint guidance on virtual currencies — Reed Smith](https://www.reedsmith.com/articles/qas-on-the-eu-consumer-protection-authorities-joint-guidance-paper/)
- [EU move on harmful video-game practices — Bird & Bird](https://www.twobirds.com/en/insights/2025/european-move-towards-protecting-users-from-harmful-practices-in-video-games-eu-consumer-protection)
- [Stripe fees explained — NerdWallet](https://www.nerdwallet.com/business/software/learn/stripe-fees)
- [Consumable currency tiers — Microsoft Xbox store docs](https://devdocs.xbox.com/publishing/xstore-commerce/xstore-consumables)
- [Premium currency pricing tricks — GamesBrief](https://www.gamesbrief.com/2014/09/premium-currency-pricing-trends-and-tricks/)
- [Epic v. Apple payment links ruling explained — Median](https://median.co/blog/epic-v-apple-payment-links-ruling-explained)
- [Epic v. Apple appeal, Dec 2025 — Neonpay](https://www.neonpay.com/blog/the-latest-epic-v.-apple-appeal-ruling-december-2025-what-changed-for-game-developers)
- [未成年人游戏充值限额 — 澎湃新闻](https://m.thepaper.cn/newsDetail_forward_6646338)
