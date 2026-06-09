# BadgerOS

Next.js OSINT dashboard — one search box, auto-detects input type, and fans out to relevant intelligence modules in parallel.

## Modules

| Module | Route | Input types | Sources |
|--------|-------|-------------|---------|
| Breach Intel | `/api/breach` | email | EmailRep, HIBP, BreachDirectory |
| IP Intelligence | `/api/ip` | ip, domain | ip-api, AbuseIPDB, Shodan, InternetDB |
| Phone Intelligence | `/api/phone` | phone | Numverify (apilayer.com — free), Abstract Phone (abstractapi.com — free) |
| Vehicle Intel | `/api/plate` | plate, VIN | NHTSA (free), DVLA (developer.gov.uk — free, UK), Plate Recognizer (2500 free/mo) |
| Domain Intel | `/api/whois` | domain | RDAP, Google DNS, crt.sh, SecurityTrails, Wayback |
| Threat Intel | `/api/threat` | domain | VirusTotal, OTX, urlscan, PhishTank |
| Username OSINT | `/api/username` | username | GitHub, Reddit, Dev.to, HN + HEAD checks |

Smart routing runs only relevant modules per input type. Enable **Run all 7 modules** in the UI to override.

### Deep research

Enable **Deep research** to run a second analysis pass after primary recon:

- **Primary enrichments** — Gravatar (email), SPF/DMARC TXT + nameservers (domain), reverse DNS PTR (IP)
- **Entity pivots** — subdomains from crt.sh, MX hosts, DNS A records, reverse hostnames
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

See `.env.example` for optional keys. Free sources (ip-api, RDAP, crt.sh, InternetDB, archive.org, NHTSA, etc.) work without keys. Phone: **apilayer.com** + **abstractapi.com**. Vehicle: **developer.gov.uk** (UK plates) + **platerecognizer.com** (image ALPR, 2500 free/mo — pass `imageUrl` in API).

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
