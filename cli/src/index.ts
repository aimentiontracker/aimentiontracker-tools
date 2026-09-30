#!/usr/bin/env node
/**
 * amt — the AIMentionTracker CLI.
 *
 * TWO RULES THIS FILE EXISTS TO ENFORCE, because they are the difference
 * between a report and a fabrication:
 *
 *   1. A null rate is NOT zero. It means the sample is below the floor. The
 *      human formatter prints the fraction ("3 of 4") and the JSON passes the
 *      null through untouched. Nothing here ever coerces it to 0.
 *   2. Engines are never averaged. There is no --summary flag and no overall
 *      score, because the engines disagree and a mean describes no real
 *      surface.
 *
 * JSON WHEN PIPED, TABLES WHEN WATCHED. A human at a terminal wants columns; a
 * script wants parseable output and must not have to pass a flag to get it.
 * `--json` forces it either way.
 */
import { Client, ApiError, VERSION, DEFAULT_BASE } from "./client.js"
import { resolve, writeConfig, clearConfig, readConfig, CONFIG_PATH } from "./config.js"
import type {
  Me, Brand, Visibility, Source, Answer, Alert,
} from "./types.js"

const argv = process.argv.slice(2)
const flags = new Map<string, string>()
const positional: string[] = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]!
  if (a.startsWith("--")) {
    const eq = a.indexOf("=")
    if (eq > -1) flags.set(a.slice(2, eq), a.slice(eq + 1))
    else if (argv[i + 1] && !argv[i + 1]!.startsWith("--")) flags.set(a.slice(2), argv[++i]!)
    else flags.set(a.slice(2), "true")
  } else positional.push(a)
}

const wantsJson = flags.has("json") || !process.stdout.isTTY

/**
 * `--version` and `--help` are FLAGS, not positionals.
 *
 * Caught by running it: the switch below had `case "--version"`, which was
 * unreachable, because anything starting with `--` goes into `flags` and never
 * into `positional`. `amt --version` printed the entire help text. Resolving
 * them to a command here means both spellings work and the switch stays the
 * one place a command is handled.
 */
// Short forms are single-dash, so the `--` parser above leaves them in
// `positional`. Mapped here rather than taught to the parser: `-h` and `-v`
// are the only two, and a general short-flag parser would be more machinery
// than this CLI has flags to justify.
const SHORT: Record<string, string> = { "-h": "help", "-v": "version" }
const command =
  flags.has("version") ? "version"
  : flags.has("help") ? "help"
  : SHORT[positional[0] ?? ""] ?? positional[0] ?? "help"

function out(human: () => void, json: unknown): void {
  if (wantsJson) process.stdout.write(JSON.stringify(json, null, 2) + "\n")
  else human()
}

/** Errors are JSON on stderr with a non-zero exit, always. A script that pipes
 *  us must be able to read the failure, not just see an empty stdout. */
function die(code: string, message: string, extra: Record<string, unknown> = {}): never {
  process.stderr.write(JSON.stringify({ error: { code, message, ...extra } }) + "\n")
  process.exit(1)
}

/**
 * THE RULE, in one function.
 *
 * `rate` is null below the sample floor. Printing "0%" there would report a
 * collapse in visibility that did not happen, which is the single most
 * damaging thing this tool could do. Below the floor it shows the fraction and
 * says so.
 */
function fmtRate(r: { present: number; responses: number; rate: number | null; min_sample: number }): string {
  if (r.responses === 0) return "no answers yet"
  if (r.rate === null) return `${r.present} of ${r.responses} (below ${r.min_sample}, no % yet)`
  return `${(r.rate * 100).toFixed(1)}%  (${r.present} of ${r.responses})`
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length)
}

function client() {
  const r = resolve()
  if (!r.key) {
    die(
      "not_authenticated",
      "No API key. Run `amt login --key amt_live_...`, or set AMT_API_KEY. Create a key at https://app.aimentiontracker.ai/api-keys"
    )
  }
  return { api: new Client({ key: r.key, baseUrl: r.baseUrl }), brand: flags.get("brand") ?? r.brand }
}

