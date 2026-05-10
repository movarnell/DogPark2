# Firebase deployment

This repo deploys the DogPark2 web app to Firebase Hosting and the Express API to Firebase Functions. Hosting routes `/api/**` and `/health` to the `api` function and serves the Vite build from `dist`.

## One-time Firebase setup

1. Create or select a Firebase project. This repo is currently mapped to `dog-park-social-b7ccb`.
2. Enable Firebase Hosting.
3. Enable the APIs required for Firebase Functions deploys:
   - Cloud Functions API
   - Cloud Build API
   - Artifact Registry API
   - Cloud Run Admin API
   - Eventarc API
4. Confirm the MySQL database is reachable from Google Cloud. If the database only runs on a local machine, move it to a public managed database or Cloud SQL before production deploys.
5. Apply `functions/schema.sql` and the SQL files under `functions/migrations` to the production database.
6. In Google OAuth, add these production redirect URIs:
   - `https://YOUR_FIREBASE_PROJECT.web.app/api/owners/google/callback`
   - any custom domain equivalent.
7. In Apple Sign In, add:
   - `https://YOUR_FIREBASE_PROJECT.web.app/api/owners/apple/callback`
   - any custom domain equivalent.

## GitHub Actions settings

Add these repository secrets:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT`
- `DB_HOSTNAME`
- `DB_USER_NAME`
- `DB_PASSWORD`
- `DB_DATABASE`
- `SESSION_SECRET`
- `GOOGLE_PLACES_API_KEY`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_IOS_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `APPLE_OAUTH_CLIENT_ID`
- `APPLE_OAUTH_TEAM_ID`
- `APPLE_OAUTH_KEY_ID`
- `APPLE_OAUTH_PRIVATE_KEY`

Add these repository variables:

- `PUBLIC_BASE_URL`, for example `https://YOUR_FIREBASE_PROJECT.web.app`
- `FRONTEND_BASE_URL`, usually the same value as `PUBLIC_BASE_URL`
- `CORS_ORIGINS`, comma-separated allowed origins
- `GOOGLE_OAUTH_REDIRECT_URI`
- `APPLE_OAUTH_REDIRECT_URI`
- `VITE_ENABLE_APPLE_SIGN_IN`, either `true` or `false`

The service account JSON in `FIREBASE_SERVICE_ACCOUNT` must be allowed to deploy Firebase Hosting and Cloud Functions.

## Deploy behavior

- Pull requests run frontend lint/build and function tests.
- Production deploys are currently manual-only through the `Deploy to Firebase` workflow.
- Pushes to `main` do not deploy while the project remains in local-development mode.
- If multiple manual deploys are started quickly, the workflow cancels the older in-progress production deploy and keeps only the latest one.
- Pull requests do not create Firebase preview deploys, which keeps deploy/build usage lower.
- The deployed frontend builds with a relative API base URL, so browser requests go to the same Firebase Hosting origin.

## Free-tier guardrails

- Firebase Hosting on Spark has no deploy-count fee, but it does have storage and transfer limits.
- Firebase Functions are not available on Spark; they require Blaze billing even though Blaze includes no-cost monthly allocations.
- Functions deploys consume Cloud Build minutes and store images in Artifact Registry, so avoid preview deploys unless there is a clear need.
- Keep this workflow manual-only unless the project intentionally moves beyond local-development mode.
