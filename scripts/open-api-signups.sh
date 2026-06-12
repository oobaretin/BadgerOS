#!/usr/bin/env bash
# Opens free-tier signup pages for BadgerOS API keys.
# Paste each key into .env.local, then: npm run dev

set -e

URLS=(
  "https://emailrep.io/key"
  "https://rapidapi.com/auth/sign-up"
  "https://www.abuseipdb.com/account/api"
  "https://account.shodan.io/register"
  "https://securitytrails.com/corp/api"
  "https://www.virustotal.com/gui/join-us"
  "https://otx.alienvault.com/api"
  "https://urlscan.io/user/signup"
  "https://www.phishtank.com/register.php"
  "https://app.numlookupapi.com/register"
  "https://app.platerecognizer.com/accounts/signup/"
  "https://developer-portal.driver-vehicle-licensing.api.gov.uk/"
  "https://serpapi.com/users/sign_up"
  "https://portal.azure.com/#create/Microsoft.CognitiveServicesBingSearch-v7"
  "https://services.tineye.com/TinEyeAPI"
  "https://api.imgbb.com/"
  "https://auth.abuse.ch/"
  "https://www.domainsdb.info/"
  "https://hunter.io/users/sign_up"
)

echo "Opening ${#URLS[@]} signup pages…"
for url in "${URLS[@]}"; do
  open "$url" 2>/dev/null || xdg-open "$url" 2>/dev/null || echo "$url"
  sleep 0.3
done

echo "Done. Paste keys into .env.local and run: npm run dev"
