# Web Admin App

Next.js frontend for the Ga Gutter Guys ERP Admin Portal.

## Required env vars

Copy and fill local env file:

```bash
cp .env.local.example .env.local
```

Required values:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Optional values:

- `NEXT_PUBLIC_FUNCTIONS_REGION` (default `us-east1`)
- `NEXT_PUBLIC_FUNCTIONS_BASE_URL` (auto-derived if omitted)
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (needed for map pages/components)

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production build

```bash
npm run build
npm run start
```

## Deploy notes

- App Hosting config lives in `apphosting.yaml`.
- Ensure all required `NEXT_PUBLIC_*` values are configured for both `BUILD` and `RUNTIME`.
