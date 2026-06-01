# Sabai Sabai Monitoring

This file records the production endpoints that external monitors should watch.

## Primary Health Check

- Endpoint: `GET /health`
- Expected status: `200`
- Failure status: `503`
- Cache behavior: `Cache-Control: no-store`

The health route verifies four critical operating conditions:

1. `dist/index.html` exists, so the production server can serve the React shell.
2. `public/data.json` exists, parses as JSON, and contains at least one listing.
3. `public/feed.json` exists, parses as JSON, and contains at least one feed item.
4. `logs/heartbeat.stall` is absent and the latest heartbeat entry is not stale or errored.

## Monitor Registry

Add the deployed URL here after the external monitor is created.

| Monitor | URL | Region | Cadence | Notes |
| --- | --- | --- | --- | --- |
| UptimeRobot | TBD | Global | 5 min | Point at `https://<production-host>/health`. |

## Operator Notes

- A `503` from `/health` should be treated as actionable even when the homepage still renders. The route is designed to catch silent failures in build artifacts, mutable snapshots, and heartbeat stalls.
- Missing heartbeat history alone is reported as a warning in the JSON payload. The endpoint degrades only when the stall flag exists, the latest heartbeat says `stale`, the latest heartbeat has an error, or the latest run is older than the stale threshold.
- After each deploy, fetch `/health` before declaring the deployment live.