const HELP = `amt ${VERSION} — how often AI assistants name and cite your brand

  amt login --key amt_live_...   Save a key to ${CONFIG_PATH} (0600)
  amt logout                     Remove it
  amt whoami                     Who this key is, plan, quota, reporting rules

  amt brands                     Brands this key can read, and their ids
  amt visibility [--days 7]      Presence per engine and per brand
  amt answers [--limit 50]       Stored answers with mentions and citations
  amt sources [--days 30]        Domains the engines read before answering
  amt alerts [--limit 50]        Findings, newest first
  amt export [--days 30]         Every answer as JSON, auto-paginated

Options
  --brand <id>    Required when your organisation has more than one brand.
                  \`amt brands\` lists the ids. Set a default with AMT_BRAND.
  --json          Force JSON. Already the default when stdout is not a terminal.
  --days N        Trailing window, where the command takes one.
  --engine <slug> Filter answers to one engine.

Environment
  AMT_API_KEY     Takes precedence over the saved config, always.
  AMT_BASE_URL    Override the API base (default ${DEFAULT_BASE}).
  AMT_BRAND       Default brand id.

Two rules worth knowing before you build on this:
  - A null rate means NOT ENOUGH ANSWERS YET, never zero.
  - Engines are reported separately and never averaged. There is no
    single score, on purpose: the engines disagree.
`

