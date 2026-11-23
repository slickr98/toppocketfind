# Anonymous store reporting

Live dashboard: https://www.toppocketfind.ca/track/

## What the counters mean

- **Page views:** one successful counter per page load, plus back/forward-cache restores. Refreshes and return visits count again. This is not a count of unique people or sessions.
- **Inventory clicks:** clicks opening a coin listing, including keyboard activation and middle clicks. Listing views are counted separately when the product page loads.
- **Source/campaign:** approved public ad labels. Labels carry between internal store links, without cookies or visitor identifiers. Source figures count tagged page views, not unique ad arrivals. Direct/unknown includes traffic without recognizable attribution. No ad has been published by this feature.
- **Time:** counts are stored in UTC hourly buckets; reports use America/Moncton. Today shows hour-of-day totals; the repeated hour at the autumn clock change is combined. Other presets show daily totals.
- The stored starting date is in `tpf_analytics.metadata`. Earlier activity is unavailable. Failed/blocked counter requests can be missed, and known-bot filtering is best-effort. Never describe these as exact human counts.

## Privacy and access

Only aggregate counters are stored: bucket, event, fixed page path, approved source, registered campaign and count. No raw event history, visitor IDs, cookies, fingerprinting, IPs, user agents, full URLs, query strings or referrers are retained in the analytics tables. Infrastructure providers still process normal connection information for hosting/security; the privacy notice says so.

Global Privacy Control, Do Not Track, known bots and the optional own-browser exclusion suppress collection. The exclusion is only an on/off localStorage preference (`tpf_analytics_exclude`); it does not identify a visitor. `?analytics=off` excludes this browser; `?analytics=on` restores counting. Signing into `/track/` defaults that browser to excluded.

Statistics API requires a server-verified bearer token. The owner enters a high-entropy private access code; only its SHA-256 hash is configured in Render (`TRACK_ADMIN_HASH`). `TRACK_SIGNING_SECRET` signs a read-only token that expires in 12 hours and is retained in sessionStorage for this tab. No authentication secret is checked into the repository. Rotating the access-code hash or signing secret invalidates prior tokens. Logout clears the tab's token and displayed report.

Render service: `srv-d2l0eip5pdvs73a6m5t0`, workspace `tea-d2kvt1ndiees73fsvceg` (Top Pocket Find). Environment keys added with **merge**, preserving checkout configuration: `TRACK_ENABLED`, `TRACK_ADMIN_HASH`, `TRACK_SIGNING_SECRET`. Analytics uses the existing `DATABASE_URL`; it never reads `DATABASE_URL_TEST`. No plan upgrades or extra hosted services were added.

## Campaign links ready for later ads

Only registered labels in `api/tracking-campaigns.json` are accepted. Unknown campaign text is discarded. Add a new registered campaign before using a new tag. These links are examples for future ads, not evidence of an active campaign:

| Ad | URL |
|---|---|
| Kijiji coin collection | https://www.toppocketfind.ca/?utm_source=kijiji&utm_campaign=coin-collection |
| Kijiji silver dollars | https://www.toppocketfind.ca/?utm_source=kijiji&utm_campaign=silver-dollars |
| Facebook coin collection | https://www.toppocketfind.ca/?utm_source=facebook&utm_campaign=coin-collection |

## Operational details

`server/migrations/001_anonymous_analytics.sql` creates only the `tpf_analytics` schema and tables. It was tested on a disposable local PostgreSQL server and the existing Neon sandbox branch before production. It does not alter `tpf_live.stock`, orders, reservations or payment settings.

Collection is `POST /analytics/collect`; login is `POST /analytics/login`; private reports are `GET /analytics/report?period=today|7|28|all&source=all|direct|kijiji|facebook|google|bing|other`. Report responses are `no-store`; the static dashboard shell has no private records. Reporting refreshes only on initial sign-in, filters or the Refresh button, to avoid continuous polling on free compute. The free server can take time to respond after inactivity.

When Rick asks ChatGPT for totals, read the same aggregate data via the authenticated endpoint or authorized Neon connector. Project `frosty-heart-57316651`, production branch `br-divine-field-bb4gydl1`, schema `tpf_analytics`. Use `bucket AT TIME ZONE 'America/Moncton'` for local-day grouping, and sum counts by event; never query sandbox figures as production. Only read the necessary date range.

Checks: `node --test tests/analytics.test.cjs tests/cart.test.cjs` and `python tests/run_postgres_tests.py`. Tests cover authentication, invalidation, restricted origins, aggregation, campaign sanitization, privacy exclusions, empty reports, Atlantic midnight, and unchanged checkout behavior. Fixtures stay in disposable test storage.
