# Data Update Guide

`artists.json` and `kink-tags.json` are refreshed from the Danbooru API by the
**Update Danbooru data** workflow (`.github/workflows/update-data.yml`):

- **Daily** — refreshes every artist's post count.
- **Weekly (Sunday)** — re-checks the kink tag list, discovers new artists for each core+kink tag combo, then refreshes counts.
- **Manually** — Actions → *Update Danbooru data* → *Run workflow* (`full` or `counts`).

Each run checks Danbooru access first, commits the result straight to the branch it ran on, and redeploys GitHub Pages so the live site picks up the new data.

## When Danbooru refuses requests

If Danbooru answers with HTTP 401/403 (for example a Cloudflare block on GitHub's runners), the run **fails with the response details in the job summary and writes nothing**. The scripts never fall back to stale or partial data. To fix it:

1. Create an API key on Danbooru (*My Account → API Key*, read access is enough).
2. Add two repository secrets (*Settings → Secrets and variables → Actions*): `DANBOORU_LOGIN` (your username) and `DANBOORU_API_KEY`.
3. Re-run the workflow. If it is still refused, run the update locally (below).

## Running locally

```bash
npm run check:danbooru   # confirm this machine can reach the API
npm run update:data      # tags + artist discovery + post counts
```

Then commit `artists.json` / `kink-tags.json` and push to `Holding`; pushing data files triggers the Pages deploy. The helper scripts do the same and can open a PR instead:

```bash
./scripts/update-kink-tags-local.sh --pr          # Linux/Mac
.\scripts\update-kink-tags-local.ps1 -CreatePR    # Windows
```

Individual steps: `npm run update:tags` (tags + discovery) and `npm run update:counts` (counts only).

## Tuning

| Variable | Default | Purpose |
| --- | --- | --- |
| `DANBOORU_LOGIN` / `DANBOORU_API_KEY` | — | Authenticate requests |
| `DANBOORU_USER_AGENT` | `TagExplorer-DataUpdater/2.0 (…)` | Identifying User-Agent sent with every request |
| `DANBOORU_RATE` | `5` | Requests per second (on HTTP 429 all requests pause and back off, then recover) |
| `DANBOORU_CONCURRENCY` | `3` | Requests in flight at once |
| `DISCOVER_MAX_PAGES` | `100` | Pages of 200 posts scanned per tag combo |
| `MIN_ARTIST_POSTS` | `40` | Artists below this post count are dropped |
| `MAX_FAILURE_RATIO` | `0.05` | Count lookups allowed to fail before the run is rejected |
| `MAX_TAG_DROP_RATIO` / `MAX_ARTIST_DROP_RATIO` | `0.1` / `0.05` | Largest shrink allowed before a run is rejected |
