# Clarity Sign-In Concept Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and verify one polished concept image for Clarity's calm, premium, scholarly sign-in page.

**Architecture:** Use the built-in image-generation route to create a front-facing, implementation-ready UI mockup from the approved design brief. Inspect the result for composition, text legibility, brand fit, and prohibited visual elements, then save the accepted image as a versioned project asset.

**Tech Stack:** Built-in Codex ImageGen, local image inspection, PNG asset validation

## Global Constraints

- Deliver one high-fidelity desktop UI mockup at a 16:10 presentation ratio.
- Use warm ivory, ink charcoal, parchment gray, muted jade, and one cinnabar-red seal.
- Show the exact approved sign-in copy and no additional readable copy.
- Keep the interface front-facing, rectilinear, accessible, and realistically implementable.
- Avoid people, devices, hands, neon, glassmorphism, dashboards, charts, watermarks, and extra logos.
- Preserve the calm, premium, scholarly tone of `The Quiet Archive`.

---

### Task 1: Generate and Verify the Quiet Archive Concept

**Files:**
- Read: `docs/superpowers/specs/2026-08-16-clarity-sign-in-concept-design.md`
- Create: `public/brand/auth/clarity-sign-in-quiet-archive-v1.png`

**Interfaces:**
- Consumes: the approved design spec and existing Clarity brand references under `public/brand/auth/`
- Produces: one versioned PNG concept image suitable for design review

- [ ] **Step 1: Generate the first concept**

Use the built-in image-generation tool with this production prompt:

```text
Use case: ui-mockup
Asset type: high-fidelity desktop sign-in page concept, 16:10 presentation ratio
Primary request: Create a calm, premium, scholarly sign-in page for Clarity titled "The Quiet Archive". The result must look like a polished, realistically implementable web interface, shown straight-on with no device frame.
Scene/backdrop: warm ivory xuan-paper-inspired canvas with extremely subtle natural grain; a low-contrast monochrome shanshui ink landscape occupies the right 56% and softly dissolves into the page; a fine vertical rule creates a gentle transition rather than a hard split.
Subject: left 44% contains the sign-in experience with generous whitespace. At top, an elegant "Clarity" wordmark beside one tiny cinnabar-red square seal. Center the form vertically. Use an elegant literary serif for the heading and a clean humanist sans serif for interface text.
Composition/framing: editorial grid, spacious margins, exact alignment, restrained scale, front-facing flat UI. Form hierarchy: heading, supporting sentence, Google button, subtle divider, labeled email and password fields, forgot-password link, primary sign-in button, account-creation link, quiet footer note.
Lighting/mood: soft ambient daylight, calm, intelligent, trustworthy, collected, premium academic journal quality.
Color palette: warm ivory, ink charcoal, parchment gray, muted jade focus details, cinnabar red only for the seal.
Text (verbatim): "Clarity"; "Welcome back"; "Continue your practice with clarity."; "Continue with Google"; "or continue with email"; "Email address"; "Password"; "Forgot password?"; "Sign in"; "New to Clarity? Create an account"; "Your progress stays with you."
Constraints: all text must be legible and spelled exactly; keep form labels visible above fields; use thin charcoal input borders; use a dark ink primary button; the landscape must remain atmospheric and secondary to the form; no extra readable copy.
Avoid: collage, mood board, device frame, perspective distortion, people, hands, glowing neon, floating orb, glassmorphism, dashboard widgets, charts, excessive Chinese text, dramatic shadows, watermarks, extra logos, illegible microtext.
```

- [ ] **Step 2: Inspect the generated image**

Open the output and confirm all of the following:

- The sign-in task is immediately clear.
- The composition reads as roughly 44% form and 56% atmospheric artwork.
- The approved palette and restrained scholarly mood are present.
- The landscape supports rather than competes with the form.
- No prohibited elements are visible.
- The principal copy—wordmark, heading, fields, and actions—is legible and correctly spelled.

- [ ] **Step 3: Perform one targeted revision if required**

If inspection reveals one material defect, edit the generated concept with a single focused instruction that restates all invariants. Examples include `reduce only the landscape contrast while keeping the interface unchanged` or `correct only the sign-in button text to "Sign in" while keeping layout, palette, and all other text unchanged`.

- [ ] **Step 4: Save the accepted image in the project**

Copy the selected output non-destructively to:

```text
public/brand/auth/clarity-sign-in-quiet-archive-v1.png
```

- [ ] **Step 5: Validate the saved artifact**

Run:

```bash
file public/brand/auth/clarity-sign-in-quiet-archive-v1.png
test -s public/brand/auth/clarity-sign-in-quiet-archive-v1.png
```

Expected: the file is a non-empty PNG image with landscape dimensions close to 16:10.

- [ ] **Step 6: Commit the concept asset**

```bash
git add public/brand/auth/clarity-sign-in-quiet-archive-v1.png
git commit -m "design: add Clarity sign-in concept"
```