async function main(): Promise<void> {
  switch (command) {
    case "help":
      process.stdout.write(HELP)
      return

    case "version":
      out(() => console.log(VERSION), { version: VERSION })
      return

    case "login": {
      const key = flags.get("key")
      if (!key) die("missing_key", "Pass --key amt_live_... Create one at https://app.aimentiontracker.ai/api-keys")
      if (!key.startsWith("amt_live_")) {
        die("bad_key", "That does not look like an AIMentionTracker key — they start with amt_live_.")
      }
      // Verify BEFORE saving. Writing an unverified key to disk means the
      // first real command fails with a confusing 401 long after the mistake.
      const api = new Client({ key, baseUrl: flags.get("base") ?? process.env.AMT_BASE_URL })
      const me = await api.get<{ organization: { name: string | null } }>("/me")
      writeConfig({ ...readConfig(), key, baseUrl: flags.get("base") ?? readConfig().baseUrl })
      out(
        () => console.log(`Signed in to ${me.data.organization.name ?? "your organisation"}. Key saved to ${CONFIG_PATH}`),
        { ok: true, organization: me.data.organization.name, config: CONFIG_PATH }
      )
      return
    }

    case "logout":
      clearConfig()
      out(() => console.log("Key removed."), { ok: true })
      return

    case "whoami": {
      const { api } = client()
      const r = await api.get<Me>("/me")
      out(() => {
        const d = r.data
        console.log(`Organisation  ${d.organization?.name ?? "-"}`)
        console.log(`Plan          ${d.plan?.name} (${d.plan?.status})`)
        console.log(`Prompts       ${d.plan?.prompts?.used} of ${d.plan?.prompts?.included}`)
        console.log(`Brand         ${d.brand?.name} (${d.brand?.id})`)
        console.log(`Rate limit    ${d.rate_limit?.remaining} of ${d.rate_limit?.per_minute} left this minute`)
        console.log("")
        console.log("Reporting rules")
        console.log(`  min_sample          ${d.reporting_rules?.min_sample} — below this, rate is null, which means NOT ENOUGH DATA, not zero`)
        console.log(`  engines averaged    ${d.reporting_rules?.engines_averaged}`)
        console.log(`  alerts enabled      ${d.reporting_rules?.alerts?.enabled}`)
        console.log(`  alert threshold     ${d.reporting_rules?.alerts?.min_delta_points} points, ${d.reporting_rules?.alerts?.min_sample_each_side} answers each side`)
        console.log(`  empty alert list    ${d.reporting_rules?.alerts?.empty_list_means}`)
      }, r)
      return
    }

    case "brands": {
      const { api } = client()
      const r = await api.get<Brand[]>("/brands")
      out(() => {
        if (r.data.length === 0) return console.log("No brands set up yet.")
        console.log(pad("ID", 20) + pad("NAME", 26) + pad("PROMPTS", 9) + "LAST COLLECTED")
        for (const b of r.data) {
          console.log(
            pad(b.id, 20) + pad(b.name, 26) + pad(String(b.active_prompts), 9) +
            (b.last_collected_at ? String(b.last_collected_at).slice(0, 16) : "never") +
            (b.configured ? "" : "   (setup unfinished)")
          )
        }
      }, r)
      return
    }

    case "visibility": {
      const { api, brand } = client()
      const r = await api.get<Visibility>("/visibility", { days: flags.get("days"), brand })
      out(() => {
        console.log(`Brand: ${r.meta.brand?.name}   Window: ${r.meta.window_days} days\n`)
        console.log("PER ENGINE (never averaged — they disagree)")
        for (const e of r.data.engines ?? []) {
          console.log(`  ${pad(e.name, 22)} ${fmtRate(e)}`)
        }
        console.log("\nPER BRAND")
        for (const b of r.data.brands ?? []) {
          console.log(`  ${pad(b.name + (b.role === "self" ? " (you)" : ""), 22)} ${fmtRate(b)}`)
        }
      }, r)
      return
    }

    case "sources": {
      const { api, brand } = client()
      const r = await api.get<Source[]>("/sources", { days: flags.get("days"), brand })
      out(() => {
        console.log(pad("DOMAIN", 34) + pad("CITED ON", 10) + pad("NAMED YOU", 11) + "GAP")
        for (const s of r.data) {
          console.log(
            pad(s.domain, 34) + pad(String(s.answers_citing_it), 10) +
            pad(String(s.answers_where_you_were_named), 11) +
            String(s.answers_citing_you_without_naming_you)
          )
        }
        console.log("\nGAP = answers that cited this domain and did NOT name you. That is the work.")
      }, r)
      return
    }

    case "alerts": {
      const { api, brand } = client()
      const r = await api.get<Alert[]>("/alerts", { limit: flags.get("limit"), brand })
      out(() => {
        if (r.data.length === 0) {
          // NOT "nothing changed". Saying that would be the single most
          // misleading sentence this tool could print.
          console.log("No findings.")
          console.log("This does NOT mean nothing changed: a move is only reported when it is")
          console.log("larger than its own margin of error at your sample size. Run `amt whoami`")
          console.log("to see the thresholds in force.")
          return
        }
        for (const a of r.data) {
          console.log(`${String(a.created_at).slice(0, 10)}  [${a.kind}] ${a.title}`)
          if (a.detail) console.log(`            ${a.detail}`)
        }
      }, r)
      return
    }

    case "answers": {
      const { api, brand } = client()
      const r = await api.get<Answer[]>("/answers", {
        limit: flags.get("limit"), engine: flags.get("engine"), brand,
      })
      out(() => {
        for (const a of r.data) {
          const named = (a.mentions ?? []).filter((m) => m.mentioned).map((m) => m.brand)
          console.log(`${a.id}  ${pad(a.engine, 20)} ${String(a.collected_at).slice(0, 16)}`)
          console.log(`  prompt: ${a.prompt}`)
          console.log(`  named:  ${named.length ? named.join(", ") : "(nobody)"}${a.outcome === "empty" ? "   [engine answered and named nobody]" : ""}`)
        }
        if (r.meta.next_cursor) console.log(`\nMore: amt answers --cursor ${r.meta.next_cursor}`)
      }, r)
      return
    }

    case "export": {
      const { api, brand } = client()
      // Always JSON: this is a pipe target by definition. Streams an array so
      // a large export does not have to be held in memory all at once.
      const all: unknown[] = []
      for await (const page of api.paginate<Answer>("/answers", { limit: 200, brand })) {
        all.push(...page.items)
        if (process.stdout.isTTY) process.stderr.write(`\r  ${all.length} answers…`)
      }
      if (process.stdout.isTTY) process.stderr.write("\r")
      process.stdout.write(JSON.stringify(all, null, 2) + "\n")
      return
    }

    default:
      die("unknown_command", `Unknown command "${command}". Run \`amt help\`.`)
  }
}

main().catch((err) => {
  if (err instanceof ApiError) {
    // The two a user can actually act on get a sentence saying how.
    const hint =
      err.code === "brand_required"
        ? " Run `amt brands` for the ids, then pass --brand."
        : err.code === "not_authenticated" || err.status === 401
          ? " Run `amt login --key amt_live_...`."
          : err.code === "rate_limited" && err.retryAfter
            ? ` Retry in ${err.retryAfter}s.`
            : ""
    die(err.code, err.message + hint, { status: err.status })
  }
  die("unexpected", err instanceof Error ? err.message : String(err))
})
