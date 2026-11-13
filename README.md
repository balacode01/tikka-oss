# Tikka

An open-source alternative to Jira for small teams. Plan and track your work on a board, a backlog and sprints, and run it on your own free Supabase and Vercel accounts.

## Features

- **Board, Backlog and List:** the same issues in three views. Drag a card to change its status.
- **Sprints:** plan sprints from the backlog, start them with a goal and an end date, and complete them.
- **Issues:** types (epic, story, task, bug, sub-task), priorities, assignees, story points, due dates, labels, links, watchers and comments.
- **Your work:** issues assigned to you, what is due this week, and recent activity.
- **Search:** find issues by key or title across a workspace.
- **Roles:** owner, admin, member and guest, with guests limited to reading and commenting.
- **Claude Code:** an MCP endpoint lets Claude Code work with your projects and issues, using your own permissions.

## Not available yet

- Notifications
- Custom statuses and workflows (every project uses the default statuses)
- Project and workspace settings
- Moving an issue to another project
- Live updates (changes from other people appear after a reload)

## Self-host it

You don't need a server. Tikka runs on free tiers of [Supabase](https://supabase.com) (database, sign-in and file storage) and [Vercel](https://vercel.com) (the website).

The full step-by-step guide is in **[docs/self-hosting.md](docs/self-hosting.md)**. In short:

1. Create a Supabase project and run `npx supabase db push`.
2. Deploy this repository to Vercel, with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` set.
3. Sign up on your site. The first account creates your workspace.

## Run it locally

```sh
npm install
cp .env.example .env   # then fill in the two values
npm run dev
```

Other scripts: `npm run typecheck`, `npm run lint`, `npm run build`.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Security problems should be reported privately, as described in [SECURITY.md](SECURITY.md).

## Support and warranty

Tikka is provided as-is, with no support, no guaranteed response time and no roadmap. It is maintained by volunteers when they have time.

## License

[MIT](LICENSE)
