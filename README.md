# PulseWatch

A lightweight website monitoring project by **PauzeX Developments**, focused on uptime checks, response-time tracking, and incident history.

## Website
https://pauzedevs.github.io/PulseWatch/

## Community monitor requests

Visitors can suggest a public website at [Add a website](https://pauzedevs.github.io/PulseWatch/add.html). The form opens a pre-filled GitHub issue. Requests are reviewed by maintainers before being added to `monitors.json`; submissions do not automatically trigger network checks. This review step prevents arbitrary public input from being executed directly by the monitoring runner.

## Monitoring engine

PulseWatch uses GitHub Actions as a scheduled worker and JSON files as its storage layer. No external database or paid monitoring service is required.

- Checks configured HTTP/HTTPS websites every five minutes.
- Records HTTP status, response time, check timestamp, and current state.
- Classifies results as **Operational** (2xx/3xx), **Degraded** (4xx), or **Down** (5xx, network errors, or timeouts).
- Retains up to 288 samples per monitor by default (24 hours at five-minute intervals).
- Publishes status data to `data/status.json` and history to `data/history.json`.
- The public dashboard reads these JSON files and refreshes every 60 seconds.

### Add websites to monitor

Edit [`monitors.json`](./monitors.json) and add entries to the `monitors` array:

```json
{
  "checks": {
    "timeoutMs": 10000,
    "historyLimit": 288
  },
  "monitors": [
    {
      "id": "my-website",
      "name": "My Website",
      "url": "https://example.com"
    }
  ]
}
```

Use a unique lowercase ID containing letters, numbers, and hyphens. Only public HTTP and HTTPS URLs should be configured. After the change is committed, the monitor workflow can be started manually from **Actions → PulseWatch Monitor → Run workflow**; otherwise it runs on its five-minute schedule.

### Data and limitations

- The first check creates the initial measurements; uptime percentages are calculated from recorded samples, not claimed as historical uptime before monitoring began.
- The 288-sample window represents approximately 24 hours of checks.
- GitHub Actions schedules are best-effort and may be delayed. This is not a contractual uptime SLA.
- The monitor worker stores data by committing JSON updates to this repository. Avoid adding private endpoints, credentials, or URLs containing access tokens.
- The current checker uses HTTP GET requests with a small Range header; some servers may ignore the range and return a normal response.

## Local development

Requires Node.js 22 or later.

```bash
node --test
node scripts/check.mjs
```

## GitHub Pages and Search Console

The Pages workflow deploys the repository root to GitHub Pages when site or monitoring data changes.

- [robots.txt](https://pauzedevs.github.io/PulseWatch/robots.txt)
- [sitemap.xml](https://pauzedevs.github.io/PulseWatch/sitemap.xml)

In **Settings → Pages**, set the build and deployment source to **GitHub Actions**.

For Google Search Console, add and verify `https://pauzedevs.github.io/PulseWatch/` as a URL-prefix property, submit `sitemap.xml`, and inspect the homepage. Sitemap submission does not guarantee indexing.

## Project status

The automated checker and live JSON dashboard are implemented. The initial monitor list includes Apple, Microsoft, Google, GitHub, Cloudflare, Amazon, Wikipedia, and YouTube. Community requests are reviewed before acceptance.
