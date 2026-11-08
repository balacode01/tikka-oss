# Tikka MVP brief

Read this whole file before doing anything. Then follow §8 in order.

Tikka is a Jira-style task tracker. Build features from our own design and from public Jira behaviour. Do not use Atlassian code, internal APIs, icons, or the Jira name.

## 0. How the human starts

1. Put this file at the root of an empty repo as `MVP_BRIEF.md`.
2. Put the design files in `docs/design/` (see §7.0).
3. Open Claude Code in the repo and say: "Read MVP_BRIEF.md. Run the preflight in §2, write PLAN.md, then start milestone M0."

## 1. Goal and done criteria

The MVP is done when the deployed Vercel URL passes all of these:

- A new user signs up, logs in, creates a workspace, and creates a project.
- They create issues, drag them between statuses on the Board, and the position survives a reload.
- They open an issue, add a comment and a sub-task, change a field, and see the change in History.
- They start a sprint in Backlog, move issues into it, and find issues with Cmd/Ctrl+K.
- Issues assigned to them appear on Your work.
- A second user cannot read or change the first user's workspace, checked in SQL tests and in the UI.

Scope is in §9. Anything not listed there is out of scope.

## 2. Accounts, tools and preflight

### Accounts (human, once)

- **GitHub** account, with the `gh` CLI installed and logged in (`gh auth login`).
- **Supabase** account, with one project. The free plan is enough for the MVP. A free project pauses after a week without use, so keep it active.
- **Vercel** account. Hobby is fine for building.

### Tools on the machine

`git`, Node 22 LTS, `npm`, `gh`, `psql` (PostgreSQL client). The Supabase CLI and Vercel CLI run through `npx`, so no global install is needed. Docker is optional. Develop against the remote dev project and don't depend on Docker.

### Non-interactive credentials (human sets once, never committed)

Put these in the shell environment or in `.env.local`, which is gitignored:

- `SUPABASE_ACCESS_TOKEN`: Supabase dashboard, account access tokens.
- `SUPABASE_DB_PASSWORD`: the project's database password.
- `SUPABASE_DB_URL`: the session or pooler connection string from the project's Connect panel. Used by `psql` for seeding and tests.
- `VERCEL_TOKEN`: Vercel account tokens.

### Preflight (agent runs it and records results in PLAN.md)

```
node -v && npm -v && git --version && gh --version && psql --version
gh auth status
npx supabase --version
npx supabase projects list
npx vercel whoami
```

If a check fails, stop, tell the human which check failed and what to do. Do not work around missing credentials.

### Human-only steps (the agent cannot do these)

- Supabase → Authentication → Sign In / Providers → Email: **turn off "Confirm email"** for the build. Otherwise the built-in email limit (2 an hour) blocks sign-up testing. Turn it back on before real users join.
- Supabase → Authentication → URL Configuration: set the Site URL to the Vercel production URL and add `http://localhost:5173` and the Vercel URL to the redirect URLs.
- Keep the secret key and DB password out of the frontend. The app needs only the project URL and the publishable key.

## 3. Stack and layout

- React + TypeScript + Vite, single-page app. Use the latest stable versions at scaffold time and record them in PLAN.md.
- `@supabase/supabase-js` with the publishable key, in the browser.
- React Router.
- `@dnd-kit/core` and `@dnd-kit/sortable` for drag and drop on the Board and Backlog.
- Styling: Tailwind CSS v4 (`tailwindcss` and `@tailwindcss/vite`). The design tokens are defined as CSS variables and mapped into an `@theme` block (§7.2), so utilities like `bg-surface-raised` and `text-text-secondary` use the design values. Tailwind's default spacing scale is 4px per step, which matches the design grid, so don't add custom spacing tokens.
- Primitives: `@base-ui/react` for accessible, unstyled components (Dialog, Popover, Menu, Select, Combobox, Tabs). Style every primitive with Tailwind classes. Don't use a styled UI kit (no MUI, Mantine, Chakra or Ant Design).
- Command palette: `cmdk`, for the Cmd/Ctrl+K quick search.
- Server state: TanStack Query on top of `supabase-js`, with optimistic updates for drag and drop.
- Forms: React Hook Form with Zod, for Create issue, Create project and sign-up. Field messages follow the designs.
- Toasts: `sonner`. Date picker: `react-day-picker`.
- Icons: Lucide (`lucide-react`). 16px inside cards and buttons, 20px in the sidebar and top bar.
- Tests: SQL tests run with `psql`. Vitest only for pure helper functions.
- Hosting: Vercel, linked to the GitHub repo.

