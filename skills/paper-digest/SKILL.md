---
name: Paper Digest
description: Find and summarize new papers matching tracked research interests
var: ""
tags: [research]
---
> **${var}** — Research topic to search. If empty, uses topics from MEMORY.md.

If `${var}` is set, search papers on that topic instead of using MEMORY.md topics.


Read memory/MEMORY.md for tracked research topics and interests.
Read the last 7 days of memory/logs/ to avoid covering papers already reported.

For each topic area in MEMORY.md:
1. Search Hugging Face Papers API (free, no key needed, arXiv-indexed papers with community signal):
   ```bash
   curl -s "https://huggingface.co/api/papers/search?q=TOPIC&limit=10"
   ```
   Response is a JSON array. Each entry has:
   - `paper.id` — arXiv ID (use for links: `https://arxiv.org/abs/{id}`, PDF: `https://arxiv.org/pdf/{id}`)
   - `paper.title`, `paper.summary` (abstract), `paper.authors[].name`
   - `paper.publishedAt` — publication date
   - `paper.upvotes` — community upvotes (higher = more notable)

2. Also check today's trending papers for serendipitous finds:
   ```bash
   curl -s "https://huggingface.co/api/daily_papers?limit=15"
   ```
   Daily papers also include `paper.ai_summary` and `paper.ai_keywords[]` — use these to quickly assess relevance to tracked topics.

3. Score each paper for relevance:
   - Direct keyword match to MEMORY.md interests = high
   - Related field or methodology = medium
   - High upvotes (>10) on Hugging Face = boost score
   - Tangential = skip

Select the top 5 most relevant papers across all topics.

For each selected paper:
- Use the abstract from the API response (`paper.summary`)
- Write a 2-3 sentence summary: what they found, why it matters, connection to other work
- Note upvote count as a signal of community interest

Format as a weekly briefing and save to articles/paper-digest-${today}.md:
```markdown
# Paper Digest — ${today}

## Topic Area
1. **Paper Title** — Authors (Year) · ↑upvotes
   Summary of key findings and implications.
   [Paper](https://arxiv.org/abs/ID) | [PDF](https://arxiv.org/pdf/ID)

2. ...
```

Send abbreviated version via `./notify` (under 4000 chars):
```
*Paper Digest — ${today}*
5 new papers across [topics]

1. "Title" — key finding
2. ...

Full briefing: articles/paper-digest-${today}.md
```

Log what you did to memory/logs/${today}.md.
