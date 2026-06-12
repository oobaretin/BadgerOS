# BadgerOS

Next.js OSINT dashboard — one search box, auto-detects input type, and fans out to relevant intelligence modules in parallel.

## Modules

| Module | Route | Input types | Sources |
|--------|-------|-------------|---------|
| Breach Intel | `/api/breach` | email | EmailRep, HIBP, BreachDirectory, Disify, Kickbox, Hunter (verifier) |
| IP Intelligence | `/api/ip` | ip, domain | ip-api, AbuseIPDB, Shodan, InternetDB, GreyNoise, IPinfo |
| Phone Intelligence | `/api/phone` | phone | NumLookup (numlookupapi.com — free) |
| Vehicle Intel | `/api/plate` | plate, VIN | NHTSA (free), DVLA (developer.gov.uk — free, UK), Plate Recognizer (2500 free/mo) |
| Domain Intel | `/api/whois` | domain | RDAP, Google DNS, crt.sh, SecurityTrails, Wayback, DomainsDB, Hunter |
| Threat Intel | `/api/threat` | domain, ip | VirusTotal, OTX, urlscan, PhishTank, Mozilla Observatory, URLhaus, MalwareBazaar |
| Username OSINT | `/api/username` | username | GitHub, Reddit, Dev.to, HN, Bluesky + HEAD checks |

Smart routing runs only relevant modules per input type. Enable **Run all 7 modules** in the UI to override.

### Deep research

Enable **Deep research** to run a second analysis pass after primary recon:

- **Primary enrichments** — Gravatar + Hunter verifier (email), SPF/DMARC TXT + nameservers (domain), reverse DNS PTR (IP)
- **Entity pivots** — subdomains from crt.sh, MX hosts, DNS A records, Hunter emails, DomainsDB related domains, reverse hostnames
- **Secondary lookups** — targeted whois/threat/IP modules on discovered related entities
- **Investigation summary** — insights and suggested next steps

```bash
curl -X POST http://localhost:3000/api/deep \
  -H "Content-Type: application/json" \
  -d '{"query": "github.com"}'
```

## Getting Started

```bash
npm install
cp .env.example .env.local   # optional API keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### API keys

See `.env.example` for optional keys. Free sources (ip-api, RDAP, crt.sh, InternetDB, Disify, Kickbox, GreyNoise Community, IPinfo lite, Mozilla Observatory, Clearbit logo URLs, Bluesky public API, etc.) work without keys. Optional keyed integrations: **auth.abuse.ch** (URLhaus + MalwareBazaar), **domainsdb.info**, **hunter.io**. Phone: **numlookupapi.com**. Vehicle: **developer.gov.uk** (UK plates) + **platerecognizer.com** (image ALPR, 2500 free/mo — pass `imageUrl` in API).

Use the **Keys** button in the header to see which keys are configured (values are never displayed).

## API

```bash
# Smart recon (relevant modules only)
curl -X POST http://localhost:3000/api/recon \
  -H "Content-Type: application/json" \
  -d '{"query": "github.com"}'

# Run all modules
curl -X POST http://localhost:3000/api/recon \
  -H "Content-Type: application/json" \
  -d '{"query": "github.com", "runAll": true}'

# Key configuration status
curl http://localhost:3000/api/config
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run test` | Run unit tests |
| `npm run lint` | ESLint |

## Structure

```
src/
  app/api/          # Route handlers (thin wrappers)
  lib/modules/      # OSINT module logic
  lib/recon.ts      # Server-side recon orchestration
  components/       # Dashboard UI
```

For authorized security research only.

## Deploy to Vercel

BadgerOS is a standard Next.js app and deploys to [Vercel](https://vercel.com) from GitHub.

### 1. Import the repo

1. Push this repo to GitHub (already at [oobaretin/BadgerOS](https://github.com/oobaretin/BadgerOS)).
2. In [Vercel Dashboard](https://vercel.com/new) → **Add New Project** → import **BadgerOS**.
3. Framework preset: **Next.js** (auto-detected). Root directory: `.`

### 2. Environment variables

In **Project Settings → Environment Variables**, add the API keys you need from `.env.example`.

**Phone lookups on Vercel require `NUMLOOKUP_KEY`** (free at [numlookupapi.com](https://app.numlookupapi.com/register)). Keys in your local `.env.local` are **not** copied to Vercel — add them in the dashboard, then **Redeploy**.

Common keys: `NUMLOOKUP_KEY`, `ABUSECH_AUTH_KEY`, `VIRUSTOTAL_API_KEY`, `SERPAPI_KEY`, etc.

Optional:

| Variable | Purpose |
|----------|---------|
| `FACE_SERVER_URL` | External DeepFace server URL (face analysis does not run on Vercel) |
| `RECON_DB_PATH` | Custom SQLite path (defaults to `/tmp/recon.db` on Vercel) |

You do **not** need `NEXT_PUBLIC_BASE_URL` on Vercel — the app uses direct module calls, not self-fetch.

### 3. Deploy

Click **Deploy**. Vercel runs `npm run build` automatically.

### CLI (optional)

```bash
npx vercel login
npx vercel link
npx vercel env pull .env.local   # sync env vars locally
npx vercel --prod
```

### Vercel limitations

| Feature | On Vercel |
|---------|-----------|
| OSINT modules (recon, deep, whois, etc.) | Works — add API keys in env |
| Saved reports (SQLite) | Ephemeral (`/tmp`) — resets on cold starts |
| Face analysis (DeepFace) | Requires separate Python host + `FACE_SERVER_URL` |
| Function timeout | Up to 60s on Pro; Hobby plan is 10s (deep recon may timeout) |
