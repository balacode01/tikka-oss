# Contributing

Thanks for wanting to improve Tikka. Pull requests and issues are welcome.

Tikka is a side project with no paid maintainer and no support team. Issues and pull requests are read when someone has time, and there is no promised response time. Keep that in mind before you wait on a reply.

## Before you open a pull request

1. Check the existing issues and pull requests so you don't duplicate work.
2. For a larger change, open an issue first to talk through the approach.
3. Keep the change focused. One fix or feature per pull request.
4. Run the checks:

   ```sh
   npm install
   npm run typecheck
   npm run lint
   npm run build
   ```

5. If you change the database, add a new migration in `supabase/migrations/`. Don't edit an existing migration that someone may already have applied.
6. If you change a screen, describe what you looked at in the pull request, and include a screenshot if it helps.

## Code style

Follow the code around your change. The repository uses TypeScript, React, Tailwind and Supabase. Design rules are in `docs/design/README.md`.

## License

By contributing, you agree that your contribution is released under the MIT License in `LICENSE`.
