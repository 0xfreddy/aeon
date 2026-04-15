---
name: Monitor Kalshi
description: Monitor specific Kalshi prediction markets for 24h price moves, volume changes, and top events
var: ""
tags: [crypto, research]
---
> **${var}** — Event ticker to monitor (e.g. "KXGDP-26Q2"). If empty, reads the watchlist from `skills/monitor-kalshi/watchlist.md`.

Read `memory/MEMORY.md` for context.
Read the last 2 days of `memory/logs/` to compare against previous readings and flag changes.

## Watchlist

The default watchlist lives at `skills/monitor-kalshi/watchlist.md`. Each line is an event ticker. Add or remove tickers to change what gets monitored.

If `${var}` is set, monitor only that single event (useful for ad-hoc checks).

## API Reference

Base URL: `https://api.elections.kalshi.com/trade-api/v2`

Despite the "elections" subdomain, this provides access to ALL Kalshi markets (economics, climate, tech, politics, etc.). All endpoints below are **public — no auth required**.

## Steps

### 1. Load watchlist

```bash
if [ -n "${var}" ]; then
  TICKERS="${var}"
else
  # Read watchlist file, one ticker per line, skip comments and blanks
  TICKERS=$(grep -v '^#' skills/monitor-kalshi/watchlist.md | grep -v '^$')
fi
```

If the watchlist is empty and no `${var}` is set, discover trending events instead:
```bash
# Get open events sorted by volume
curl -s "https://api.elections.kalshi.com/trade-api/v2/events?status=open&with_nested_markets=true&limit=10"
```
Pick the 5 highest-volume events and monitor those.

### 2. For each event, fetch markets and price history

For each event ticker in the watchlist:

**a) Get the event and its markets:**
```bash
curl -s "https://api.elections.kalshi.com/trade-api/v2/events/$EVENT_TICKER?with_nested_markets=true"
```

The response contains the event with fields: `event_ticker`, `title`, `category`, `mutually_exclusive`. The `markets` array contains each market with:
- `ticker`, `title`, `subtitle`, `status` (open, closed, settled)
- `yes_bid`, `yes_ask`, `last_price` — current prices in dollars (0.00–1.00)
- `volume`, `volume_24h`, `open_interest` — trading activity
- `close_time` — when the market closes

**Skip non-open markets** — they've already resolved.

**b) Get 24h candlestick data for each open market:**
```bash
# Calculate timestamps
END_TS=$(date -u +%s)
START_TS=$((END_TS - 86400))

# Need the series_ticker — extract from market ticker (everything before the last dash-segment, or use the event's series_ticker)
curl -s "https://api.elections.kalshi.com/trade-api/v2/series/$SERIES_TICKER/markets/$MARKET_TICKER/candlesticks?start_ts=$START_TS&end_ts=$END_TS&period_interval=60"
```

If the candlestick endpoint fails (series ticker unknown), fall back to comparing the current `last_price` against yesterday's log entry.

Response: `{ "candlesticks": [{ "end_period_ts": N, "price": { "open_dollars": "0.XX", "close_dollars": "0.XX", "high_dollars": "0.XX", "low_dollars": "0.XX" }, "volume_fp": "N" }, ...] }`

**c) Calculate 24h stats for each market:**
- **Open / Close** — first and last candlestick close price
- **Change** — close minus open, in percentage points (e.g. +4.0pp)
- **High / Low** — intraday range from candlestick extremes
- **Volume** — `volume_24h` from the market data
- **Direction** — classify as: surging (>+5pp), rising (+2 to +5pp), stable (-2 to +2pp), falling (-5 to -2pp), crashing (<-5pp)

### 3. Build the report

For each event, produce a summary block:

```
**[Event Title]** (ticker: EVENT_TICKER)

| Market | YES | 24h Chg | High/Low | 24h Vol | Close |
|--------|-----|---------|----------|---------|-------|
| [title] | XX.X¢ | +X.Xpp ▲ | XX–XX¢ | $X.Xk | [date] |
| [title] | XX.X¢ | -X.Xpp ▼ | XX–XX¢ | $X.Xk | [date] |
...

Biggest mover: "[title]" — [direction] from X¢ to Y¢
```

Flag any market that moved more than **5 percentage points** in 24h — these are the ones worth paying attention to.

### 4. Discover notable trends

After processing the watchlist, briefly check for high-activity events you're NOT tracking:
```bash
curl -s "https://api.elections.kalshi.com/trade-api/v2/events?status=open&with_nested_markets=true&limit=20"
```
Scan for any event with unusually high volume or recent large price swings. Mention 1-2 worth adding to the watchlist.

### 5. Notify

Send via `./notify` (under 4000 chars):
```
kalshi monitor — ${today}

[Event Title]
[market] YES X¢ (chg pp) $Xk vol — closes [date]
[market] YES X¢ (chg pp) $Xk vol
biggest mover: [market] — [direction]

[next event...]

alerts: [list any markets that moved >5pp]
trending (not tracked): [1-2 high-volume events worth watching]
```

If no markets moved significantly, say so — "all quiet" is useful signal too.

### 6. Log

Append to `memory/logs/${today}.md`:
```
## Monitor Kalshi
- **Events monitored:** N
- **Markets tracked:** N (M open, K closed/settled)
- **Biggest mover:** "[title]" — X¢ → Y¢ (+/-Zpp)
- **Alert markets (>5pp move):** [list or "none"]
- **Trending untracked:** [1-2 events or "none"]
- **Notification sent:** yes
```

If a market has moved dramatically or a new trend is forming, also note it in `memory/MEMORY.md` for future reference.

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as a fallback for any URL fetch:
- `WebFetch("https://api.elections.kalshi.com/trade-api/v2/events/EVENT_TICKER?with_nested_markets=true")`
- All Kalshi endpoints are public and need no auth headers.
