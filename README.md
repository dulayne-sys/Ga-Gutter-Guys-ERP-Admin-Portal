# Ga-Gutter-Guys-ERP-Admin-Portal

Admin portal + Cloud Functions for Ga Gutter Guys.

## Project layout

- `web/` → Next.js admin UI (App Hosting / Firebase Hosting framework support)
- `functions/` → Firebase Cloud Functions (TypeScript)

## Prerequisites

- Node.js 20+
- npm 10+
- Firebase CLI (`firebase-tools`)
- Firebase project access

## Environment setup

### Web (required)

1. Copy template:

   ```bash
   cp web/.env.local.example web/.env.local
   ```

2. Fill values in `web/.env.local`:

   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`

   Optional but recommended:

   - `NEXT_PUBLIC_FUNCTIONS_REGION` (default: `us-east1`)
   - `NEXT_PUBLIC_FUNCTIONS_BASE_URL` (if blank, derived from region/projectId)
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (required for map components)

### Functions (required for route optimization)

Set the Google Routes key as a Firebase secret used by `defineSecret("MAPS_API_KEY")`:

```bash
firebase functions:secrets:set MAPS_API_KEY
```

### Functions (required for AI satellite measurement)

Set the Vertex key used by `vertexAIChat`:

```bash
firebase functions:secrets:set VERTEX_API_KEY
```

Optional model override (defaults to `gemini-2.0-flash`): set `VERTEX_MODEL` in your Functions runtime environment.

### Functions (QuickBooks Phase 1 OAuth)

Set these Firebase Function secrets before using QuickBooks connect:

```bash
firebase functions:secrets:set QBO_CLIENT_ID
firebase functions:secrets:set QBO_CLIENT_SECRET
firebase functions:secrets:set QBO_REDIRECT_URI
```

Required redirect URI value for `QBO_REDIRECT_URI`:

- `https://us-east1-<your-project-id>.cloudfunctions.net/qboAuthCallback`

In Intuit Developer settings, add the same URI to your app's Redirect URIs.

## Install

```bash
npm install
npm --prefix web install
npm --prefix functions install
```

## Local development

Run web app:

```bash
npm run dev
```

This proxies to `web` and starts Next.js.

## Build validation

Build everything before deploy:

```bash
npm run build
```

This runs:

- `functions` TypeScript build
- `web` Next.js production build

## Deploy

```bash
npm run deploy
```

Scoped deploys:

```bash
npm run deploy:web
npm run deploy:functions
```

Note: deployment uses the Next.js app in `web/`.

## App Hosting envs

`web/apphosting.yaml` defines required `NEXT_PUBLIC_*` variables for build/runtime.
Set real values in Firebase App Hosting backend settings before production deploy.

## Authenticated function smoke testing

Email/Password auth must be enabled in Firebase Authentication.

### Get Firebase ID token

```bash
API_KEY="YOUR_FIREBASE_WEB_API_KEY"
EMAIL="user@example.com"
PASSWORD="your-password"

curl -s "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}" \
	-H "Content-Type: application/json" \
	-d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"returnSecureToken\":true}" \
	| jq -r '.idToken'
```

### Call HTTPS functions

```bash
TOKEN="PASTE_ID_TOKEN"
BASE_URL="https://us-east1-ga-gutter-guys-admin.cloudfunctions.net"

curl -i "${BASE_URL}/healthcheck"

curl -i -X POST "${BASE_URL}/createEstimate" \
	-H "Authorization: Bearer ${TOKEN}" \
	-H "Content-Type: application/json" \
	-d '{"title":"Test","description":"Smoke test","amount":1000,"details":{}}'

curl -i "${BASE_URL}/getEstimates" \
	-H "Authorization: Bearer ${TOKEN}"
```