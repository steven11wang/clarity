# Paced Path Integrated Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce one finished PNG that preserves the supplied ink-landscape artwork and embeds the approved feature copy inside its negative space.

**Architecture:** Use the built-in image editing flow with `F1.png` as the sole edit target and the screenshot as hierarchy reference. Validate the generated bitmap visually, copy the accepted output into the project under a new versioned name, and keep the source files unchanged.

**Tech Stack:** Built-in image generation/editing tool; local image inspection; PNG asset.

## Global Constraints

- Keep the original 16:10 landscape framing and artwork unchanged outside the added typography.
- Preserve every mountain, tree, pavilion, bridge, route curve, node, orange endpoint, ornamental line, and existing color relationship.
- Render the approved English copy verbatim, exactly once, with no additional text, logo, opaque panel, sidebar, border, or watermark.
- Save the result non-destructively in `/Users/s/Desktop/clarity/public/brand/landing/`.

---

### Task 1: Generate and validate the integrated-copy artwork

**Files:**
- Read: `/Users/s/Downloads/F1.png`
- Reference: `/Users/s/Desktop/Screenshot 2026-08-13 at 19.55.15.png`
- Create: `/Users/s/Desktop/clarity/public/brand/landing/paced-path-integrated-copy-v1.png`

**Interfaces:**
- Consumes: the approved design in `docs/superpowers/specs/2026-08-13-paced-path-integrated-copy-design.md`.
- Produces: one display-ready 16:10 PNG with integrated English typography.

- [x] **Step 1: Edit the source artwork using the approved prompt**

  Use case: precise-object-edit. Treat `F1.png` as the edit target and the screenshot only as a typography/copy reference. Change only the addition of typography. In the upper-left negative space, add the small eyebrow `01 · PACED PATH`, a short cobalt rule, and the two-line headline `LEARN AT THE` / `RIGHT PACE`. Near the lower-left edge, add exactly two restrained lines: `Follow a guided path through domains and skills. Build critical` / `thinking while vocabulary grows with every lesson.` Use an elegant high-contrast editorial serif for the headline, a small clean sans serif for supporting copy, dark blue-black ink, restrained teal/cobalt accents, and subtle paper grain. Do not add a text card or alter any scene element.

- [x] **Step 2: Inspect the output at full available detail**

  Confirm the entire original scene remains recognizable and aligned; all route nodes and the orange endpoint remain; headline and body copy are correctly spelled; no extra characters or duplicate text appear; and no opaque panel separates typography from the landscape.

- [x] **Step 3: Perform one targeted correction only if validation fails**

  Re-edit the generated result while restating every invariant and changing only the failed attribute: text accuracy, text placement, legibility, or source-art preservation.

- [x] **Step 4: Save the accepted image non-destructively**

  Copy the accepted generated PNG to `/Users/s/Desktop/clarity/public/brand/landing/paced-path-integrated-copy-v1.png`. Do not overwrite either supplied source image.

- [x] **Step 5: Verify the saved deliverable**

  Confirm the file is a readable PNG, record its pixel dimensions, inspect the saved copy, and report the absolute path plus the exact prompt used.
