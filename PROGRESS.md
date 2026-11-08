# Progress

## M0 Setup (merged into `dev`, PR #1)

- [x] Branches `dev` and `staging` created from `main` and pushed.
- [x] Supabase project linked; `.env` works; database reachable through the session pooler.
- [x] `.claude/settings.json` with the BRD §5 rules.
- [x] Supabase CLI config (`supabase/config.toml`) and Supabase agent skills installed.
- [x] BRD §3 packages installed (see PLAN.md for versions).
- [x] Tailwind v4 wired through `@tailwindcss/vite`; BRD §7.2 tokens in `src/styles/index.css`. Token utilities confirmed in the built CSS.
- [x] Google Fonts (Montserrat, JetBrains Mono) and the page title "Tikka" in `index.html`.
- [x] Template files removed; placeholder `src/App.tsx`.
- [x] `vercel.json` rewrite rule (BRD §4).
- [x] `typecheck` script added.
- [x] `npm run build`, `npm run typecheck`, `npm run lint` pass.
- [x] PR into `dev` opened and merged (#1).
- [ ] Vercel link and `vercel whoami`: deferred to M8.

## M1 Schema (branch `feature/m1-schema`)

- [x] Migration `supabase/migrations/20261108102410_core_schema.sql`: 16 tables from BRD §6.1, constraints, indexes, `pg_trgm`, triggers from §6.2, views from §6.3.
- [x] RLS enabled on all 16 tables, with no policies yet (M2).
- [x] Least privilege: `anon` and `authenticated` have no table, sequence or function access. M2 grants per policy.
- [x] Applied to the Tikka project with `npx supabase db push --remote --yes`.
- [x] `src/types/database.ts` generated; `npm run typecheck` passes.
- [x] Rolled-back test: keys `MOB-1` and `MOB-2`, rank 1000 and 2000, status change writes one history row, sign-up creates a profile.
- [ ] PR into `dev` reported and merged after your review.

## Decisions (M1)

- `FORCE ROW LEVEL SECURITY` is off. The owner-run history trigger needs to write, and M2 policies will cover API access.
- `issue_history` is append-only through grants: only `SELECT` for API roles in M2. Not a trigger, so account deletion cascades still work.
- Hard delete is possible for comments and projects. Issues use soft delete (`deleted_at`).
- `comments.updated_at` added, because BRD §6.2 sets it by trigger.

## M2 Security (branch `feature/m2-security`)

- [x] Private helpers in schema `private`: `is_workspace_member`, `workspace_role`, `can_see_project`, `can_edit_project`, `shares_workspace_with`, `is_assignable`. Security definer, stable, empty search path, execute only for `authenticated`.
- [x] BRD §6.5 policies on all 16 tables. Guests can read and comment; they cannot change issues, sprints or project settings.
- [x] Grants match each policy, and only the listed columns (for example `projects.next_number` is not writable by API users).
- [x] Guard trigger: an issue cannot change project, number or key.
- [x] Reporter must be the caller, and assignees must be non-guest members of the workspace.
- [x] `supabase/tests/rls.sql`: passes (all checks, including anonymous access denied and guests blocked).
- [x] Found and fixed while testing: the numbering trigger needed to update a column API users cannot touch, so it now runs as its owner.
- [x] Applied to the Tikka project (`db push --remote --yes`): 25 policies, 6 helpers, no `anon` table grants, anonymous read denied.
- [ ] PR into `dev` reported and merged after your review.

## M3 Functions (branch `feature/m3-functions-v2`)

- [x] `supabase/migrations/20261108110920_functions.sql`: all BRD §6.4 functions. Invoker for issue work (RLS applies); definer only for workspace, project and sprint-state writes, each checking `auth.uid()` and permission itself.
- [x] Execute granted to `authenticated` only.
- [x] `supabase/tests/functions.sql` passes, rolled back. Covers: anonymous denied; duplicate and bad keys rejected with clear messages; project creation adds statuses and the lead; numbering; default status; labels; rank midpoint; status move writes history; second active sprint refused; completion moves open issues; bulk update; recently viewed kept to one row; search literal and visible-only; soft delete; home; another workspace sees nothing.
- [x] Applied to the Tikka project (`db push --remote --yes`): 11 functions, none callable by `anon`.
- [x] M2 merged into `dev` (#3). M3 rebuilt on a clean branch from `dev` (the first branch, stacked on M2, was closed when its base branch was deleted).
- [ ] PR into `dev` reported and merged after your review.

## M4 App shell and auth (branch `feature/m4-app-shell-auth`)

- [x] Design files in `docs/design/`: `tokens.json`, `README.md`, and the auth and home artboards in `docs/design/artboards/`. The Board artboard was not in the canvas.
- [x] Routes from BRD §7.1; protected routes need a session.
- [x] Sign up, log in, forgot and reset password (email and password only).
- [x] Workspace wizard: steps 1 and 3 real, step 2 skip-only.
- [x] App shell: neutral sidebar, top bar with search and Create issue placeholders, avatar menu with Light, Dark and System.
- [x] Theme follows the OS by default; the choice is stored in `localStorage` with try/catch.
- [x] Home ("Your work") uses the `home` function.
- [x] Board shows the project and an empty state (issues arrive in M5).
- [x] `supabase/seed.sql` (BRD §6.6), tested in a rolled-back transaction: 60 issues, 3 projects.
- [x] `npm run typecheck`, `npm run lint`, `npm run build` pass. The bundle is over 500 kB; code-splitting is left for later.
- [ ] Sign-up tested in a browser: needs the Supabase dashboard change (turn off "Confirm email", add `http://localhost:5173` to redirect URLs).
- [ ] Seed run on the Tikka project: needs your user id after the first sign-up.
- [ ] PR into `dev` reported and merged after your review.

## Deviations (M4)

- The avatar menu is a plain popover, not Base UI. Switch to a Base UI menu when Board dialogs are added in M5.
- The Board artboard is not in the design canvas. M5 needs it (or a decision to design the Board from the tokens and README).

## Blockers

- M4 browser test and seed need the Supabase dashboard settings and your user id.
- None for M3.
- None for M1.

## Next

- M4 browser test and the seed (after sign-up).
- M5 Board and Create issue (`feature/m5-board-create-issue`).
