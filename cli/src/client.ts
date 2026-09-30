/**
 * The v1 client. Zero runtime dependencies, on purpose.
 *
 * A CLI people install with npx is a supply-chain surface: every dependency is
 * a package that can be compromised between their `npx` and our code running
 * with their API key in the environment. Node 20 has fetch, so there is
 * nothing here worth taking a dependency for.
 */

export const VERSION = "0.1.0"
export const DEFAULT_BASE = "https://app.aimentiontracker.ai/api/v1"

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Seconds to wait, when the server told us. */
    readonly retryAfter?: number
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export interface Envelope<T> {
  data: T
  meta: Record<string, unknown> & {
    generated_at?: string
    brand?: { id: string; name: string }
    next_cursor?: string | null
    note?: string
  }
}

export interface ClientOptions {
  key: string
  baseUrl?: string
  /** Identifies CLI traffic in our logs, so it can be told from the dashboard. */
  userAgent?: string
}

export class Client {
  private readonly key: string
  private readonly base: string
  private readonly ua: string

  constructor(opts: ClientOptions) {
    this.key = opts.key
    this.base = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, "")
    this.ua = opts.userAgent ?? `amt-cli/${VERSION}`
  }

  async get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<Envelope<T>> {
    const url = new URL(this.base + path)
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v))
    }

    const res = await fetch(url, {
      headers: { "x-api-key": this.key, "user-agent": this.ua, accept: "application/json" },
    })

    if (!res.ok) {
      // The API always returns {error:{code,message}}. Parse defensively
      // anyway: a proxy or an outage can put HTML in front of us, and
      // "Unexpected token < in JSON" is a useless thing to show somebody.
      let code = `http_${res.status}`
      let message = `Request failed with ${res.status}`
      try {
        const body = (await res.json()) as { error?: { code?: string; message?: string } }
        if (body?.error?.code) code = body.error.code
        if (body?.error?.message) message = body.error.message
      } catch {
        message = `Request failed with ${res.status} and a non-JSON body. Is ${this.base} right?`
      }
      const retry = Number(res.headers.get("retry-after"))
      throw new ApiError(res.status, code, message, Number.isFinite(retry) ? retry : undefined)
    }

    return (await res.json()) as Envelope<T>
  }

  /**
   * Walk every page of a keyset-paginated endpoint.
   *
   * THE PAGE CAP IS NOT PARANOIA. `next_cursor` comes from the server, and a
   * loop that trusts it without a ceiling is one server bug away from running
   * until it fills a disk. The cap is high enough that no real account reaches
   * it and low enough to notice.
   */
  async *paginate<T>(
    path: string,
    params: Record<string, string | number | undefined> = {},
    maxPages = 500
  ): AsyncGenerator<{ items: T[]; meta: Envelope<T[]>["meta"] }> {
    let cursor: string | undefined
    for (let page = 0; page < maxPages; page++) {
      const res = await this.get<T[]>(path, { ...params, cursor })
      yield { items: res.data, meta: res.meta }
      const next = res.meta.next_cursor
      if (!next || typeof next !== "string" || res.data.length === 0) return
      cursor = next
    }
    throw new Error(
      `Stopped after ${maxPages} pages. That is far more than any real account holds, so this is almost certainly a bug on our side — please report it.`
    )
  }
}
