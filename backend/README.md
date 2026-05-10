# Dog Park Social Backend

Express and MySQL API for Dog Park Social.

## Local setup

1. Copy `.env.example` to `.env`.
2. Create the MySQL database named in `DATABASE`.
3. Apply `schema.sql`.
4. Add `GOOGLE_PLACES_API_KEY` for national dog park search.
5. To enable Google sign-in, create a Google OAuth web client and set:
   - Authorized JavaScript origin: `http://localhost:5173`
   - Authorized redirect URI: `http://localhost:4050/api/owners/google/callback`
   - Native iOS sign-in: set `GOOGLE_IOS_CLIENT_ID` to the iOS OAuth client ID generated for bundle ID `com.michaelvarnell.DogParkiPhone`
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
6. To enable Apple sign-in, create a Sign in with Apple Services ID and private key, then set:
   - Return URL: your verified HTTPS backend callback URL, ending in `/api/owners/apple/callback`
   - For local testing, use an HTTPS tunnel that forwards to port `4050`
   - `APPLE_OAUTH_CLIENT_ID` to the Services ID
   - `APPLE_OAUTH_TEAM_ID`
   - `APPLE_OAUTH_KEY_ID`
   - `APPLE_OAUTH_PRIVATE_KEY`; one-line values may use escaped `\n` line breaks
7. Run `npm install`.
8. Run `npm start`.

For an existing database, apply:

- `migrations/2026-05-05-google-sign-in.sql`
- `migrations/2026-05-05-apple-sign-in.sql`

## Checks

- `npm run test:unit`
- `npm run test:integration`
- `npm test`

## Migrations

- `npm run migrate:status` lists SQL files in `migrations/` as `pending` or `applied`.
- `npm run migrate:up` applies pending migrations in filename order and records them in `schema_migrations`.
- `npm run migrate:baseline` marks the current migration files as applied after a fresh `schema.sql` import or after manually verifying an existing database already has those schema changes.

Take a MySQL backup before applying migrations in production. New databases should start from `schema.sql`, then run `npm run migrate:baseline` and `npm run migrate:status`.

## Production readiness

In production, startup rejects weak session secrets, development auth fallback, non-HTTPS public URLs, and non-HTTPS CORS origins. `/health` verifies the API process and database reachability without exposing secrets.

## API groups

- `/api/parks/search`
- `/api/parks/:parkId`
- `/api/parks/:parkId/suggest-edit`
- `/api/dogs`
- `/api/visits`
- `/api/reviews`
- `/api/photos`
- `/api/reports`
- `/api/me`
- `/api/admin/reports`
