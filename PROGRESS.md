# Progress

## M0 Setup (branch `feature/m0-setup`)

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
- [ ] PR into `dev` opened and checks reported.
- [ ] Vercel link and `vercel whoami`: deferred to M8.

## Blockers

- None for M0.
- Dashboard checks for Supabase Auth (see PLAN.md, human steps).

## Next

- M1: write the schema migrations from BRD §6.1, apply with `npx supabase db push`, and generate types.
