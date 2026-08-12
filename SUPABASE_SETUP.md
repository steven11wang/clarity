# Supabase setup for Clarity

Clarity uses Supabase Authentication and PostgreSQL. Every progress row belongs
to the authenticated user's immutable UUID. Email is stored for display and
account lookup, but it is not used as a relationship key because a user can
change their email.

## 1. Create and configure the project

1. Create a Supabase project.
2. In **Authentication → Providers**, enable Email.
3. Choose whether email confirmation is required. The app supports both:
   immediate sessions and confirmation-email flows.
4. Open the Supabase SQL editor and run:
   - `supabase/migrations/202607260001_progress_storage.sql`
   - `supabase/migrations/202608110001_word_bank_storage.sql`

The migrations create the identity/profile, score report, normalized progress,
assessment history, question-attempt, review-queue, progression-snapshot, and word-bank
tables. Row-level security restricts every query to `auth.uid()`.

## 2. Connect the app

Copy `.env.example` to `.env.local`, then set:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_ANON_KEY
```

Use the browser-safe anon/publishable key, never the service-role key. Restart
the development server after changing environment variables.

If these variables are absent, Clarity intentionally continues in local-only
mode so local development and the existing test suite still work.

## 3. How persistence works

- `auth.users` is the source of truth for login identity.
- `public.users.id` mirrors `auth.users.id`; all other tables reference it.
- `progression_snapshots` stores the complete validated state-machine document
  for exact restoration.
- `domain_progress`, `skill_progress`, `assessments`, `question_attempts`, and
  `review_queue` provide normalized, queryable history.
- The browser keeps its existing local cache. On first sign-in, local progress
  seeds an empty cloud account. When cloud data exists, it is restored before
  the app opens. Later writes sync automatically.

You can verify isolation by creating two users and checking that each account
only sees its own rows in the Supabase table editor or through the app.