```
supabase/
  migrations/           schema changes only, created with `npx supabase migration new`
  seed.sql
  tests/rls.sql
  tests/functions.sql
src/
  app/                  router, providers, app shell
  lib/supabase.ts       the single Supabase client
  features/             auth, onboarding, board, issues, backlog, search, home, projects
  components/           Tailwind-styled wrappers over Base UI: Button, Input, Select, Pill, Avatar, Modal, Menu, Icon
  styles/index.css      Tailwind import, @theme mapping and design token values (§7.2)
  types/database.ts     generated, never hand-edited
docs/design/            design files (§7.0)
PLAN.md  PROGRESS.md  MVP_BRIEF.md  vercel.json
```

## 4. Environment

`.env.local` (gitignored):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

Set the same two variables in Vercel with `npx vercel env add`. Never put the secret key or the DB password in any `VITE_` variable.

`vercel.json` (React Router needs this on Vercel):

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
```

## 5. Permissions and guardrails

Create `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(git *)", "Bash(gh *)", "Bash(npm *)", "Bash(npx *)",
      "Bash(npx supabase *)", "Bash(npx vercel *)", "Bash(psql *)", "Bash(node *)"
    ],
    "deny": [
      "Bash(npx supabase db reset*)",
      "Bash(npx supabase projects delete*)",
      "Bash(gh repo delete*)",
      "Bash(npx vercel remove*)",
      "Bash(git push --force*)",
      "Bash(git push -f*)",
      "Bash(rm -rf*)"
    ]
  }
}
```

Rules, with no exceptions:

- Never run any command that drops, truncates, or resets remote data.
- Never delete a repo, a Supabase project, or a Vercel project.
- Never force-push. Push to `main` only through a merged pull request.
- Never commit secrets: `.env*`, keys, passwords, tokens.
- Change schema only through migrations. Never edit the remote schema in the dashboard.
- Don't change billing or plans, and don't change Supabase Auth settings beyond §2.

## 6. Backend spec

Build this in M1–M3.

### 6.1 Tables

All tables live in `public` and have RLS on (M2). Primary keys are `uuid` unless noted.

| Table | Columns |
|---|---|
| `profiles` | `id` (= auth user), `display_name`, `avatar_url`, `created_at` |
| `workspaces` | `id`, `name`, `slug` (unique), `created_by`, `created_at` |
| `workspace_members` | `workspace_id`, `user_id`, `role` (owner, admin, member, guest), `joined_at`; PK (workspace_id, user_id) |
| `projects` | `id`, `workspace_id`, `key` (2–10 uppercase letters, unique per workspace), `name`, `template` (scrum, kanban), `lead_id`, `access` (open, invite_only), `next_number` (int, default 1), `archived_at`, `created_at`, `updated_at` |
| `project_members` | `project_id`, `user_id`; PK (project_id, user_id) |
| `statuses` | `id`, `project_id`, `name`, `category` (todo, in_progress, done), `position` (numeric) |
| `status_transitions` | `project_id`, `from_status_id`, `to_status_id`. Empty means any move is allowed. |
| `sprints` | `id`, `project_id`, `name`, `goal`, `state` (planned, active, completed), `start_date`, `end_date`, `completed_at` |
| `issues` | `id`, `project_id`, `number` (int), `key` (text, e.g. MOB-142), `type` (epic, story, task, bug, subtask), `title`, `description` (markdown text), `status_id`, `priority` (urgent, high, medium, low), `assignee_id`, `reporter_id`, `sprint_id`, `epic_id`, `parent_id`, `story_points` (numeric), `due_date`, `rank` (numeric), `deleted_at`, `created_at`, `updated_at`; unique (project_id, number) |
| `issue_labels` | `issue_id`, `label`; PK (issue_id, label) |
| `issue_links` | `id`, `source_issue_id`, `target_issue_id`, `link_type` (blocks, relates_to), `created_by` |
| `comments` | `id`, `issue_id`, `author_id`, `body`, `created_at`, `edited_at`, `deleted_at` |
| `watchers` | `issue_id`, `user_id`; PK (issue_id, user_id) |
| `attachments` | `id`, `issue_id`, `uploader_id`, `storage_path`, `file_name`, `mime_type`, `size_bytes`, `created_at`. Table only in the MVP; uploads come later. |
| `issue_history` | `id`, `workspace_id`, `project_id`, `issue_id`, `actor_id`, `field`, `old_value`, `new_value`, `created_at` |
| `recently_viewed` | `user_id`, `issue_id`, `viewed_at`; PK (user_id, issue_id) |

Not in the MVP: `invites`, `notifications`.

### 6.2 Constraints, indexes and triggers

- **Issue numbering.** On insert, lock the project row, take `next_number`, set `number`, increment it, and set `key` to project key + "-" + number. Keys never repeat.
- **Rank.** A new issue goes to the bottom: max rank + 1000. A move sets the rank to the midpoint of its two neighbours. If the gap falls below 0.000001, renumber that status's column in steps of 1000.
- **History.** On update of `issues`, write one `issue_history` row per changed field among: status_id, assignee_id, priority, sprint_id, title, due_date, story_points, epic_id, parent_id, type, deleted_at. Store values as text.
- **updated_at.** Set by trigger on `issues`, `projects` and `comments`.
- **One active sprint per project.** Partial unique index on `sprints (project_id) where state = 'active'`.
- **Epic and parent checks.** `epic_id` must point to an issue of type epic in the same project. `parent_id` is allowed only on subtasks, and a subtask must have one.
- **Status check.** An issue's `status_id` must belong to the issue's project.
- **Indexes.** `issues (project_id, status_id, rank)`, `issues (assignee_id)`, `issues (sprint_id)`, `workspace_members (user_id, workspace_id)`, `project_members (user_id, project_id)`, `projects (workspace_id)`. Enable `pg_trgm`, then add trigram indexes on `issues.title` and `projects.name`, and a prefix index on `issues.key`.

### 6.3 Views

Two views, both created with `with (security_invoker = true)`. Without it, the view bypasses RLS.

- `backlog_view (project_id)`: sprints with issue count and point totals; backlog issues in rank order; epics with done counts.
- `sprint_summary (sprint_id)`: totals by status category.

Everything else is a direct table read under RLS.

### 6.4 Functions

Functions that only read or change rows the caller can already see are `security invoker`, so RLS applies. `create_workspace` and `create_project` are `security definer` with `set search_path = ''`, and check `auth.uid()` themselves.

| Function | Purpose |
|---|---|
| `create_workspace(name, slug)` | Creates the workspace and makes the caller owner. |
| `create_project(workspace, name, key, template, access)` | Validates the key (2–10 capitals, unique in the workspace). Creates statuses To do, In progress, Done. Adds the caller as lead. |
| `create_issue(project, type, title, description, status, priority, assignee, sprint, epic, parent, points, due, labels[])` | Inserts the issue and labels in one transaction. Returns the issue. |
| `move_issue(issue, status_or_null, before_id, after_id)` | Changes status if given, sets rank between neighbours, writes history through the trigger. |
| `bulk_update_issues(ids[], sprint_or_null, assignee_or_null, set_sprint, set_assignee)` | Moves or assigns many issues in one call. |
| `delete_issues(ids[])` | Soft delete: sets `deleted_at`. |
| `start_sprint(sprint, goal, end_date)` | Sets state to active. Fails with a clear message if the project already has an active sprint. |
| `complete_sprint(sprint, move_open_to)` | Sets state to completed. Moves unfinished issues to `move_open_to`, or to the backlog when null. |
| `record_view(issue)` | Upserts `recently_viewed` and keeps the newest 20 per user. |
| `search(workspace, query)` | Returns matching issues and projects as JSON, limited to what the caller can see. |
| `home(workspace)` | Returns assigned issues, projects with sprint progress, recently viewed, due this week, and recent activity as JSON. |

### 6.5 RLS (M2)

Helper functions live in a `private` schema, which the Data API does not expose:

- `private.is_workspace_member(ws uuid) returns boolean`
- `private.workspace_role(ws uuid) returns text`
- `private.can_see_project(p uuid) returns boolean`: the project's workspace is one the caller belongs to, and either the project is `open` and the caller is not a guest, or the caller is in `project_members`.

Each helper is `security definer`, `stable`, with `set search_path = ''`.

Every policy is written `to authenticated`, and calls `auth.uid()` as `(select auth.uid())`.

- `profiles`: readable by anyone who shares a workspace with that profile. Updatable only by the owner of the row.
- `workspaces`, `workspace_members`, `projects`, `project_members`, `statuses`, `sprints`, `issues`, `issue_labels`, `issue_links`, `comments`, `watchers`, `attachments`, `issue_history`, `recently_viewed`: select through `can_see_project` or `is_workspace_member`. Direct inserts and updates are allowed only where the row's project is visible, and `with check` repeats the same test. Guests can comment but cannot change statuses, sprints, or settings.
- Insert into `workspaces` and `projects` only through the two definer functions. No direct insert policy.

### 6.6 Seed (after the first sign-up in M4)

`supabase/seed.sql` takes the owner's user id as the psql variable `:owner_id`:

- One workspace, "Lumen Labs", owned by that user.
- Three projects: MOB (Scrum, "Mobile app"), WEB (Kanban, "Web platform"), DS (Scrum, "Design system").
- Statuses per project: To do, In progress, Done.
- Sprint 14 (active) and Sprint 15 (planned) in MOB.
- About 60 issues across the three projects, with epics, sub-tasks, labels, priorities and points. Assign issues only to the owner or leave them unassigned. Team profiles come with invites, which are out of MVP scope.
- A second workspace, "Other Co", owned by a placeholder user, for the isolation tests. Create it in `tests/rls.sql`, inside a transaction that rolls back.

## 7. Design spec

### 7.0 Sources

The human copies these into `docs/design/` before M4. If you can't reach the links, ask the human to do this first.

- Design system: `tokens.json`, `README.md`. Canvas: https://claude.ai/artifact/5YLFcnVDUNpwwAD8Th85Af
- Board redesign canvas (all screens below): https://claude.ai/artifact/LMCFVsvTsfwGttSr39P4mC. Export each artboard file to `docs/design/artboards/`.
- Screen-prompts doc with the build order and the rest of the screens: https://claude.ai/artifact/WkCgL8wDJk5MraeVLg19Gw

### 7.1 Screens

| Screen | Route | Artboard file(s) |
|---|---|---|
| Sign up | `/signup` | SignUp.dc.html; SignUp-errors.dc.html; SignUp-verify.dc.html |
| Log in | `/login` | LogIn.dc.html |
| Forgot password | `/forgot` | ForgotPassword.dc.html |
| Reset password | `/reset` | ResetPassword.dc.html |
| Create workspace | `/onboarding` | CreateWorkspace.dc.html. Step 2 (invite) keeps its layout. Email fields and "Send invites" are shown but sending isn't built, and "Skip for now" moves on. |
| Your work | `/home` | Home.dc.html; Home-new.dc.html (checklist shown when the workspace is new) |
| Board | `/w/:workspace/p/:key/board` | Indigo-sidebar.dc.html, but use the neutral sidebar from the README. Ask the human before using the indigo one. |
| Issue detail | `/w/:workspace/p/:key/issues/:issueKey` | IssueDetail.dc.html |
| Issue side panel | opens from a Board card | IssuePanel.dc.html |
| Backlog | `/w/:workspace/p/:key/backlog` | Backlog.dc.html; Backlog-empty.dc.html |
| Create issue | modal, key C | CreateIssue.dc.html; CreateIssue-error.dc.html |
| Quick search | modal, Cmd/Ctrl+K | QuickSearch.dc.html; QuickSearch-recent.dc.html |
| Create project | `/w/:workspace/projects/new` | CreateProject.dc.html |

Accept invite has no design yet and is out of scope.

### 7.2 Tokens (copy into `src/styles/index.css`)

The `@theme` block exposes the tokens to Tailwind as utilities. The `:root` values underneath are the source of truth, and they switch with `data-theme`, so no `dark:` variants are needed.

```css
@import "tailwindcss";

