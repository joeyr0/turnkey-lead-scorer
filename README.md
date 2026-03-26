# Turnkey Lead Scoring & ICP Fit System

Score prospect lists against Turnkey's ICP using a two-pass AI scoring system. Upload a CSV or XLSX, get every company and contact scored, outreach hooks generated, and an enriched CSV exported — ready for the BDR queue.

## What it does

1. **Pre-flags** your list against hardcoded customer, competitor, Tier 1, and warm-path lists before any API calls
2. **Company Scoring** — scores each company on ICP fit (1–5) and TVC fit (1–5) using GPT-4.1, generates outreach hooks and solution mappings
3. **Contact Scoring** — scores each contact based on title × company type, generates LinkedIn connection requests
4. **Audit System** — optional second pass with 3 challenge prompts that catch under-scoring, over-scoring, and contact gaps
5. **Export** — enriched CSV with 26 columns including all scores, hooks, LinkedIn requests, and audit verdicts

## Running locally

No build step, no dependencies to install. Just serve the folder over HTTP.

**Option 1 — Python (built into macOS/Linux)**
```bash
cd turnkey-lead-scorer
python3 -m http.server 8080
```
Then open: [http://localhost:8080](http://localhost:8080)

**Option 2 — Node (npx)**
```bash
cd turnkey-lead-scorer
npx serve .
```
Then open the URL it prints (usually [http://localhost:3000](http://localhost:3000))

**Option 3 — VS Code Live Server**
Right-click `index.html` → Open with Live Server

> ⚠️ You must use a local server — opening `index.html` directly via `file://` will block the CDN scripts (PapaParse, SheetJS) due to CORS.

## Setup

1. Clone the repo and start a local server (see above)
2. Paste your **OpenAI API key** (`sk-...`) into the key field in the top-right — it's saved to `localStorage` so you only do this once
3. Drop a CSV or XLSX onto the upload zone

## Input format

Your CSV needs at minimum:
- **Domain** column (required — used as the primary grouping key)
- **Company** column

Optional but recommended:
- Contact Name, Title, Email, LinkedIn URL

The tool auto-detects column names. If it guesses wrong, you can reassign them in the pre-flight screen before scoring.

## Scoring flow

```
Upload CSV/XLSX
  → Column mapping confirmation
  → JS pre-flagging (customers, competitors, Tier 1, warm paths)
  → [⚡ Score List]
      → Company Scorer  (GPT-4.1, batches of 10)
      → Contact Scorer  (GPT-4.1, batches of 15)
      → Calculate actions + render results
  → [🔍 Audit Scores]  (optional)
      → Challenge 1: under-scoring review (Score 3s)
      → Challenge 2: over-scoring review (Score 4–5s)
      → Challenge 3: contact gap detection
  → [↓ Export CSV]
```

## Cost estimates

| List size | Score List | + Audit |
|-----------|-----------|---------|
| 100 contacts | ~$0.30–0.50 | +$0.10–0.20 |
| 500 contacts | ~$1.50–2.50 | +$0.50–1.00 |
| 1000 contacts | ~$3.00–5.00 | +$1.00–2.00 |

## File structure

```
index.html          ← entry point
styles.css          ← dark theme
js/
  data.js           ← customer list, competitor lists, Tier 1 targets, warm paths
  utils.js          ← shared helpers (normalize, copy, sort, etc.)
  phase1.js         ← file parsing, column mapping, grouping, pre-flagging
  phase2.js         ← company scoring (OpenAI API + system prompt)
  phase3.js         ← contact scoring (OpenAI API + system prompt)
  phase4.js         ← action logic, results rendering, company cards
  phase5.js         ← audit system (3 challenge prompts)
  phase6.js         ← CSV export (26 columns)
  app.js            ← app state, main flow, event handlers
```

## Tech

- Vanilla JS, no frameworks, no build step
- [PapaParse](https://www.papaparse.com/) for CSV parsing
- [SheetJS](https://sheetjs.com/) for XLSX parsing
- OpenAI API (`gpt-4.1-2025-04-14`, temperature 0)
- Dark theme with Syne + IBM Plex Mono fonts
