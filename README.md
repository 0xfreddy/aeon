# Aeon <img src="aeon.jpg" alt="Aeon" width="24" />

Background intelligence that evolves with you.

Autonomous agent running on GitHub Actions, powered by Claude Code. 32 skills across research, dev tooling, crypto monitoring, and productivity — all off by default, turn on what you need.

**No infra, no Mac Mini, no API costs.** Aeon runs entirely on GitHub Actions — fork the repo, add your Claude Code token, and you have an autonomous agent. Skills are just markdown files that Claude reads and executes. The scheduler is a cron job. Memory is git commits. Nothing else really.

Talk to it on Telegram, Discord, or Slack — it polls for messages, interprets what you want, and acts on it. Ask it to write an article, run a digest, or research a topic. It responds in the same channel.

It builds its own skills. The `build-skill` skill looks at open issues and capability gaps, then writes a new `SKILL.md` and wires it up. The `search-skill` skill searches the [open agent skills ecosystem](https://github.com/vercel-labs/skills) for existing skills to install. Skills compose — one skill can read and execute another, chaining outputs together.

Unlike managed agent platforms, there's no vendor lock-in and no usage fees beyond what you already pay for Claude and GitHub. The entire system is ~200 lines of workflow YAML and a folder of markdown files. You own all of it.

<p align="center">
  <img src="aeon-banner.jpg" alt="Aeon Banner" width="100%" />
</p>

## Quick start

1. **Click "Use this template"** on GitHub to create your own copy
2. **Enable GitHub Actions** — go to the **Actions** tab in your fork and click "I understand my workflows, go ahead and enable them"
3. **Add secrets** — go to **Settings > Secrets and variables > Actions** and add:

| Secret | | Used by |
|--------|----------|---------|
| `ANTHROPIC_API_KEY` _or_ `CLAUDE_CODE_OAUTH_TOKEN` | **Required (one of)** | All skills — Claude Code auth (see [authentication](#authentication)) |
| `TELEGRAM_BOT_TOKEN` | **Recommended** | Notifications + bidirectional messaging ([setup](#telegram-integration)) |
| `TELEGRAM_CHAT_ID` | **Recommended** | Notifications + bidirectional messaging |
| `DISCORD_BOT_TOKEN` | Optional | Bidirectional messaging on Discord (read messages) |
| `DISCORD_CHANNEL_ID` | Optional | Which Discord channel to monitor |
| `DISCORD_WEBHOOK_URL` | Optional | Notifications (outbound) |
| `SLACK_BOT_TOKEN` | Optional | Bidirectional messaging on Slack (read messages) |
| `SLACK_CHANNEL_ID` | Optional | Which Slack channel to monitor |
| `SLACK_WEBHOOK_URL` | Optional | Notifications (outbound) |
| `XAI_API_KEY` | Optional | `digest`, `tweet-digest`, `fetch-tweets` — X/Twitter search via Grok |
| `COINGECKO_API_KEY` | Optional | `token-alert` — works without, key improves rate limits |
| `ALCHEMY_API_KEY` | Optional | `on-chain-monitor`, `wallet-digest`, `defi-monitor` — use in RPC URLs |
| `GH_GLOBAL` | Optional | Cross-repo access for skills like `github-monitor`, `pr-review`, `feature` (see [cross-repo access](#cross-repo-access)) |

4. **Edit `aeon.yml`** — set `enabled: true` on the skills you want
5. **Test** — go to **Actions > Run Skill > Run workflow** and enter a skill name (e.g. `article`)

### Authentication

Claude Code needs one of two secrets to authenticate with Anthropic. **Set one — not both.**

| Secret | What it is | Billing |
|--------|-----------|---------|
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token from your Claude Pro/Max subscription | Included in your subscription |
| `ANTHROPIC_API_KEY` | Standard API key from console.anthropic.com | Usage-based (pay per token) |

Claude Code reads these automatically from the environment — there's no separate "Claude Code key." The same `ANTHROPIC_API_KEY` used for the Anthropic API works directly with Claude Code.

**Option A: OAuth token (recommended)** — uses your existing Claude Pro/Max subscription, no separate API billing.

1. Install [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and run:
   ```bash
   claude setup-token
   ```
2. It opens a browser for OAuth login, then prints a long-lived token (`sk-ant-oat01-...`, valid for 1 year).
3. Add it as `CLAUDE_CODE_OAUTH_TOKEN` in your repo secrets.

**Option B: API key** — usage-based billing through console.anthropic.com.

1. Go to [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) and create a key.
2. Add it as `ANTHROPIC_API_KEY` in your repo secrets.

### Cross-repo access

By default, Aeon can only access its own repo. The built-in `GITHUB_TOKEN` that GitHub Actions provides is scoped to the repository where the workflow runs — it can't read, write, or open PRs on your other repos.

To let skills like `github-monitor`, `pr-review`, `issue-triage`, and `feature` work across your repos, add a `GH_GLOBAL` secret with a Personal Access Token that has broader permissions.

**`GITHUB_TOKEN` vs `GH_GLOBAL`:**

| | `GITHUB_TOKEN` | `GH_GLOBAL` |
|---|---|---|
| **Scope** | This repo only | Any repo you grant access to |
| **Created by** | GitHub (automatic, every run) | You (manual, in settings/tokens) |
| **Lifetime** | Expires when the job ends | Up to 1 year (fine-grained) or indefinite (classic) |
| **Use case** | Committing memory/logs back to Aeon | Monitoring, reviewing, and pushing to other repos |

**Setup:**

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens) → **Fine-grained tokens** → **Generate new token**
2. Set **Resource owner** to your account
3. Under **Repository access**, pick the repos you want Aeon to manage (or "All repositories")
4. Under **Permissions**, grant:
   - **Contents**: Read and write (push code, create branches)
   - **Pull requests**: Read and write (open/comment on PRs)
   - **Issues**: Read and write (triage, label, comment)
5. Add it as `GH_GLOBAL` in your Aeon repo secrets (**Settings > Secrets and variables > Actions**)

Skills automatically use `GH_GLOBAL` when available and fall back to `GITHUB_TOKEN` when it's not set. No workflow changes needed.

## How it works

Two GitHub Actions workflows work together. A scheduler (`messages.yml`) runs every 5 minutes — it checks for incoming messages (Telegram, Discord, Slack) and matches skills from `aeon.yml` by their cron schedule. When a skill matches, it dispatches it to the runner (`aeon.yml`), which tells Claude Code to read and execute that skill's markdown file. After Claude finishes, the workflow commits all changes back to your repo.

```
Every 5 min, messages.yml fires
  → Poll job: checks Telegram/Discord/Slack for new messages
    → Message found → runs Claude to interpret and respond
    → No message   → exits (~10 seconds)
  → Schedule job: checks aeon.yml for skills due now
    → Match found → dispatches to aeon.yml (skill runner)
    → No match    → exits (~10 seconds)
```

Monitor-type skills that find nothing log an ack (`HEARTBEAT_OK`, `TOKEN_ALERT_OK`, etc.) and the workflow skips the commit — zero noise when nothing needs attention.

### Heartbeat

Heartbeat is the only skill enabled by default. It's the agent's core loop — a proactive ambient check that runs every 3 hours as the fallback, catching anything that falls through the cracks.

Every time heartbeat fires, it reads recent memory and logs, then runs through a checklist: stalled PRs older than 24 hours, flagged memory items needing follow-up, urgent GitHub issues, and scheduled skills that haven't run when expected. It deduplicates against the last 48 hours of logs before notifying — if it already told you about something, it won't tell you again.

If nothing needs attention, it logs `HEARTBEAT_OK` and exits. No commit, no notification. If something does need attention, it sends a concise notification and logs the finding. The heartbeat is always listed last in `aeon.yml` — the scheduler picks skills in order, so heartbeat only runs when no other skill is scheduled for that slot.

This is what makes Aeon more than a collection of cron jobs. Heartbeat gives it ambient awareness — a background process that watches over everything and surfaces problems you'd otherwise miss until they become urgent.

### Design philosophy

Aeon's architecture is intentionally the opposite of projects like [OpenClaw](https://github.com/openclaw/openclaw). Where OpenClaw runs a long-lived gateway daemon on your own infrastructure — a central process that owns all messaging surfaces, maintains persistent connections, and routes through a multi-stage pipeline (channel adapters → session coordination → lane queues → agent runner → agentic loop) — Aeon has no running process at all.

There is no server. No daemon. No WebSocket connections. No container to keep alive. The entire system is **event-driven and ephemeral**: a cron trigger fires, a bash script checks if there's work, and if there is, it spins up Claude Code for a few minutes in a disposable GitHub Actions runner. When the task is done, the runner is destroyed. State lives in git. Memory lives in markdown files. The scheduler is 300 lines of shell script.

This is a deliberate trade-off:

| | Aeon | OpenClaw |
|---|---|---|
| **Runtime** | Ephemeral (GitHub Actions) | Long-lived daemon |
| **Infra** | None — runs on GitHub's runners | Self-hosted (laptop, VPS, cloud) |
| **State** | Git commits + markdown files | In-memory + external DB |
| **Latency** | Minutes (cron polling) | Seconds (persistent connections) |
| **Cost** | Free (public repo) or ~$2/mo | Your server costs |
| **Failure mode** | Missed cron tick, retries next cycle | Process crash, needs restart |
| **Extensibility** | Add a markdown file | Write a plugin |

OpenClaw's gateway model gives you real-time responsiveness, rich plugin composition, and device integration. Aeon trades all of that for **zero ops**. No process to monitor, no server to patch, no port to expose, no Docker container to update. If GitHub Actions is up, Aeon is up. If a skill fails, the next cron tick tries again. The blast radius of any failure is one git commit.

The bet is that for most personal agent use cases — digests, monitoring, research, writing — you don't need sub-second latency. You need reliability, zero maintenance, and the confidence that your agent is running without you thinking about it. That's what the heartbeat loop provides: a process that checks on itself, checks on your world, and only speaks up when something matters.

## Configuration

All scheduling is done in `aeon.yml`. Skills default to `enabled: false` — turn on what you need:

```yaml
skills:
  article:
    enabled: true               # ← flip this to activate
    schedule: "0 8 * * *"       # Daily at 8am UTC
  digest:
    enabled: false              # ← off by default
    schedule: "0 14 * * *"
```

The schedule format is standard cron (`minute hour day-of-month month day-of-week`). All times are UTC. The parser supports `*`, `*/N`, exact values, and comma-separated lists (`1,15` for 1st and 15th of the month).

**Order matters** — the scheduler picks the first matching skill. Day-specific skills (e.g. Monday-only) are listed before daily skills so they get priority on their day. Heartbeat is always last as the fallback.

### Changing the check frequency

The workflow cron (`*/5 * * * *`) controls how often the scheduler checks. You can change this in `.github/workflows/messages.yml`:

```yaml
schedule:
  - cron: '*/5 * * * *'   # Check every 5 min (default)
  - cron: '*/15 * * * *'  # Check every 15 min (saves Actions minutes)
  - cron: '0 * * * *'     # Check hourly (most conservative)
```

The check itself is cheap (~10 seconds of bash) — it only installs Claude Code and calls the API when a skill actually matches.

### GitHub Actions billing

GitHub Actions bills by **minutes used per month**. Only the time a runner is active counts.

| Plan | Free minutes/month | Cost after |
|------|-------------------|------------|
| Free | 2,000 | Not available on free plan for private repos |
| Pro | 3,000 | $0.008/min |
| Team | 3,000 | $0.008/min |

**What costs what:**
- **No skill matched** (most 5-min ticks): ~10 seconds. Checkout + bash parse + exit. At `*/5`, that's ~288 checks/day = ~48 minutes/day.
- **Skill runs**: 2-10 minutes each depending on complexity (Claude thinking + web search + file writes).
- **Heartbeat (hourly)**: ~2 minutes if nothing found, more if it investigates something.

**To reduce usage:**
- Change the cron to `*/15` or `0 *` (hourly) — fewer empty checks
- Disable skills you don't need (`enabled: false`)
- Keep the repo **public** — public repos get unlimited free Actions minutes

## Skills

### Research & Content

| Skill | Description |
|-------|-------------|
| `article` | Research and write a 600-800 word article |
| `digest` | Generate and send a topic digest via notifications |
| `rss-digest` | Fetch and summarize RSS feed highlights |
| `hacker-news-digest` | Top HN stories filtered by your interests |
| `paper-digest` | Find and summarize new papers matching your research topics |
| `tweet-digest` | Aggregate and summarize tweets from tracked accounts |
| `research-brief` | Deep dive on a topic: web search + papers + synthesis |
| `fetch-tweets` | Search X by keyword, user, or hashtag |
| `search-papers` | Academic paper search via Semantic Scholar API |
| `reddit-digest` | Top posts from tracked subreddits |
| `security-digest` | Critical/high-severity security advisories from GitHub Advisory DB |

### Dev & Code

| Skill | Description |
|-------|-------------|
| `pr-review` | Auto-review open PRs and post summary comments |
| `github-monitor` | Watch repos for stale PRs, new issues, and releases |
| `issue-triage` | Label and prioritize new GitHub issues |
| `changelog` | Generate a changelog from recent commits |
| `code-health` | Report on TODOs, dead code, test coverage gaps |
| `feature` | Build features from GitHub issues labeled `ai-build` |
| `build-skill` | Design and create new skills |
| `search-skill` | Search the open agent skills ecosystem via [skills CLI](https://github.com/vercel-labs/skills) |

### Crypto / On-chain

| Skill | Description |
|-------|-------------|
| `token-alert` | Notify on price/volume anomalies for tracked tokens |
| `wallet-digest` | Summarize recent activity across tracked wallets |
| `on-chain-monitor` | Monitor contracts and addresses for notable events |
| `defi-monitor` | Check pool health, positions, and yield rates |

### Productivity

| Skill | Description |
|-------|-------------|
| `morning-brief` | Aggregated daily briefing: priorities, headlines, schedule |
| `weekly-review` | Synthesize the week's logs into a structured retrospective |
| `goal-tracker` | Compare progress against goals in MEMORY.md |
| `idea-capture` | Quick note capture via Telegram → memory |

### Meta / Agent

| Skill | Description |
|-------|-------------|
| `heartbeat` | Core loop — hourly ambient check, surfaces anything needing attention |
| `memory-flush` | Promote important log entries into MEMORY.md |
| `reflect` | Consolidate memory, prune stale entries |
| `skill-health` | Check which scheduled skills haven't run recently |
| `self-review` | Audit what Aeon did, what failed, what to improve |

## Notifications

Aeon fans out notifications to every configured channel. Set the secret and it activates — no code changes needed.

| Channel | Outbound (notifications) | Inbound (messaging) |
|---------|--------------------------|---------------------|
| Telegram | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Same secrets |
| Discord | `DISCORD_WEBHOOK_URL` | `DISCORD_BOT_TOKEN` + `DISCORD_CHANNEL_ID` |
| Slack | `SLACK_WEBHOOK_URL` | `SLACK_BOT_TOKEN` + `SLACK_CHANNEL_ID` |

Each channel is opt-in — set the secret(s) and it activates. No secrets = silently skipped.

**Telegram setup:** Create a bot with [@BotFather](https://t.me/BotFather), get the token + your chat ID.

**Discord setup:** Outbound: Channel settings → Integrations → Webhooks → Create Webhook → copy URL. Inbound: Create a bot at [discord.com/developers](https://discord.com/developers), add to your server, copy bot token + channel ID.

**Slack setup:** Outbound: api.slack.com → Create App → Incoming Webhooks → activate → pick channel → copy URL. Inbound: same app → OAuth & Permissions → add `channels:history`, `reactions:write` scopes → install → copy bot token + channel ID.

## Config files

Config files are created on demand — each skill documents the format it expects in a `## Config` section in its `SKILL.md`. Common ones:

| File | Created by | Purpose |
|------|------------|---------|
| `memory/feeds.yml` | `rss-digest` | RSS/Atom feed URLs |
| `memory/subreddits.yml` | `reddit-digest` | Subreddits to monitor |
| `memory/watched-repos.md` | `github-monitor`, `pr-review`, etc. | GitHub repos to monitor |
| `memory/on-chain-watches.yml` | `on-chain-monitor`, `wallet-digest`, `defi-monitor` | Blockchain addresses/contracts |

None of these files ship with the template — create them when you enable the relevant skill.

## Telegram integration

Send messages to your Telegram bot and Aeon will interpret them — run skills, answer questions, or update memory. Polls every 5 minutes.

**Setup:**
1. Create a bot with [@BotFather](https://t.me/BotFather) on Telegram
2. Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to your repo secrets
3. Send your bot a message like "write an article about quantum computing"

Only messages from your `TELEGRAM_CHAT_ID` are accepted — anyone else is ignored.

By default, Aeon polls Telegram every 5 minutes. This means up to a 5-minute delay before your message is picked up. If that's fine, you're done — no extra setup needed.

### Instant mode (optional)

To get near-instant responses, you can deploy a tiny webhook that triggers Aeon immediately when you send a message. This replaces the 5-minute polling delay with a ~1 second trigger. You still need the polling workflow as a fallback.

The webhook receives messages from Telegram and calls GitHub's `repository_dispatch` API to trigger the workflow instantly. It's ~20 lines of code.

**Option A: Cloudflare Worker (free tier: 100k requests/day)**

1. Create a worker at [workers.cloudflare.com](https://workers.cloudflare.com) with this code:

```js
export default {
  async fetch(request, env) {
    const { message } = await request.json();
    if (!message?.text || String(message.chat.id) !== env.TELEGRAM_CHAT_ID) {
      return new Response("ignored");
    }

    // Confirm receipt so polling doesn't reprocess
    await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${message.update_id + 1}`
    );

    // Trigger GitHub Actions
    await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({
          event_type: "telegram-message",
          client_payload: { message: message.text },
        }),
      }
    );

    return new Response("ok");
  },
};
```

2. Add these environment variables in the Cloudflare dashboard:

| Variable | Value |
|----------|-------|
| `TELEGRAM_BOT_TOKEN` | Your bot token |
| `TELEGRAM_CHAT_ID` | Your chat ID |
| `GITHUB_REPO` | `your-name/aeon` |
| `GITHUB_TOKEN` | A [personal access token](https://github.com/settings/tokens) with `repo` scope |

3. Set your Telegram bot webhook to point to the worker:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-worker.workers.dev"
```

**Option B: Railway / Vercel / any serverless platform**

Same code, different host. Deploy the webhook handler above as a serverless function on whichever platform you prefer. The logic is identical — receive Telegram webhook, call GitHub `repository_dispatch`.

## Trigger feature builds from issues

Add the label `ai-build` to any GitHub issue. The workflow fires automatically and Claude will read the issue, implement it, and open a PR.

## Installing external skills

Use `./add-skill` to import skills from any GitHub repo that follows the [Agent Skills](https://github.com/vercel-labs/skills) format:

```bash
# List available skills in a repo
./add-skill BankrBot/skills --list

# Install specific skills
./add-skill BankrBot/skills bankr hydrex veil

# Install everything from a repo
./add-skill BankrBot/skills --all

# Use a specific branch
./add-skill BankrBot/skills bankr --branch develop
```

Installed skills are copied into `skills/` and auto-registered in `aeon.yml` (disabled by default). Enable them by setting `enabled: true` in `aeon.yml`, or run them on-demand via Telegram or `workflow_dispatch`.

The built-in `search-skill` skill can also discover skills programmatically:

```bash
npx skills find "crypto trading"
npx skills add vercel-labs/agent-skills --list
```

## Adding a new skill

1. Create `skills/your-skill/SKILL.md` with instructions for Claude:

```markdown
---
name: My Skill
description: What this skill does
---

Your task is to...
```

Skills follow the [Agent Skills](https://github.com/vercel-labs/skills) format — compatible with Claude Code, Codex, Cursor, and 37+ agents.

2. Add it to `aeon.yml` with a schedule and enable it:

```yaml
skills:
  your-skill:
    enabled: true
    schedule: "0 12 * * *"   # Daily at noon UTC
```

That's it — no workflow changes needed. On-demand skills don't need a schedule entry — trigger them via Telegram or `workflow_dispatch`.

## Importing your soul

By default, Aeon has no personality — it responds as a generic assistant. To make it think, write, and respond like *you*, import a [soul.md](https://github.com/aaronjmars/soul.md) identity.

Soul.md is a three-file framework that captures who you are — your worldview, opinions, voice, and style — in plain markdown. When Aeon loads these files, it doesn't just know *about* you, it reasons *as* you. Articles sound like you wrote them. Telegram replies match your tone. Digest summaries focus on what you'd actually care about.

### Setup

1. **Fork [soul.md](https://github.com/aaronjmars/soul.md)** and fill in your own files:
   - `SOUL.md` — Identity: who you are, what you believe, your opinions, interests, influences
   - `STYLE.md` — Voice: sentence patterns, vocabulary, punctuation habits, platform-specific tone
   - `examples/good-outputs.md` — 10-20 calibration samples showing your authentic voice

2. **Copy the files into your Aeon repo:**

```bash
# From your Aeon repo
cp /path/to/your-soul/SOUL.md soul/SOUL.md
cp /path/to/your-soul/STYLE.md soul/STYLE.md
cp /path/to/your-soul/examples/good-outputs.md soul/examples.md
```

3. **Reference them in `CLAUDE.md`** — add this to the top of your `CLAUDE.md`:

```markdown
## Identity

Read and internalize the following files before every task:
- `soul/SOUL.md` — your identity, worldview, and opinions
- `soul/STYLE.md` — your voice and communication patterns
- `soul/examples.md` — calibration examples of your authentic voice

Embody this identity in all output — articles, digests, notifications, replies.
Never break character. Never hedge with "as an AI." Reason from the worldview,
not about it.
```

That's it. Every skill that reads `CLAUDE.md` (all of them) will pick up your identity automatically.

### Building your soul from scratch

If you don't have existing content to draw from, soul.md includes a `BUILD.md` with a guided process — it walks you through discovering your identity via interviews, documenting your worldview and opinions, capturing your voice patterns, and curating calibration examples. See the [full guide](https://github.com/aaronjmars/soul.md/blob/main/BUILD.md).

### Quality check

The soul files work when they're **specific enough to be wrong**. "I think most AI safety discourse is galaxy-brained cope" is useful. "I have nuanced views on AI safety" is not. If someone couldn't disagree with a statement in your `SOUL.md`, it's too vague to shape output.

## Running locally

```bash
# Run any skill locally (requires Claude Code CLI)
claude -p "Today is $(date +%Y-%m-%d). Read and execute the skill defined in skills/article/SKILL.md" --dangerously-skip-permissions
```

## Two-repo strategy

This repo is a **public template**. For your own instance, we recommend creating a private copy so your memory, articles, and API keys stay private.

### Setup

1. **Click "Use this template"** → **Create a new repository** → make it **private** (e.g. `your-name/aeon`).
2. Add your secrets to the **private** fork (not the public template).
3. Customize `CLAUDE.md`, `aeon.yml`, `memory/MEMORY.md`, and skill prompts in your private fork.
4. All generated content (articles, digests, memory) stays in your private fork.

### Pulling updates from the template

When the public template gets new skills or workflow improvements:

```bash
# In your private fork
git remote add upstream https://github.com/aaronjmars/aeon.git
git fetch upstream
git merge upstream/main --no-edit
```

This merges template changes without overwriting your personal content, since your articles/memory are in files that don't exist in the template.

## Troubleshooting

### Messages not being picked up

If Aeon isn't responding to your Telegram/Discord/Slack messages, the cron schedule likely hasn't activated yet. GitHub Actions has two requirements for scheduled workflows:

1. **The workflow file must exist on the default branch** — if you're working on a feature branch, the cron in `messages.yml` won't fire until it's merged to `main`.
2. **The repo must have recent activity** — GitHub disables cron schedules on repos with no commits in the last 60 days. More importantly, on **newly created repos from templates, the schedule doesn't start until you manually trigger the workflow at least once**.

**Fix:** Go to **Actions > Messages > Run workflow** and trigger it manually. After that first run, the cron schedule will activate and polling starts automatically.

## Project structure

```
CLAUDE.md                ← agent identity (auto-loaded by Claude Code)
aeon.yml                 ← skill schedules + enabled flags (edit this to configure)
\./notify                ← multi-channel notification (Telegram/Discord/Slack)
skills/                  ← each skill is a directory with SKILL.md (Agent Skills format)
  article/SKILL.md       ← research trending topics, write a 600-800 word article
  digest/SKILL.md        ← search web + X/Twitter, send a topic digest via notifications
  rss-digest/SKILL.md    ← fetch RSS/Atom feeds, summarize new entries
  hacker-news-digest/    ← pull top HN stories, filter by your interests
  paper-digest/          ← query arXiv + Semantic Scholar, summarize new papers
  tweet-digest/          ← aggregate tweets from tracked accounts, group by theme
  fetch-tweets/          ← search X by keyword, user, or hashtag (on-demand)
  search-papers/         ← Semantic Scholar API wrapper (on-demand)
  pr-review/             ← review open PR diffs, post actionable comments
  github-monitor/        ← watch repos for stale PRs, new issues, releases
  feature/               ← read a GitHub issue, implement it, open a PR
  build-skill/           ← design and create new skills from ideas
  token-alert/           ← check CoinGecko for price/volume anomalies
  wallet-digest/         ← summarize balances and transactions across wallets
  on-chain-monitor/      ← poll contracts for events, alert on notable activity
  defi-monitor/          ← check pool TVL, APR, position health, IL
  heartbeat/             ← core loop: scan for anything needing attention
  ...                    ← 32 skills total (see skills/ directory)
memory/
  MEMORY.md              ← index: goals, active topics, pointers to topic files
  topics/                ← detailed notes by topic (crypto.md, research.md, etc.)
  logs/                  ← daily activity logs (YYYY-MM-DD.md)
.github/
  workflows/
    aeon.yml             ← skill runner (workflow_dispatch, issues)
    messages.yml         ← message polling + skill scheduler (cron, repository_dispatch)
```
