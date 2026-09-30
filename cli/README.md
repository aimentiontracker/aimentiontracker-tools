# @aimentiontracker/cli

How often do ChatGPT, Claude, Gemini, Perplexity and Google's AI surfaces name your brand when buyers ask for recommendations? This reads it from the terminal.

```bash
npx @aimentiontracker/cli login --key amt_live_...
npx @aimentiontracker/cli visibility --days 30
```

Create a key at [app.aimentiontracker.ai/api-keys](https://app.aimentiontracker.ai/api-keys).

## Commands

```
amt whoami                     Key, plan, quota, and the reporting thresholds
amt brands                     Brands this key can read, and their ids
amt visibility [--days 7]      Presence per engine and per brand
amt answers [--limit 50]       Stored answers with mentions and citations
amt sources [--days 30]        Domains the engines read before answering
amt alerts [--limit 50]        Findings, newest first
amt export                     Every answer as JSON, auto-paginated
```

`--brand <id>` is required when your organisation has more than one brand. `--json` forces JSON, which is already the default when stdout is not a terminal.

## Environment

| Variable | Meaning |
|---|---|
| `AMT_API_KEY` | Takes precedence over the saved config, always. Use this in CI. |
| `AMT_BRAND` | Default brand id. |
| `AMT_BASE_URL` | Override the API base. |

The saved config lives at `~/.aimentiontracker/config.json`, mode 0600.

## Three rules

1. **A null rate means "not enough answers yet", never zero.** Below the sample floor the CLI prints the fraction, because quoting a percentage off four answers is false precision.
2. **Engines are never averaged.** They disagree, so a mean describes no real surface. There is no `--summary` flag on purpose.
3. **An empty alerts list does not mean nothing changed.** It means no move was large enough to distinguish from noise at your sample size.

Zero runtime dependencies. A CLI run with `npx` is a supply-chain surface, and Node 20 has everything this needs.

MIT.
