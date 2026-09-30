# AIMentionTracker developer tools

Official CLI and MCP server for [AIMentionTracker](https://aimentiontracker.ai) — measure how often ChatGPT, Claude, Gemini, Perplexity and Google's AI surfaces name and cite your brand when buyers ask for recommendations.

| Package | Install |
|---|---|
| [`@aimentiontracker/mcp`](https://www.npmjs.com/package/@aimentiontracker/mcp) | `claude mcp add --transport http aimentiontracker https://mcp.aimentiontracker.ai --header "Authorization: Bearer amt_live_..."` |
| [`@aimentiontracker/cli`](https://www.npmjs.com/package/@aimentiontracker/cli) | `npx @aimentiontracker/cli login --key amt_live_...` |

Create an API key at [app.aimentiontracker.ai/api-keys](https://app.aimentiontracker.ai/api-keys). Full documentation: [aimentiontracker.ai/docs](https://aimentiontracker.ai/docs).

## Three rules if you build on this

1. **A `null` rate means "not enough answers yet", never zero.** Rates ship as `{present, responses, rate, min_sample}` and `rate` is null below the sample floor. Rendering it as 0% reports a collapse in visibility that did not happen.
2. **Engines are never averaged.** They disagree, so a mean describes no real surface. There is deliberately no single score.
3. **An empty alerts list does not mean nothing changed.** A finding is raised only when a move is larger than its own margin of error. `get_me` returns the thresholds in force.

## Why this repo exists separately

The server and the CLI are thin clients. Every rule above is enforced by the API, not here, and the hosted MCP endpoint holds no secrets: your key travels in the `Authorization` header and is passed straight through. That is what makes this source safe to publish while the product stays closed.

MIT.
