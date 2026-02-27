#!/usr/bin/env bash
set -euo pipefail

cd /workspaces/Ga-Gutter-Guys-ERP-Admin-Portal

API_KEY=$(awk -F= '/^NEXT_PUBLIC_FIREBASE_API_KEY=/{print $2}' web/.env.local)
AUTH_JSON=$(curl -s "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"dulayne@hitfluenctech.com","password":"TestPassword2026!","returnSecureToken":true}')

ID_TOKEN=$(printf '%s' "$AUTH_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("idToken",""))')

if [[ -z "$ID_TOKEN" ]]; then
  echo "AUTH_FAILED"
  printf '%s\n' "$AUTH_JSON"
  exit 0
fi

echo "AUTH_OK token_len=$(printf '%s' "$ID_TOKEN" | wc -c | tr -d ' ')"

BASE_URL="https://us-east1-ga-gutter-guys-admin.cloudfunctions.net/vertexAIChat"
ORIGIN="https://ga-gutter-guys-admin.web.app"

echo "--- vertexAIChat authenticated call ---"
curl -s -i -X POST "$BASE_URL" \
  -H "Origin: $ORIGIN" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"address":"3160 Hartridge Dr, Johns Creek, GA 30022","messages":[{"role":"user","content":"Estimate total roof-edge and gutter linear feet and return JSON totalFeet/confidence."}],"meta":{"task":"satellite_measurement","responseFormat":"json"}}' | sed -n '1,140p'
