# Dog Park Meetup Frontend

React, TypeScript, Vite, and Tailwind frontend for the Dog Park Meetup community app.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `VITE_API_BASE_URL` to the backend origin.
3. Run `npm install`.
4. Run `npm run dev`.

## Checks

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run standalone:check`

The app expects the backend to expose Google Places-backed `/api/parks/search`, auth, dogs, visits, reviews, reports, and moderation APIs.

## Standalone production

The standalone Express/MySQL API now lives in `backend/` so the web app and production API release together from this repo. Use `docs/standalone-production.md` for Hostinger-style deployment, production environment values, MySQL migration steps, smoke tests, rollback, and media-storage notes.

## Brand assets

- `/public/brand/dog-park-meetup-mark.svg`
- `/public/brand/dog-park-meetup-logo.svg`
- `/public/brand/dog-park-meetup-app-icon.svg`
- `/public/brand/dog-park-meetup-social-card.svg`
- `/marketing/dog-park-meetup-launch-kit.md`
