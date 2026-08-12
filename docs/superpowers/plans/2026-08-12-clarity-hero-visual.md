# Clarity Hero Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate, validate, and save one project-ready 4:5 hero illustration for Clarity using the approved 「澄明之境」 direction.

**Architecture:** Use the built-in image generator to create a single raster illustration from the approved visual specification. Inspect the generated image against explicit composition and content checks, make one targeted revision only if a critical check fails, then copy the approved asset into Clarity's existing brand asset directory without changing application code.

**Tech Stack:** Built-in Codex ImageGen, local visual inspection, PNG raster asset.

## Global Constraints

- Canvas ratio is 4:5 and composed for the right half of a desktop hero.
- The ground blends into Clarity's `#EDE3CE` xuan-paper background.
- Visual density stays on the right and lower-right; the leftmost quarter remains quiet and low contrast.
- Use warm ink `#17120D`, restrained patina green `#49746B`, and one cinnabar accent `#B3382B`.
- Do not generate typography, calligraphy, watermarks, or readable characters.
- Do not reproduce a recognizable section, figure, or composition from either historical scroll.
- Do not include literal educational, technological, religious, imperial, fantasy, logo, or infinity-symbol imagery.

---

### Task 1: Generate the First-Pass Artwork

**Files:**
- Reference: `docs/superpowers/specs/2026-08-12-clarity-hero-visual-design.md`
- Create temporarily: built-in ImageGen output under the generator's managed output directory

**Interfaces:**
- Consumes: the approved composition, palette, reference translation, and negative constraints in the design specification.
- Produces: one 4:5 PNG candidate suitable for visual inspection.

- [ ] **Step 1: Build the production prompt**

Use the complete structured prompt below:

```text
Use case: stylized-concept
Asset type: standalone right-side landing-page hero illustration, portrait 4:5
Primary request: Create an original modern Chinese ink landscape titled conceptually “澄明之境 / Realm of Clarity.” The image must feel like a premium editorial engraving made from Chinese ink wash, not a reproduction of a historical artwork.
Scene/backdrop: warm xuan paper matching #EDE3CE with subtle natural fibre; an imagined layered riverside mountain landscape fading into mist.
Subject: dry-brush mountain ridges and riverbanks concentrated on the right and lower-right. A slender river-and-ribbon line moves continuously through the landscape and bends into a partly obscured open loop, suggesting practice, feedback, and return without forming a literal infinity symbol. Behind the mountains, reveal only fragments of a low-contrast Shang/Zhou bronze cloud-and-thunder geometric structure, like an archaeological pattern embedded in the image. Add one small irregular cinnabar seal-shaped mark in the lower-right with no characters.
Style/medium: refined 水墨画 ink wash, dry-brush texture, flowing fine “silk-thread” linework, restrained engraving detail, shifting-distance handscroll rhythm, premium contemporary brand editorial art.
Composition/framing: portrait 4:5; strong coherent silhouette on the right; visual detail dissolves toward the left; keep the leftmost 25% quiet, pale, and low contrast; keep important forms within the central 80% safe area.
Lighting/mood: calm, intelligent, spacious, ancient but not nostalgic; soft mist and paper light.
Color palette: warm near-black ink #17120D in several diluted washes; very restrained bronze-patina green #49746B on only parts of the river, distant mist, and tiny mineral accents; exactly one cinnabar accent #B3382B.
Materials/textures: absorbent xuan paper fibres, dry ink, pale wet washes, aged bronze patina used subtly.
Constraints: original composition; no text; no legible seal characters; no watermark; no border.
Avoid: recognizable copied passages or figures from 洛神赋图 or 富春山居图; prominent people or goddesses; scholars, warriors, temples, dragons, phoenixes, ritual vessels; books, screens, brains, light bulbs, graduation caps, circuit boards, robots; literal yin-yang, infinity sign, logo, badge, mandala, symmetrical poster; photorealism, anime, game concept art, bright blue-green pigments, glossy gold, dense calligraphy.
```

- [ ] **Step 2: Generate one candidate**

Run one built-in ImageGen request with no reference image inputs. Preserve the generated result for inspection.

### Task 2: Inspect and Correct the Candidate

**Files:**
- Inspect: the generated PNG candidate from Task 1

**Interfaces:**
- Consumes: Task 1 PNG candidate.
- Produces: one visually approved candidate or one targeted revision request.

- [ ] **Step 1: Inspect at original detail**

Check all of the following:

```text
[ ] portrait composition is approximately 4:5
[ ] dominant mass is on the right and lower-right
[ ] leftmost quarter is quiet and can sit beside landing-page copy
[ ] xuan-paper ground visually matches warm #EDE3CE
[ ] open-loop river/ribbon remains organic and partly hidden
[ ] bronze geometry is secondary rather than a pasted-on border
[ ] patina green is restrained
[ ] exactly one cinnabar accent is visible
[ ] no readable text, calligraphy, watermark, copied figure, or banned iconography appears
[ ] image reads clearly at hero size and retains fine detail at full size
```

- [ ] **Step 2: Revise only if a critical check fails**

If any critical composition or unwanted-content check fails, run one edit with a single correction that names the failed invariant and repeats all elements that must remain unchanged. Do not broaden or restyle the image.

### Task 3: Save the Approved Project Asset

**Files:**
- Create: `public/brand/clarity-hero-chengming-v1.png`

**Interfaces:**
- Consumes: the approved candidate from Task 2.
- Produces: a stable project-local brand asset at `public/brand/clarity-hero-chengming-v1.png`.

- [ ] **Step 1: Copy the approved PNG into the project**

Copy the approved ImageGen output to `public/brand/clarity-hero-chengming-v1.png`. Do not overwrite another existing asset.

- [ ] **Step 2: Verify the saved artifact**

Confirm that the file exists, is non-empty, opens successfully as a PNG, and has a portrait aspect ratio near 0.8.

- [ ] **Step 3: Present the asset for review**

Render the saved project file inline and report its absolute path together with the final prompt and the fact that the built-in ImageGen route was used.