@theme {
  --color-surface-page: var(--surface-page);
  --color-surface-raised: var(--surface-raised);
  --color-surface-hover: var(--surface-hover);
  --color-surface-selected: var(--surface-selected);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-primary: var(--primary);
  --color-primary-hover: var(--primary-hover);
  --color-on-primary: var(--on-primary);
  --color-primary-subtle-text: var(--primary-subtle-text);
  --color-status-todo: var(--status-todo);
  --color-status-progress: var(--status-progress);
  --color-status-done: var(--status-done);
  --color-danger: var(--danger);
  --color-on-danger: var(--on-danger);
  --color-danger-bg: var(--danger-bg);
  --color-danger-text: var(--danger-text);
  --color-type-epic: var(--type-epic);
  --color-type-story: var(--type-story);
  --color-type-task: var(--type-task);
  --color-type-bug: var(--type-bug);
  --color-type-subtask: var(--type-subtask);
  --shadow-popover: var(--shadow-popover-value);
  --shadow-modal: var(--shadow-modal-value);
  --font-sans: Montserrat, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
}

:root {
  --surface-page:#fafafa; --surface-raised:#ffffff; --surface-hover:#f4f4f5; --surface-selected:#eef2ff;
  --border:#e4e4e7; --border-strong:#8e8e96; --text-primary:#18181b; --text-secondary:#6b6b73;
  --primary:#4f46e5; --primary-hover:#4338ca; --on-primary:#ffffff; --primary-subtle-text:#3730a3;
  --status-todo:#71717a; --status-todo-bg:#f4f4f5; --status-todo-text:#3f3f46;
  --status-progress:#c2620a; --status-progress-bg:#fef3c7; --status-progress-text:#92400e;
  --status-done:#15963f; --status-done-bg:#dcfce7; --status-done-text:#166534;
  --danger:#dc2626; --on-danger:#ffffff; --danger-bg:#fee2e2; --danger-text:#991b1b;
  --type-epic:#7c3aed; --type-story:#15963f; --type-task:#2563eb; --type-bug:#dc2626; --type-subtask:#71717a;
  --shadow-popover-value:0 4px 12px rgba(24,24,27,.08), 0 1px 3px rgba(24,24,27,.06);
  --shadow-modal-value:0 16px 40px rgba(24,24,27,.16), 0 2px 8px rgba(24,24,27,.08);
  color-scheme: light;
}
:root[data-theme="dark"] {
  --surface-page:#09090b; --surface-raised:#18181b; --surface-hover:#27272a; --surface-selected:#1e1b4b;
  --border:#27272a; --border-strong:#71717a; --text-primary:#fafafa; --text-secondary:#a1a1aa;
  --primary:#818cf8; --primary-hover:#a5b4fc; --on-primary:#1e1b4b; --primary-subtle-text:#c7d2fe;
  --status-todo:#a1a1aa; --status-todo-bg:#27272a; --status-todo-text:#d4d4d8;
  --status-progress:#f59e0b; --status-progress-bg:#422006; --status-progress-text:#fcd34d;
  --status-done:#4ade80; --status-done-bg:#052e16; --status-done-text:#86efac;
  --danger:#f87171; --on-danger:#450a0a; --danger-bg:#450a0a; --danger-text:#fca5a5;
  --type-epic:#a78bfa; --type-story:#4ade80; --type-task:#60a5fa; --type-bug:#f87171; --type-subtask:#a1a1aa;
  --shadow-popover-value:0 4px 12px rgba(0,0,0,.5), 0 1px 3px rgba(0,0,0,.4);
  --shadow-modal-value:0 16px 40px rgba(0,0,0,.6), 0 2px 8px rgba(0,0,0,.5);
  color-scheme: dark;
}
:root {
  --font-sans: Montserrat, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-6:24px; --space-8:32px; --space-12:48px;
  --radius-sm:6px; --radius-md:8px; --radius-lg:12px; --radius-full:9999px;
  --control-height:32px; --topbar-height:48px; --sidebar-width:240px; --sidebar-width-collapsed:56px;
  --column-width:280px; --panel-width:560px;
}
body { margin: 0; background: var(--surface-page); color: var(--text-primary); font: 400 14px/20px var(--font-sans); }
:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
```

Google Fonts, in `index.html`:
`https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Montserrat:wght@400;500;600&display=swap`

Theme: set `data-theme="light"` or `"dark"` on `<html>`. The default follows the OS through `matchMedia`. The avatar menu offers Light, Dark and System, stored in `localStorage` with try/catch.

### 7.3 Type styles

| Class | Size / line | Weight | Font | Use |
|---|---|---|---|---|
| caption | 12 / 16 | 400 | sans | timestamps, helper text, column counts |
| meta | 13 / 18 | 400 | sans | card metadata, table cells, sidebar items |
| body | 14 / 20 | 400 | sans | default; card titles, form values, menus, rows |
| label | 14 / 20 | 500 | sans | buttons, field labels, tabs, active sidebar item |
| description | 16 / 24 | 400 | sans | issue descriptions and comments |
| page-title | 20 / 28 | 600 | sans | page and modal titles (letter-spacing -0.01em) |
| issue-title | 24 / 32 | 600 | sans | issue title on the detail page and panel (letter-spacing -0.015em) |
| key | 12 / 16 | 500 | mono | issue keys such as MOB-142, in text-secondary |
| code | 13 / 20 | 400 | mono | inline code and branch names |

Three weights only: 400 for text, 500 for controls, 600 for the two titles. Use `font-variant-numeric: tabular-nums` for counts, points and dates.

### 7.4 Rules that matter

- Sentence case everywhere. "Create issue", not "Create Issue".
- Buttons start with a verb and are one to three words.
- Errors say what happened and what to do.
- No emoji. Lucide icons only.
- Borders, not shadows, separate surfaces. Shadows only on menus, popovers and modals, and while dragging a card.
- One filled primary button per view. Other buttons are outlined: `surface-raised` with a `border-strong` edge.
- Status is a pill with its name, plus a dot. Never colour alone.
- Priority is a signal icon in text-secondary. Only Urgent gets colour (`danger`).
- Issue types show as a 16px icon in their type colour. Never fill a card with a type colour.
- Card titles clamp to two lines with an ellipsis, and show the full title on hover.
- Avoid disabled buttons. Explain what's missing when a button is pressed.
- Layout: board columns are 280px and scroll sideways. The side panel is 560px and slides in from the right. Page padding is 24px. Card padding is 12px, and the gap between cards is 8px.
- Shortcuts: Cmd/Ctrl+K for search, C to create an issue. Show them in menus as caption text.

## 8. Work plan

Timebox: Day 1 covers M0–M5. Day 2 covers M6–M8. If a milestone runs over, cut scope from §9 instead of extending the day.

### M0. Setup (about 30 minutes)

- `npm create vite@latest` (React, TypeScript). Install the packages from §3.
- `gh repo create tikka --private --source . --push` (or the existing repo if one exists).
- `npx supabase init`, then `npx supabase link --project-ref <ref>` using `SUPABASE_DB_PASSWORD`.
- `npx vercel link --yes`.
- Write `.env.local` and `vercel.json`. Write `.claude/settings.json` (§5).
- Write `PLAN.md` (the day plan, versions, and the preflight results) and `PROGRESS.md`.

*Done when:* `npm run build` passes on the blank app, `npx supabase projects list` shows the project, `npx vercel whoami` works, and PLAN.md is committed.

### M1. Schema (Day 1, morning)

- Migrations for every table in §6.1, with constraints, indexes, triggers from §6.2, and the views in §6.3.
- Enable `pg_trgm`.
- `npx supabase db push`.
- `npx supabase gen types typescript --linked > src/types/database.ts`.

*Done when:* `db push` runs clean, the generated types compile, and a manual insert of an issue gets a key like MOB-1.

### M2. Security (Day 1, late morning)

- Create the private helper functions and enable RLS on every table in §6.1.
- Write the policies in §6.5. Index the policy columns.
- Write `supabase/tests/rls.sql`. Inside a transaction, create two users and two workspaces. Check that user A sees zero rows from B's workspace on every table, cannot insert into it, and that a guest can see only invited projects. Check that the anonymous role sees nothing. Roll back at the end.

*Done when:* `psql "$SUPABASE_DB_URL" -f supabase/tests/rls.sql` passes.

### M3. Functions (Day 1, afternoon)

- The functions in §6.4, and the views in §6.3.
- Write `supabase/tests/functions.sql`. Check that `move_issue` sets the rank and writes history, that a second active sprint is refused with a clear message, that `create_project` rejects a bad key, and that `search` returns only visible rows.

*Done when:* the functions test passes.

### M4. App shell and auth (Day 1, afternoon to evening)

- Supabase client, session provider, React Router routes from §7.1, app shell (sidebar, top bar with search and Create issue button, avatar menu with the theme choice).
- Sign up, log in, forgot password, reset password. Use the designs from §7.1.
- Create workspace wizard: steps 1 and 3 are real; step 2 is skip-only (§7.1).
- After the first sign-up, run the seed (§6.6) with that user's id.

*Done when:* a new user signs up, creates a workspace and a project, and lands on an empty Board, and the seeded Lumen Labs workspace is visible to its owner.

### M5. Board and Create issue (Day 1, evening)

- Columns from the project's statuses. Cards with key (mono), type icon, two-line title, priority icon, assignee avatar, points, sub-task count and comment count.
- Drag between columns and reorder within a column with dnd-kit, calling `move_issue`. Update the UI optimistically and roll back on error.
- Create issue modal (key C) with validation, and "Create another".

*Done when:* a dragged card stays where it was dropped after a reload, and a new issue appears with the next key.

### M6. Issue detail and search (Day 2, morning)

- Issue detail page and the side panel from a Board card. Editable title, status, assignee, priority, sprint, points and due date. Comments with add. Sub-tasks list and create. History list. Call `record_view` on open.
- Quick search modal (Cmd/Ctrl+K) using `search`, with arrow keys and Enter, and recently viewed when the query is empty.

*Done when:* a comment and a field change both appear in History, and Cmd/Ctrl+K finds an issue by key and by title.

### M7. Backlog, Your work and Create project (Day 2, midday to afternoon)

- Backlog: sprint sections with totals from `backlog_view`, backlog issues in rank order, drag to reorder, select rows for bulk move, assign and delete. Start sprint and Complete sprint.
- Your work: `home` output, with the new-workspace checklist when there is no activity.
- Create project screen with key validation. The duplicate-key message must say that the key is taken and what to try.

*Done when:* starting a sprint works and a second start is refused with a clear message, and Your work shows the issues assigned to the signed-in user.

### M8. Deploy and verify (Day 2, late)

- `npx vercel --prod`. Set the two `VITE_` variables in Vercel.
- Check the redirect URLs in Supabase (§2).
- Test with two real accounts on the production URL. Confirm that the second account gets "not found" on the first account's workspace URL and cannot read its issues.
- Fix the top bugs. Update PROGRESS.md with the result of each §1 criterion.

*Done when:* every criterion in §1 passes on the production URL.

## 9. Out of scope for the MVP

- List view.
- Notifications.
- Workflow editor. Default statuses only. The `status_transitions` table exists and is empty.
- Project settings, workspace settings, profile page.
- Projects list page (Your work covers projects).
- Accept invite and sending invites. Create workspace step 2 is skip-only.
- Attachment uploads. The table exists.
- Realtime updates.
- The MCP connector. It comes after the MVP.
- Moving an issue to another project.
- Start and Complete sprint polish beyond the basics in M7.

## 10. Git and pull requests

- One branch per milestone: `m1-schema`, `m2-security`, and so on.
- Small commits, with conventional messages (`feat:`, `fix:`, `chore:`, `db:`).
- Before opening a PR, run `npm run build`, `npm run typecheck`, and `psql "$SUPABASE_DB_URL" -f supabase/tests/rls.sql` and `functions.sql`.
- Open the PR with `gh pr create`. When every check passes, merge with `gh pr merge --squash --delete-branch`.
- After each milestone, update PROGRESS.md with what's done, what's blocked, and what's next.

## 11. Working style

- One milestone per Claude Code session, with `/clear` between milestones.
- Read only the artboard files for the screens you're building. Don't open the whole design folder.
- Batch small fixes into one prompt. Avoid re-reading files you already have in context.
- Ask the human only when: a credential is missing, a decision in §12 is open, or an action is destructive.
- If something is blocked, record it in PROGRESS.md, move to the next task that doesn't depend on it, and list the blockers in the final report.

## 12. Decisions already made (don't ask again)

- React + Vite + TypeScript. Vercel Hobby for the build.
- Tailwind CSS v4, with the design tokens mapped into `@theme`. Base UI for accessible primitives. No styled UI kit.
- Functional and token-accurate first. Pixel polish comes later.
- Issue descriptions are markdown text.
- Issue deletion is soft (`deleted_at`).
- Neutral sidebar, per the README.
- Sign-in is email and password only.
- One Supabase project for the MVP, with all changes through migrations.

## 13. Final report

When M8 is done, write a final section in PROGRESS.md with the §1 checklist (pass or fail for each item), the production URL, the list of out-of-scope items you noticed, and the next three tasks. Then send the human a short summary.
