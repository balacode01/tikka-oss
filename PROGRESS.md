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

## Blockers

- None for M1.
- Dashboard checks for Supabase Auth (see PLAN.md, human steps).

## Next

- M2 Security (`feature/m2-security`): helper functions, §6.5 policies, grants per policy, and `supabase/tests/rls.sql`.
