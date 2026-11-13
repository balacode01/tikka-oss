# Security

## Reporting a vulnerability

Please don't open a public issue for a security problem. Report it privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Include what you found, the steps to reproduce it, and the version or commit you tested.

Tikka is maintained by volunteers, so there is no guaranteed response or fix time. Reports are read, and confirmed problems are fixed when someone can get to them.

## Self-hosting

If you run your own copy of Tikka, you are responsible for its Supabase project, its hosting, and its keys. Keep the `service_role` key out of the browser and out of the repository. Only the publishable key belongs in the app's environment variables.
