# Hedge Fund Early Warning Surveillance Platform v2.0

Full-stack Node.js/Express + React dashboard that monitors 43 risk indicators across 4 domains, with 4 live market data feeds.

## Quick Start

```bash
npm install
npm start
# → http://localhost:3001
```

## Architecture

```
hedge-fund-dashboard/
├── server/
│   └── index.js          # Express API + scheduled polling
├── public/
│   └── index.html        # React SPA (single-file, no build step)
├── .env                  # Environment variables
├── package.json
└── README.md
```

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/live-feed` | GET | Returns cached live data (2-min TTL) |
| `/api/live-feed/force` | GET | Forces a fresh fetch, bypassing cache |
| `/api/health` | GET | Health check with last fetch timestamp |

## Live Data Sources

| Indicator | Source | Ticker |
|---|---|---|
| VIX | Yahoo Finance | `^VIX` |
| VVIX | Yahoo Finance | `^VVIX` |
| SOFR | FRED / NY Fed | `SOFR` |
| SPY daily chg % | Yahoo Finance | `SPY` |
| QQQ daily chg % | Yahoo Finance | `QQQ` |

## Status Thresholds

- **VIX**: Normal <20 · Watch 20–25 · Elevated 25–30 · Critical >30
- **VVIX**: Normal <90 · Watch 90–100 · Elevated 100–120 · Critical >120
- **SOFR**: Normal <4.5% · Watch 4.5–5% · Elevated 5–5.5% · Critical >5.5%
- **ETF daily chg**: Normal <1% · Watch 1–2% · Elevated 2–3% · Critical >3%

## Refresh Schedule

The server automatically polls every 15 minutes during US market hours (9:30 AM – 4:00 PM ET, Mon–Fri). Configure the interval via `REFRESH_INTERVAL_MIN` in `.env`.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | 3001 | Server port |
| `FRED_API_KEY` | (empty) | Optional FRED API key |
| `REFRESH_INTERVAL_MIN` | 15 | Auto-poll interval in minutes |
