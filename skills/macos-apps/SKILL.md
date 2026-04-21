---
name: macOS App Discovery
description: Weekly digest of the best new macOS applications from Reddit and Twitter/X
var: ""
tags: [news, digest]
---
> **${var}** — Not used. This skill runs autonomously on a weekly schedule.

## Overview

Collect the top macOS app discoveries from Reddit and Twitter/X over the past 7 days, deduplicate against a persistent index, score each candidate, and produce a structured markdown digest.

## Config

Read `memory/macos-apps-config.yml` for all parameters. If it doesn't exist, use these defaults:

```yaml
reddit:
  subreddits: [macapps, MacOS, productivity]
  keywords: [app, tool, utility, workflow, release, launch, macOS, open source, free app, paid app, menubar, menu bar, indie]
  min_score: 50
  user_agent: "macfolio/1.0 (by u/macfolio-bot)"

twitter:
  query: '(macOS app OR mac app OR "new mac app" OR #macapps OR #MacApps) -is:retweet lang:en'
  max_results: 100
  min_likes: 20
  min_retweets: 10

scoring:
  reddit_weight: 0.6
  twitter_weight: 0.4

output:
  top_n: 10
```

Read `memory/macos-apps-index.json` for the deduplication index (app name → first seen date). If it doesn't exist, start with an empty object `{}`.

## Step 1 — Collect from Reddit

Authenticate using OAuth client credentials:

```bash
curl -s -X POST https://www.reddit.com/api/v1/access_token \
  -u "${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}" \
  -d "grant_type=client_credentials" \
  -A "macfolio/1.0 (by u/macfolio-bot)"
```

For each subreddit, fetch top posts from the past week:

```bash
curl -s -H "Authorization: Bearer ${TOKEN}" \
  -A "macfolio/1.0 (by u/macfolio-bot)" \
  "https://oauth.reddit.com/r/${SUBREDDIT}/top?t=week&limit=50"
```

**Filtering:**
- `r/macapps`: Accept all posts (subreddit is on-topic)
- `r/MacOS`, `r/productivity`: Require at least one keyword match in title or selftext
- All: Drop posts with score < `reddit.min_score` (default 50)

**Extract:** title, url, score, num_comments, selftext (first 300 chars), created_utc

If Reddit auth fails, use WebFetch as fallback to scrape `https://www.reddit.com/r/macapps/top/?t=week`.

## Step 2 — Collect from Twitter/X

```bash
curl -s -H "Authorization: Bearer ${TWITTER_BEARER_TOKEN}" \
  "https://api.twitter.com/2/tweets/search/recent?query=${QUERY}&max_results=100&tweet.fields=public_metrics,created_at"
```

**Query:** `(macOS app OR mac app OR "new mac app" OR #macapps OR #MacApps) -is:retweet lang:en`

**Filtering:** Tweets must have 20+ likes OR 10+ retweets.

**App name extraction:** Look for capitalized proper nouns, `apps.apple.com` links, and quoted phrases.

If `TWITTER_BEARER_TOKEN` is not set, skip this source.

## Step 3 — Deduplicate

For each candidate app:
1. Normalize name: lowercase, strip whitespace, remove ".app" suffix
2. Check against `memory/macos-apps-index.json`
3. If found, exclude from this run
4. If not found, mark as new discovery

## Step 4 — Score and rank

For each non-deduplicated app:

```
signal_score = (reddit_upvotes × 0.6) + (twitter_likes × 0.4)
```

If an app appears on multiple sources, sum all scores. Sort descending, take top 10.

## Step 5 — Categorize

Assign each app to one of: Productivity, Developer Tools, Design, Utilities, Writing, Media, Finance, Other.

## Step 6 — Generate digest

Create `articles/macos-apps-YYYY-MM-DD.md` with today's date:

```markdown
---
date: "YYYY-MM-DD"
title: "macOS App Discoveries — Week of Month DD, YYYY"
app_count: N
---

# macOS App Discoveries — Week of Month DD, YYYY

## Category Name

### App Name
One to two sentence description.

- **Source:** Reddit r/macapps (150 upvotes) | Twitter (45 likes)
- **Price:** Free / Freemium / Paid / Open Source
- **Website:** [domain.com](https://domain.com)
- **Icon:** https://icon-url.com/icon.png
- **Screenshots:** https://url1.com/s1.jpg | https://url2.com/s2.jpg | https://url3.com/s3.jpg
- **Signal Score:** 105.0
```

The `Icon` and `Screenshots` fields are new. Screenshots are pipe-separated URLs. Omit these lines if no images were found.

Group by category, sort by signal_score within each category.

## Step 6b — Enrich with icons and screenshots

For each app in the final list, fetch an icon and up to 3 product screenshots before writing the digest.

**Strategy 1 — iTunes Search API (free, no auth):**

```bash
curl -s "https://itunes.apple.com/search?term=APP_NAME&entity=macSoftware&country=us&limit=3"
```

If a match is found, use `artworkUrl512` for the icon and the first 3 entries of `screenshotUrls` for screenshots.

**Strategy 2 — Website og:image (for apps not on the App Store):**

Use WebFetch on the app's website and extract the `og:image` meta tag as the icon. Look for product hero or screenshot images on the landing page for screenshots.

If neither yields results, omit the Icon and Screenshots lines for that app.

## Step 7 — Update dedup index

Append all newly discovered apps to `memory/macos-apps-index.json`:

```json
{
  "existingapp": "2026-04-13",
  "newapp": "2026-04-20"
}
```

## Step 8 — Notify

Use the `./notify` command to announce the digest:

```bash
./notify "macOS App Digest — YYYY-MM-DD: Found N new apps. Top pick: AppName — description."
```

## Sandbox note

The sandbox may block outbound `curl`. If a `curl` call fails with a network error, use `WebFetch` as a fallback to retrieve the same URL. For Reddit specifically, you can use `WebFetch("https://www.reddit.com/r/macapps/top.json?t=week&limit=50", "Return the JSON response")`.
