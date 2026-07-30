# Original Clarity design backup

This folder preserves the live UI files as they existed immediately before the
Cobalt console theme was applied on July 28, 2026.

The backup includes the original global styles, component styles, design
tokens, progression colors, HTML shell, and `main.tsx`.

To restore the original appearance:

1. Copy the backed-up files to their matching locations in the project.
2. Remove `src/console-theme.css`.
3. Run the usual build command to verify the restored design.

No application behavior, data, authentication, routing, or Supabase files are
part of this design-only backup.
