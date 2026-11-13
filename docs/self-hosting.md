# Self-hosting Tikka

This guide runs your own copy of Tikka on free tiers of Supabase and Vercel. You need about 30 minutes, a GitHub account, and a Supabase account. You don't need a server.

Tikka has no managed service and no support. You own the data, the keys and the uptime.

## What you need

- A [Supabase](https://supabase.com) account and a new project
- A [Vercel](https://vercel.com) account, connected to your GitHub account
- Node.js 22 or later, and the Supabase CLI (`npx supabase` works without a global install)

## 1. Create the database

1. In Supabase, create a new project. Note the **project reference** (the part of the URL between `https://` and `.supabase.co`).
2. Copy the database password you set when you created the project.
3. From your clone of this repository, link the CLI to your project and push the migrations:

   ```sh
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   The migrations create the tables, row-level security policies, functions, and the private storage bucket for attachments.

## 2. Configure sign-in

In the Supabase dashboard:

- **Authentication > URL Configuration**: set the **Site URL** to your Vercel address, for example `https://your-tikka.vercel.app`. Add the same address to the **Redirect URLs** list.
- **Authentication > Providers > Email**: decide whether new people must confirm their email. Turn confirmation on if the site is open to the public.

## 3. Get your two keys

In **Project Settings > API**, copy:

- the **Project URL**, which goes in `VITE_SUPABASE_URL`
- the **publishable key**, which goes in `VITE_SUPABASE_PUBLISHABLE_KEY`

Use only the publishable key. Never put the `service_role` or secret key in Vercel or in the repository.

## 4. Deploy to Vercel

1. In Vercel, choose **Add New > Project** and import your fork of this repository.
2. Leave the framework preset on **Vite**.
3. Before the first deploy, add the two environment variables from step 3.
4. Deploy.

Vite reads these variables when it builds the site. If you change them later, redeploy so the new values are included.

## 5. Use it

1. Open your Vercel address and sign up. The first account is the owner of the workspace you create.
2. Create a project, then some issues, to check that the board, backlog and sprints work.
3. Invite your team with **Invite people** in the sidebar.

Optional: to load the Lumen Labs demo data, run `supabase/seed.sql` after your first sign-up. The file's header explains how to pass your user id, and it can only run once per database.

## 6. Optional: connect Claude Code

Tikka includes an MCP endpoint at `/api/mcp`. It lets Claude Code work with your projects and issues, using the same permissions you have on the website. Each person connects their own account:

```sh
claude mcp add --transport http tikka https://your-tikka.vercel.app/api/mcp
```

Then, in Claude Code, run `/mcp`, choose **tikka**, and authenticate. This sign-in uses Supabase's OAuth server, so it must be turned on for your project before it works. The rest of Tikka works without it.

## Troubleshooting

- **Blank page, or an error that mentions `supabaseUrl`:** the two environment variables were missing at build time. Set them in Vercel and redeploy.
- **Sign-in link goes to the wrong address:** the Site URL in Supabase doesn't match your Vercel address.
- **Sign-up doesn't finish:** check whether email confirmation is on, and whether your Supabase project is paused (free projects pause after a period of inactivity).
- **Migrations fail on `db push`:** run `npx supabase db push` again after fixing the connection, or open an issue with the error text.

## Running it locally

```sh
npm install
cp .env.example .env   # then fill in the two values
npm run dev
```
