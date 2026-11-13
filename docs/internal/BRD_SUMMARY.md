# Tikka MVP: BRD summary

Summary of `project_brd_mvp1.md`. The BRD stays the source of truth; this file is a quick reference.

## What Tikka is

A Jira-style task tracker. Built from our own design and public Jira behaviour. Do not use Atlassian code, internal APIs, icons, or the Jira name.

## Done criteria (MVP is done when the Vercel URL passes all of these)

1. New user signs up, logs in, creates a workspace and a project.
2. Create issues, drag them between statuses on the Board, position survives reload.
3. Open an issue, add a comment and a sub-task, change a field, see it in History.
4. Start a sprint in Backlog, move issues into it, find issues with Cmd/Ctrl+K.
5. Issues assigned to the user appear on "Your work".
6. A second user cannot read or change the first user's workspace (SQL tests and UI).

## Stack

- React + TypeScript + Vite (SPA), React Router, TanStack Query over `supabase-js`.
- Supabase (Postgres, Auth, RLS) with the publishable key in the browser only.
- Tailwind CSS v4 with design tokens mapped into `@theme`. No spacing tokens (4px default scale).
- Base UI primitives, styled with Tailwind. No styled UI kit.
- `@dnd-kit` (drag and drop), `cmdk` (Cmd/Ctrl+K), `sonner` (toasts), `react-day-picker`, React Hook Form + Zod, Lucide icons.
- Hosting on Vercel, linked to GitHub. SQL tests run with `psql`; Vitest only for pure helpers.

## Scope

- **In:** auth (sign up, log in, forgot/reset password), onboarding wizard, Your work (home), Board, issue detail and side panel, Backlog with sprints, Create issue, Quick search, Create project.
- **Out:** list view, notifications, workflow editor (default statuses only), project/workspace/profile settings, projects list page, accept and send invites, attachment uploads (table only), realtime, MCP connector, moving issues between projects.

## Backend

- **Tables (in `public`, RLS on):** profiles, workspaces, workspace_members, projects, project_members, statuses, status_transitions, sprints, issues, issue_labels, issue_links, comments, watchers, attachments, issue_history, recently_viewed.
- **Rules:**
  - Issue keys (e.g. MOB-142) come from a per-project counter, locked on insert.
  - Rank uses midpoint ordering, with renumbering when gaps get too small.
  - A trigger writes one history row per changed tracked field.
  - Only one active sprint per project.
  - Epic and parent checks; status must belong to the issue's project.
- **Views:** `backlog_view`, `sprint_summary` (both `security_invoker`).
- **Functions:** create_workspace, create_project, create_issue, move_issue, bulk_update_issues, delete_issues (soft), start_sprint, complete_sprint, record_view, search, home.
- **RLS:** helpers in a `private` schema, all policies `to authenticated`. Guests can comment but not change statuses, sprints, or settings.
- **Seed:** "Lumen Labs" workspace with projects MOB, WEB, DS and about 60 issues, plus an "Other Co" workspace for isolation tests.

## Design

- Source files live in `docs/design/` (Claude canvases listed in the BRD). Screens map to routes in §7.1.
- Token values (light and dark) are in §7.2. Theme follows the OS by default, with a manual override.
- Type scale: 3 weights (400, 500, 600). Montserrat for text, JetBrains Mono for keys and code.
- Rules: sentence case, no emoji, borders over shadows, one filled primary button per view, status shown as a pill with a dot, only Urgent priority gets colour.

## Work plan

- **Day 1:** M0 setup, M1 schema, M2 security (RLS tests), M3 functions, M4 app shell and auth, M5 Board and Create issue.
- **Day 2:** M6 issue detail and search, M7 backlog, Your work, Create project, M8 deploy and verify.
- If a milestone runs over, cut scope rather than extend the day.

## Rules and guardrails

- Never drop, truncate, or reset remote data. Never delete a repo, Supabase project, or Vercel project. Never force-push.
- Push to `main` only through a merged PR (`gh pr merge --squash --delete-branch`).
- Never commit secrets. Schema changes only through migrations.
- Don't change billing or Supabase Auth settings beyond the BRD's preflight steps.

## Git and process

- One branch per milestone (`m1-schema`, `m2-security`, ...). Conventional commits.
- Before a PR: `npm run build`, `npm run typecheck`, and both SQL test files.
- One milestone per Claude Code session, with `/clear` between milestones.
- Track progress in `PROGRESS.md`; the final report is written there after M8.

## Decisions already made

- React + Vite + TypeScript. Vercel Hobby.
- Tailwind v4 + Base UI. No styled UI kit.
- Functional and token-accurate first; pixel polish later.
- Descriptions are markdown text. Deletion is soft.
- Neutral sidebar. Email and password sign-in only.
- One Supabase project, all changes through migrations.

## Open human steps before launch

- Supabase: turn off "Confirm email" for the build (turn it back on before real users join). Set Site URL and redirect URLs.
- Put the two `VITE_` variables in `.env.local` and Vercel. Never put secret keys or the DB password in `VITE_` variables.
- Copy design files into `docs/design/` before M4.
