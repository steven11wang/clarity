# Remove All Domains Button

## Goal

Remove the top-right `All domains` control from the domain path header shown in the supplied screenshot.

## Scope

- Modify only `src/components/Adaptive/DomainPath.tsx`.
- Remove the button and its click handler usage from the header.
- Preserve the Clarity wordmark, all domain cards, dashboard navigation, and domain-path behavior.
- No new UI or replacement control is needed.

## Verification

- Confirm the `All domains` label and button are no longer rendered by the domain path component.
- Run the repository test suite and production build.

