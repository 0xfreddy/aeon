<p align="center">
  <img src="assets/aeon.jpg" alt="Aeon" width="120" />
</p>

<h1 align="center">AEON</h1>

<p align="center">
  <strong>Background intelligence that evolves with you.</strong><br>
  Autonomous agent on GitHub Actions, powered by Claude Code. 91 skills across research, dev tooling, crypto monitoring, and productivity — all off by default, enable what you need.
</p>

<p align="center">
  <img src="assets/aeon.gif" alt="Aeon Demo" />
</p>

---

## Why this over OpenClaw?

[OpenClaw](https://github.com/openclaw/openclaw) is great if you need real-time responses and have infra to run it on. Aeon is for everything else:

- **Cheaper** — runs on GitHub Actions, free for public repos, ~$2/mo otherwise. No server.
- **Built for background tasks** — digests, monitoring, research, writing. You don't need sub-second latency for any of that.
- **Doesn't break** — no daemon to crash, no process to restart. If GitHub Actions is up, Aeon is up. Failed skill? Next cron tick retries it.
- **5-minute setup** — fork, add secrets, flip skills on. No Docker, no self-hosting, no config files beyond one YAML.

![OpenClaw vs Aeon](./assets/openclaw.jpg)

---

## Quick start

```bash
git clone https://github.com/aaronjmars/aeon
cd aeon && ./aeon
```

Click on `http://localhost:5555` to open the dashboard in your browser. From there:

1. **Authenticate** — add your Claude API key or OAuth token
2. **Add a channel** — set up [Telegram, Discord, or Slack](#notifications) so Aeon can talk to you (and you can talk back)
3. **Pick skills** — toggle on what you want, set a schedule, and optionally set a `var` to focus each skill
4. **Push** — one click commits and pushes your config to GitHub, Actions takes it from there

You can also schedule and trigger skills by messaging Aeon directly on Telegram — just tell it what you want.

<p align="center">
  <img src="assets/tg.png" alt="Telegram" width="400" />
</p>

---

## Authentication

Set **one** of these — not both:

| Secret | What it is | Billing |
|--------|-----------|---------|
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token from your Claude Pro/Max subscription | Included in plan |
| `ANTHROPIC_API_KEY` | API key from console.anthropic.com | Pay per token |

**Getting an OAuth token:**
```bash
claude setup-token   # opens browser → prints sk-ant-oat01-... (valid 1 year)
```

### Bankr Gateway (optional)

Route requests through [Bankr LLM Gateway](https://docs.bankr.bot/llm-gateway/overview) for ~67% cheaper Opus (via Vertex AI) and access to Gemini, GPT, Kimi, and Qwen models.

1. Get a key at [bankr.bot/api](https://bankr.bot/api) and top up credits
2. Add `BANKR_LLM_KEY` as a repo secret
3. Set `gateway: { provider: bankr }` in `aeon.yml`

---

## Skills

![Skills](./assets/skills.jpg)

| Category | Skills | Highlights |
|----------|--------|------------|
| **Research & Content** | 17 | `deep-research`, `digest`, `paper-pick`, `last30`, `hacker-news-digest`, `reddit-digest` |
| **Dev & Code** | 28 | `pr-review`, `create-skill`, `vuln-scanner`, `auto-merge`, `external-feature`, `deploy-prototype` |
| **Crypto & Markets** | 16 | `token-alert`, `defi-monitor`, `monitor-polymarket`, `monitor-kalshi`, `narrative-tracker` |
| **Social & Writing** | 7 | `write-tweet`, `reply-maker`, `remix-tweets`, `agent-buzz`, `farcaster-digest` |
| **Productivity** | 12 | `morning-brief`, `daily-routine`, `deal-flow`, `goal-tracker`, `action-converter` |
| **Meta / Agent** | 11 | `heartbeat`, `skill-health`, `skill-repair`, `self-improve`, `cost-report` |

Full catalog with descriptions: [`skills.json`](skills.json) — or run `./add-skill aaronjmars/aeon --list`

---

## Use with Claude (MCP)

Aeon's skills are available as tools in Claude Desktop and Claude Code via the MCP server bundled in `mcp-server/`.

```bash
./add-mcp
```

That's it. Every Aeon skill appears as an `aeon-<name>` tool in your Claude interface — no GitHub Actions required. Skills run locally via `claude -p -`, identical to how they run in Actions.

**Example usage in Claude:**

> Use the `aeon-hacker-news-digest` tool to get today's top HN stories

> Run `aeon-deep-research` with `var="AI agent frameworks"` and write a summary

> Use `aeon-token-movers` to get today's top crypto movers

**Options:**

| Flag | Effect |
|------|--------|
| `./add-mcp` | Build and register with Claude Code |
| `./add-mcp --desktop` | Also print Claude Desktop config snippet |
| `./add-mcp --build-only` | Build without registering (CI use) |
| `./add-mcp --uninstall` | Remove the MCP server |

Skills that need API keys (CoinGecko, Alchemy, etc.) read from the same environment variables they use in Actions — set them in your shell or a `.env` file in the repo root. Notification channels (Telegram, Discord, Slack) are optional; if not set, output is returned directly to Claude.

---

## Use with any AI agent (A2A)

Aeon implements [Google's Agent-to-Agent (A2A) protocol](https://google.github.io/A2A/), so any A2A-compliant framework — LangChain, AutoGen, CrewAI, OpenAI Agents SDK, Vertex AI — can invoke skills without needing Claude or MCP.

```bash
./add-a2a                    # starts on port 41241
./add-a2a --port 8080        # custom port
./add-a2a --print-config     # LangChain/Python client examples
```

Discovery: `GET http://localhost:41241/.well-known/agent.json`
Invoke: `POST /` with JSON-RPC (`tasks/send`, `tasks/get`, `tasks/cancel`)
Stream: `POST /tasks/sendSubscribe` for SSE output on long-running skills

---

## Publishing

Aeon publishes articles to a GitHub Pages gallery and an RSS feed.

**GitHub Pages:** Enable in **Settings → Pages** → source `Deploy from a branch`, branch `main`, folder `/docs`. The site lives at `https://<username>.github.io/aeon` with articles, activity logs, and memory. The `update-gallery` skill keeps it in sync.

**RSS:** Subscribe at `https://raw.githubusercontent.com/<owner>/<repo>/main/articles/feed.xml` — works with any RSS reader. Regenerated after each content skill runs.

---

## Quality scoring & self-healing

Every skill output is automatically scored 1–5 by Haiku after each run (failed/empty → 1, excellent → 5). Scores and flags (`api_error`, `stale_data`, `rate_limited`) are tracked per skill in `memory/skill-health/` with a rolling 30-run history.

**Heartbeat** is the only skill enabled by default. Runs 3x daily, checks `memory/cron-state.json` for failed, stuck, or chronically broken skills, stalled PRs, and missed schedules. Nothing to report → logs `HEARTBEAT_OK`. Something needs attention → sends one notification. Listed last in `aeon.yml` so it only fires when no other skill claims the slot.

### Self-healing loop

1. **`heartbeat`** (3x daily) — detects failed, stuck, or chronically broken skills
2. **`skill-health`** — audits quality scores and flags API degradation patterns
3. **`skill-evals`** — assertion-based output quality tests to catch regressions
4. **`skill-repair`** — diagnoses and patches failing skills automatically
5. **`self-improve`** — evolves prompts, config, and workflows based on performance

### Reactive triggers

Skills with `schedule: "reactive"` fire on conditions, not cron. If any skill fails 3x in a row, `skill-repair` auto-fires. The scheduler evaluates triggers after processing cron skills.

```yaml
reactive:
  skill-repair:
    trigger:
      - { on: "*", when: "consecutive_failures >= 3" }
```

### Cost tracking

Every run logs token usage to `memory/token-usage.csv`. The `cost-report` skill generates a weekly breakdown by skill and model.

---

## Configuration

All scheduling lives in `aeon.yml`:

```yaml
skills:
  article:
    enabled: true               # flip to activate
    schedule: "0 8 * * *"       # daily at 8am UTC
  digest:
    enabled: true
    schedule: "0 14 * * *"
    var: "solana"               # topic for this skill
```

Standard cron format. All times UTC. Supports `*`, `*/N`, exact values, comma lists.

**Order matters** — the scheduler picks the first matching skill. Put day-specific skills (e.g. Monday-only) before daily ones. Heartbeat goes last.

### The `var` field

Every skill accepts a single `var` — a universal input that each skill interprets in its own way:

| Skill type | What `var` does | Example |
|-----------|----------------|---------|
| Research & content | Sets the topic | `var: "rust"` → digest about Rust |
| Dev & code | Narrows to a repo | `var: "owner/repo"` → only review that repo's PRs |
| Crypto | Focuses on a token/wallet | `var: "solana"` → only check SOL price |
| Productivity | Sets the focus area | `var: "shipping v2"` → morning brief emphasizes v2 |

If `var` is empty, each skill falls back to its default behavior (scan everything, auto-pick topics, etc.). Set it from the dashboard or pass it when triggering manually.

### Model selection

The default model for all skills is set in `aeon.yml`:

```yaml
model: claude-opus-4-6
```

You can change it from the dashboard header dropdown. Options: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`. Per-run overrides are also available via workflow dispatch.

Individual skills can override the default model to optimize cost:

```yaml
skills:
  token-report: { enabled: true, schedule: "30 12 * * *", model: "claude-sonnet-4-6" }
  skill-evals: { enabled: true, schedule: "0 6 * * 0", model: "claude-sonnet-4-6" }
```

### Skill Chaining

Skills can be chained together so outputs flow between them. Chains run as separate GitHub Actions workflow steps via `chain-runner.yml`.

```yaml
chains:
  morning-pipeline:
    schedule: "0 7 * * *"
    on_error: fail-fast       # or: continue
    steps:
      - parallel: [token-movers, hacker-news-digest]  # run concurrently
      - skill: morning-brief                         # runs after parallel group
        consume: [token-movers, hacker-news-digest]  # gets their outputs injected
```

How it works:
1. Each step runs as a separate workflow dispatch
2. After each skill completes, its output is saved to `.outputs/{skill}.md`
3. Downstream steps with `consume:` get prior outputs injected into context
4. Steps can run in parallel or sequentially
5. `on_error: fail-fast` aborts the chain on any failure; `continue` keeps going

Define chains in `aeon.yml` alongside your skills. The scheduler dispatches them on their own cron schedule.

---

### Instance Fleet

Aeon can spawn and manage copies of itself via `spawn-instance`, `fleet-control`, and `fork-fleet`. Use this to run specialized instances — one for crypto monitoring, another for research, etc.

Spawn with `var: "crypto-tracker: monitor DeFi protocols and token movements"`. The skill forks the repo, selects relevant skills, and registers it in `memory/instances.json`. No secrets are propagated — the new owner adds their own keys.

---

### Changing check frequency

Edit `.github/workflows/messages.yml`:

```yaml
schedule:
  - cron: '*/5 * * * *'    # every 5 min (default)
  - cron: '*/15 * * * *'   # every 15 min (saves Actions minutes)
  - cron: '0 * * * *'      # hourly (most conservative)
```

Claude only installs and runs when a skill actually matches.

---

## GitHub Actions cost

| Scenario | Cost |
|----------|------|
| No skill matched (most ticks) | ~10s — checkout + bash + exit |
| Skill runs | 2–10 min depending on complexity |
| Heartbeat (nothing found) | ~2 min |
| **Public repo** | **Unlimited free minutes** |

To reduce usage: switch to `*/15` or hourly cron, disable unused skills, keep the repo public.

| Plan | Free minutes/mo | Overage |
|------|----------------|---------|
| Free | 2,000 | N/A (private only) |
| Pro / Team | 3,000 | $0.008/min |

---

## Notifications

Set the secret → channel activates. No code changes needed.

| Channel | Outbound | Inbound |
|---------|---------|---------|
| Telegram | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Same |
| Discord | `DISCORD_WEBHOOK_URL` | `DISCORD_BOT_TOKEN` + `DISCORD_CHANNEL_ID` |
| Slack | `SLACK_WEBHOOK_URL` | `SLACK_BOT_TOKEN` + `SLACK_CHANNEL_ID` |
| Email | `SENDGRID_API_KEY` + `NOTIFY_EMAIL_TO` | — |

**Telegram:** Create a bot with @BotFather → get token + chat ID.  
**Discord:** Outbound: Channel → Integrations → Webhooks → Create. Inbound: discord.com/developers → bot → add `channels:history` scope → copy token + channel ID.  
**Slack:** api.slack.com → Create App → Incoming Webhooks → install → copy URL. Inbound: add `channels:history`, `reactions:write` scopes → copy bot token + channel ID.  
**Email:** sendgrid.com/settings/api_keys → Create API Key (Mail Send permission) → add as `SENDGRID_API_KEY`. Set `NOTIFY_EMAIL_TO` to your recipient address. Optional: set repository variable `NOTIFY_EMAIL_FROM` (default: `aeon@notifications.aeon.bot`) and `NOTIFY_EMAIL_SUBJECT_PREFIX` (default: `[Aeon]`).

### Telegram instant mode (optional)

Default polling has up to 5-min delay. Deploy a ~20-line Cloudflare Worker as a webhook for ~1s response time. See [`docs/telegram-instant.md`](docs/telegram-instant.md) for the Worker code and setup.

---

## Cross-repo access

The built-in `GITHUB_TOKEN` is scoped to this repo only. For `github-monitor`, `pr-review`, `issue-triage`, and `external-feature` to work on your other repos, add a `GH_GLOBAL` personal access token.

| | `GITHUB_TOKEN` | `GH_GLOBAL` |
|--|--------------|------------|
| Scope | This repo | Any repo you grant |
| Created by | GitHub (automatic) | You (manual) |
| Lifetime | Job duration | Up to 1 year |

**Setup:** github.com/settings/tokens → Fine-grained → set repo access → grant Contents, Pull requests, Issues (all read/write) → add as `GH_GLOBAL` secret.

Skills use `GH_GLOBAL` when available, fall back to `GITHUB_TOKEN` automatically.

---

## Adding skills

### Install external skills

```bash
./add-skill BankrBot/skills --list          # browse a repo's skills
./add-skill BankrBot/skills bankr hydrex   # install specific skills
./add-skill BankrBot/skills --all           # install everything
```

Installed skills land in `skills/` and are added to `aeon.yml` disabled. Flip `enabled: true` to activate.

### Install from Aeon's catalog

Every skill is independently installable. Browse the catalog in [`skills.json`](skills.json) or:

```bash
./add-skill aaronjmars/aeon --list                                       # browse
./add-skill aaronjmars/aeon token-alert monitor-polymarket                # install specific
./add-skill aaronjmars/aeon --all                                         # install everything
```

### Export a skill

```bash
./export-skill token-alert              # exports to ./exports/token-alert/
```

### Trigger feature builds from issues

Label any GitHub issue `ai-build` → workflow fires → Claude reads the issue, implements it, opens a PR.

---

## Use as GitHub Agentic Workflow

Don't need the full agent? Grab individual workflow templates and drop them into any repo. These work with [GitHub Agentic Workflows](https://github.blog/changelog/2026-02-13-github-agentic-workflows-are-now-in-technical-preview/) — plain Markdown files in `.github/workflows/` that run with any supported agent engine.

| Template | What it does | Trigger |
|----------|-------------|---------|
| [issue-triage.md](workflows/issue-triage.md) | Auto-label and prioritize new issues | On issue opened |
| [pr-review.md](workflows/pr-review.md) | Review PRs for bugs, security, and quality | On PR opened/updated |
| [changelog.md](workflows/changelog.md) | Categorized changelog from recent commits | Weekly |
| [security-digest.md](workflows/security-digest.md) | Monitor advisories for your dependencies | Daily |
| [code-health.md](workflows/code-health.md) | Audit TODOs, dead code, test gaps | Weekly |

```bash
# Copy a template into your repo
curl -O https://raw.githubusercontent.com/aaronjmars/aeon/main/workflows/pr-review.md
mv pr-review.md .github/workflows/
git add .github/workflows/pr-review.md && git commit -m "Add PR review workflow"
```

Each template is self-contained Markdown — edit the trigger, criteria, or format to fit your project. See [`workflows/README.md`](workflows/README.md) for details.

---

## Soul (optional)

By default Aeon has no personality. To make it write and respond like you, add a soul:

1. Fork [soul.md](https://github.com/aaronjmars/soul.md) and fill in your files:
   - `SOUL.md` — identity, worldview, opinions, interests
   - `STYLE.md` — voice, sentence patterns, vocabulary, tone
   - `examples/good-outputs.md` — 10–20 calibration samples
2. Copy into your Aeon repo under `soul/`
3. Add to the top of `CLAUDE.md`:

```markdown
## Identity

Read and internalize before every task:
- `soul/SOUL.md` — identity and worldview
- `soul/STYLE.md` — voice and communication patterns
- `soul/examples.md` — calibration examples

Embody this identity in all output. Never hedge with "as an AI."
```

Every skill reads `CLAUDE.md`, so identity propagates automatically.

**Quality check:** soul files work when they're specific enough to be wrong. *"I think most AI safety discourse is galaxy-brained cope"* is useful. *"I have nuanced views on AI safety"* is not.

---

## Project structure

```
CLAUDE.md                ← agent identity (auto-loaded by Claude Code)
aeon.yml                 ← skill schedules, chains, reactive triggers, and enabled flags
skills.json              ← machine-readable skill catalog (91 skills)
./aeon                   ← launch the local dashboard (Next.js on port 5555)
./notify                 ← multi-channel notifications (Telegram, Discord, Slack, Email, json-render)
./notify-jsonrender      ← convert skill output to dashboard feed cards via Haiku
./add-skill              ← import skills from GitHub repos (with security scanning)
./add-mcp                ← register Aeon as an MCP server for Claude Desktop/Code
./add-a2a                ← start the A2A protocol gateway for external agents
./export-skill           ← package skills for standalone distribution
./generate-skills-json   ← regenerate skills.json from SKILL.md files
docs/                    ← GitHub Pages site (articles, activity log, memory)
soul/                    ← optional identity files (SOUL.md, STYLE.md, examples/, data/)
skills/                  ← each skill is a SKILL.md prompt file
  article/
  digest/
  heartbeat/
  ...                    ← 91 skills total
workflows/               ← GitHub Agentic Workflow templates (.md)
mcp-server/              ← MCP server — exposes skills as Claude tools
a2a-server/              ← A2A protocol gateway — exposes skills to any agent framework
dashboard/               ← local web UI (Next.js + json-render feed)
memory/
  MEMORY.md              ← goals, active topics, pointers
  cron-state.json        ← per-skill execution metrics (status, success rate, quality)
  skill-health/          ← rolling quality scores per skill (last 30 runs)
  token-usage.csv        ← token cost tracking per run
  issues/                ← structured issue tracker for skill failures
  topics/                ← detailed notes by topic
  logs/                  ← daily activity logs (YYYY-MM-DD.md)
.outputs/                ← skill chain outputs (passed between chained steps)
scripts/
  prefetch-xai.sh        ← pre-fetch X/Grok API data outside sandbox
  postprocess-replicate.sh ← generate images via Replicate after Claude runs
  skill-runs             ← audit recent GitHub Actions skill runs
  sync-site-data.sh      ← sync memory/logs to docs site data
.github/workflows/
  aeon.yml               ← skill runner (workflow_dispatch, issues, quality scoring)
  chain-runner.yml       ← skill chain executor (parallel + sequential pipelines)
  messages.yml           ← cron scheduler + message polling (Telegram/Discord/Slack)
```

---

## Two-repo strategy

This repo is a public template. Run your own instance as a **private fork** so memory, articles, and API keys stay private.

```bash
# Pull template updates into your private fork
git remote add upstream https://github.com/aaronjmars/aeon.git
git fetch upstream
git merge upstream/main --no-edit
```

Your `memory/`, `articles/`, and personal config won't conflict — they're in files that don't exist in the template.

---

## Troubleshooting

**Messages not being picked up?**

GitHub has two requirements for scheduled workflows:
1. The workflow file must be on the **default branch** — crons on feature branches don't fire.
2. The repo must have **recent activity** — GitHub disables crons on repos with no commits in 60 days. New template forks need one manual trigger to activate.

**Fix:** Actions → Messages → Run workflow (manual trigger). After that, the cron activates automatically.

---

Support the project : 0xbf8e8f0e8866a7052f948c16508644347c57aba3
