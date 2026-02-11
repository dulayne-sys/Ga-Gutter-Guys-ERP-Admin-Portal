# Ga-Gutter-Guys-ERP-Admin-Portal

## Authenticated Function Testing

Email/Password authentication must be enabled in the Firebase Console for the project.

### Get a Firebase ID token

```bash
API_KEY="YOUR_FIREBASE_WEB_API_KEY"
EMAIL="user@example.com"
PASSWORD="your-password"

curl -s "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}" \
	-H "Content-Type: application/json" \
	-d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"returnSecureToken\":true}" \
	| jq -r '.idToken'
```

### Call HTTPS functions with Authorization

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

curl -i -X POST "${BASE_URL}/setUserRole" \
	-H "Authorization: Bearer ${TOKEN}" \
	-H "Content-Type: application/json" \
	-d '{"uid":"TARGET_UID","role":"staff","companyId":"COMPANY_ID"}'
```

### Verify access rules

- Unauthenticated requests should return 401.
- Cross-company requests should return 403.
- Admin or staff requests with matching token companyId should succeed.

## Google Maps API Key (Functions)

Set the Routes/Geocoding key for Cloud Functions:

```bash
firebase functions:config:set google_maps.api_key="YOUR_GOOGLE_MAPS_API_KEY"
```

Then expose it as an environment variable in your deployment environment or set `GOOGLE_MAPS_API_KEY` for the Functions runtime.