---
name: aimentiontracker
description: Measure how often AI assistants (ChatGPT, Claude, Gemini, Perplexity, Google AI Overviews and AI Mode) name and cite a brand when buyers ask for recommendations. Use when the user asks about their AI visibility, share of voice in AI answers, which sources AI engines cite, why a competitor is being recommended instead of them, or wants to export the stored answers.
---

# AIMentionTracker

Read a brand's visibility inside AI assistant answers through the `amt` CLI. Every command prints JSON when its output is piped.

**If AIMentionTracker MCP tools are available in this session, prefer them over the CLI** — they need no local install and no key handling. The workflow and the rules below are identical either way; `get_me` maps to `whoami`, `get_visibility` to `visibility`, `list_sources` to `sources`, and so on. Fall back to the CLI when the tools are absent, or when the user wants it run in a terminal or in CI.

## Setup (once)

```bash
export AMT_API_KEY=amt_live_...     # from app.aimentiontracker.ai/api-keys
# or
npx @aimentiontracker/cli login --key amt_live_...
```

Run commands with `npx @aimentiontracker/cli <command>` (or `amt <command>` if installed).

## Always start here

1. `amt whoami` — confirms the key works, shows the plan, and prints the reporting rules in force.
2. `amt brands` — lists the brands and their ids. **If there is more than one you must pass `--brand <id>` on every other command.** Omitting it is an error, not a default.

## THREE RULES YOU MUST NOT BREAK

These are not style preferences. Breaking them produces a confidently wrong report in the customer's name.

**1. A null rate means "not enough answers yet". It is NOT zero.**
Rates come back as `{present, responses, rate, min_sample}`. When `rate` is `null`, the sample is below the floor. Say "3 of 4 answers, too few to quote a percentage". Never render it as 0%, and never let it into an average. Reporting "0% visibility" for a brand that was named in 3 of 4 answers is the single most damaging thing you can do with this data.

**2. Never average the engines.**
There is no single visibility score and you must not compute one. ChatGPT, Perplexity and Google AI Overviews are different surfaces that disagree, so a mean describes nothing real. Report per engine. If the user insists on one number, give them the pooled counts (`present` and `responses` summed) and say plainly what you did.

**3. An empty alerts list does NOT mean nothing changed.**
A finding is raised only when both comparison windows carry enough answers AND the move is larger than its own margin of error. On a small plan that excludes most real movement. Say "no change large enough to distinguish from noise at this sample size". `amt whoami` shows the thresholds.

Also: failed collections are excluded from denominators rather than counted as absence, so our outages never read as the customer's absence. And `outcome: "empty"` on an answer is a real observation — the engine answered and named nobody — not a failure to collect.

## Commands

| Command | What it answers |
|---|---|
| `amt whoami` | Does this key work, what plan, what are the reporting thresholds |
| `amt brands` | Which brands can I read, and what are their ids |
| `amt visibility --days 30` | How often did each engine name us, and our competitors |
| `amt sources --days 30` | Which sites do the engines read before answering |
| `amt answers --limit 20 --engine chatgpt` | The actual stored answers, with mentions and citations |
| `amt alerts` | What changed enough to be worth acting on |
| `amt export` | Every answer as a JSON array, auto-paginated |

## A good analysis

1. `amt whoami`, then `amt brands`.
2. `amt visibility --days 30` — report **per engine**, each with its denominator.
3. `amt sources --days 30` — the `answers_citing_you_without_naming_you` column is the actionable one. A domain read on nine answers that named a competitor every time is a specific page to go and be on.
4. `amt answers --engine <the weakest engine>` — quote the real sentences. This is the evidence, and it is what makes the numbers credible.
5. Only then recommend. Ground every recommendation in a source or an answer you actually read.

## Errors

Errors print `{"error":{"code":"...","message":"..."}}` on **stderr** with exit code 1.

- `brand_required` — the organisation has several brands. Run `amt brands` and pass `--brand`.
- `not_authenticated` / 401 — no key, or it was revoked. `amt login --key ...`.
- `no_subscription` — the organisation has never had a plan.
- `rate_limited` — 300/min. The message says how long to wait.
