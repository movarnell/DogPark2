# Standalone Production Runbook

This runbook is for the standalone Express/MySQL API hosted separately from the web app, such as on Hostinger. Firebase Hosting and Functions can remain as a secondary path, but this is the primary launch path.

## Deployment Shape

- Web app: build from the repo root and deploy `dist/` to the web host.
- API app: deploy `backend/` to the Node host and run `npm ci --omit=dev && npm start`.
- Database: MySQL database reachable from the API host.
- Public URLs: both the web app and API must use HTTPS in production.

## Required Production Environment

Set these values on the API host:

```bash
NODE_ENV=production
PORT=4050
PUBLIC_BASE_URL=https://api.example.com
FRONTEND_BASE_URL=https://app.example.com
CORS_ORIGINS=https://app.example.com

HOSTNAME=<mysql-host>
USER_NAME=<mysql-user>
PASSWORD=<mysql-password>
DATABASE=<mysql-database>

GOOGLE_PLACES_API_KEY=<google-places-key>
GOOGLE_OAUTH_CLIENT_ID=<google-web-client-id>
GOOGLE_IOS_CLIENT_ID=<google-ios-client-id>
GOOGLE_OAUTH_CLIENT_SECRET=<google-web-client-secret>
GOOGLE_OAUTH_REDIRECT_URI=https://api.example.com/api/owners/google/callback

SESSION_SECRET=<at-least-32-random-characters>
COOKIE_SECURE=true
AUTH_DB_FALLBACK=false
```

Apple sign-in can stay disabled until credentials are ready. When enabled, add the Apple Services ID, Team ID, Key ID, private key, and HTTPS callback URL ending in `/api/owners/apple/callback`.

Set this value when building the web app:

```bash
VITE_API_BASE_URL=https://api.example.com
VITE_ENABLE_APPLE_SIGN_IN=false
```

## Database Setup And Migrations

For a new database:

```bash
mysql -h "$HOSTNAME" -u "$USER_NAME" -p"$PASSWORD" "$DATABASE" < backend/schema.sql
npm --prefix backend run migrate:baseline
npm --prefix backend run migrate:status
```

For an existing database:

```bash
npm --prefix backend run migrate:status
npm --prefix backend run migrate:up
npm --prefix backend run migrate:status
```

If an existing database already had these SQL files applied manually before `schema_migrations` existed, run `npm --prefix backend run migrate:baseline` only after confirming the schema already matches `backend/schema.sql`.

Before applying migrations in production:

- Take a MySQL backup.
- Confirm the backup can be restored.
- Run `migrate:status` and save the output with the release notes.
- Apply migrations during a low-traffic window.

The current image upload path stores media in MySQL `MEDIUMBLOB` rows capped at 3 MB. That is acceptable for launch only if database backup size and storage growth are monitored. Move media to object storage before increasing upload limits or adding high-volume photo features.

## Release Checks

Run these before every standalone release:

```bash
npm run standalone:check
```

Run dependency audits only after explicit approval because npm audit sends package metadata to npm:

```bash
npm audit --audit-level=high
npm --prefix backend audit --audit-level=high
```

## Production Smoke Test

After deploy:

- `GET https://api.example.com/health` returns `ok: true`.
- The health response reports `checks.database.ok: true`.
- Login sets an HttpOnly secure session cookie.
- Park search returns data from the production web origin without CORS errors.
- Google OAuth redirects to the production API callback.
- Dog image upload returns a stable `/api/media/:id` URL.
- A created visit is still present after the API process restarts.
- Non-admin users receive `403` from `/api/admin/reports`.
- `/api/dev/*` returns `404` in production.

## Rollback

- Keep the previous web build artifact until the new release passes smoke tests.
- Keep the previous API bundle or commit SHA available on the Node host.
- Restore the pre-release MySQL backup if a migration causes data or schema damage.
- If only the API code fails, roll back API code first and preserve the database unless the migration is confirmed as the fault.
