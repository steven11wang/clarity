# Lesson portal room design

## Goal

Replace the four-card Lessons landing with an immersive portal room based on `v1Clarity Lessons - Portals.dc.html`, adapted to Clarity's dark cobalt console.

## Experience

The selected SAT domain appears in a centered hero with its name, description, and an "Enter this path" action. Four perspective doorway buttons frame the room and switch the selected domain. A dark continuation console at the floor shows the recommended lesson and opens it directly.

## Presentation

The room uses the reference's radial light, floor plane, doorway perspective, and centered silhouette, but in Clarity navy, cobalt, translucent glass, and existing per-domain accents. The selected door remains visibly highlighted. The scene fits the console panel at desktop sizes; at narrow widths, it becomes a compact non-3D selector with the same action and content.

## Behavior and boundaries

Existing `SAT_DOMAINS`, `DOMAIN_PRESENTATION`, lesson content, selection callbacks, and seen-state storage stay unchanged. The portal hero's primary action opens the first lesson in the selected domain; the continuation action opens the recommended lesson. The existing detailed lesson-row list is removed from this landing.

## Verification

Add DOM coverage for the four portals, primary selection action, and continuation action. Run focused DOM tests, the theme test, and the production build.
