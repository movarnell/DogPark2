# Dog Park Social Frontend

React, TypeScript, Vite, and Tailwind frontend for the Dog Park Social directory and community app.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `VITE_API_BASE_URL` to the backend origin.
3. Run `npm install`.
4. Run `npm run dev`.

## Checks

- `npm run lint`
- `npm run build`

The app expects the backend to expose Google Places-backed `/api/parks/search`, auth, dogs, visits, reviews, reports, and moderation APIs.
