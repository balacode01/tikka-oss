# Tikka plan

Source of truth for scope and milestones: `project_brd_mvp1.md` (the BRD). This file records the decisions and the setup state.

## Branching

- `main`: production. Receives PRs from `staging` only.
- `staging`: promotion branch. Receives PRs from `dev` only.
- `dev`: integration branch. Receives PRs from feature branches only, after testing.
- Feature branches: `feature/<name>`, `fix/<name>`, `chore/<name>`, `db/<name>`. Start from the latest `dev`, and open PRs with `--base dev`.
- Nobody commits directly to `dev`, `staging`, or `main`.

## Preflight (M0)

| Check | Result |
|---|---|
| Node | 22.23.4 |
| npm | 10.9.9 |
| git | 2.50.1 |
| gh | logged in as balacode01 (repo, workflow scopes) |
| psql | 18.6 (Homebrew libpq, on PATH via `~/.zshrc`) |
| Supabase CLI | 3.0.0 (via `npx`), project `ihcrucgmweeiqrfvzdxx` (Tikka, ap-southeast-2), linked |
| Database | connected through the session pooler, PostgreSQL 17.11 |
| Vercel | deferred to M8 |

## Stack (installed versions)

- React 19.3, Vite 8.3, TypeScript (`<6.1`), React Router 8.5, TanStack Query 5.107
- `@supabase/supabase-js` 2.119
- Tailwind CSS 4.3 with `@tailwindcss/vite`; design tokens from BRD §7.2 in `src/styles/index.css`
- `@base-ui/react` 1.9, `@dnd-kit/core` 6.3, `@dnd-kit/sortable` 10.0, `cmdk` 1.1
- `react-hook-form` 7.91, `zod` 4.6, `@hookform/resolvers` 7.0
- `sonner` 2.0, `react-day-picker` 10.0, `lucide-react` 1.70
- Vitest 5.1 (pure helpers only)

## Scripts

- `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm run preview`

## Milestones

- **M0 Setup:** scaffold, packages, tokens, branches. In progress.
- **M1 Schema:** migrations for the BRD §6.1 tables, constraints, indexes, triggers, views. Generate `src/types/database.ts`.
- **M2 Security:** private helper functions, RLS policies, `supabase/tests/rls.sql`.
- **M3 Functions:** BRD §6.4 functions and `supabase/tests/functions.sql`.
- **M4 App shell and auth:** Supabase session, routes, sign up, log in, workspace wizard, seed.
- **M5 Board and Create issue:** columns, drag and drop, create issue.
- **M6 Issue detail and search:** detail page, side panel, Cmd/Ctrl+K.
- **M7 Backlog, Your work, Create project.**
- **M8 Deploy and verify:** Vercel, redirect URLs, two-account test.

## Human steps still open

- Supabase dashboard: turn off "Confirm email" for the build, and add `http://localhost:5173` to the redirect URLs.
- Supabase dashboard, after the first deploy (M8): set the Site URL and add the Vercel URL to the redirect URLs.
- Vercel account and `VERCEL_TOKEN` at M8. Set the two `VITE_` variables in Vercel.
- Turn "Confirm email" back on before real users join.

## Decisions

- `.env` holds the Supabase credentials (not `.env.local`), at the owner's choice. It is git-ignored.
- `.claude/settings.json` carries the BRD §5 permission rules. It is committed.
- No hooks and no GitHub branch protection. The branch rule is enforced by the agent.
- Supabase: one project shared by `dev`, `staging`, and `main`.
- `@supabase/server` was removed (server-side only, not in the stack).
