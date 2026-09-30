/**
 * The response shapes the CLI actually reads.
 *
 * WHY THESE EXIST RATHER THAN `Record<string, any>`: I reached for `any` here
 * because the CLI only formats a few fields and the full shapes live in the
 * API's OpenAPI schemas. That was laziness, and CI was right to reject it —
 * `any` on a response means a renamed field becomes `undefined` printed as
 * "undefined" to a customer's terminal, silently, which is precisely the class
 * of error this product exists to catch.
 *
 * Deliberately PARTIAL and optional-heavy. The CLI is a client of an API that
 * may add fields, and a client that breaks when the server adds a key is worse
 * than one that ignores it. Every field the formatter touches is declared;
 * anything else is the server's business.
 */

export interface Rate {
  present: number
  responses: number
  /** Null below min_sample. NEVER render as 0. */
  rate: number | null
  min_sample: number
}

export interface Engine extends Rate {
  engine: string
  name: string
  collection_method: string
  citations?: number
  avg_rank_when_named?: number | null
}

export interface BrandVisibility extends Rate {
  name: string
  role: "self" | "competitor"
  citations?: number
  avg_rank_when_named?: number | null
}

export interface Visibility {
  engines?: Engine[]
  brands?: BrandVisibility[]
}

export interface Brand {
  id: string
  name: string
  domain?: string | null
  configured: boolean
  active_prompts: number
  last_collected_at?: string | null
}

export interface Source {
  domain: string
  answers_citing_it: number
  answers_where_you_were_named: number
  answers_citing_you_without_naming_you: number
}

export interface Mention {
  brand: string
  mentioned: boolean
}

export interface Answer {
  id: string
  engine: string
  prompt: string
  outcome?: string
  collected_at: string
  mentions?: Mention[]
}

export interface Alert {
  id: string
  kind: string
  title: string
  detail?: string
  created_at: string
}

export interface Me {
  organization?: { name?: string | null }
  plan?: {
    name?: string
    status?: string
    prompts?: { used?: number; included?: number }
  }
  brand?: { id?: string; name?: string }
  rate_limit?: { per_minute?: number; remaining?: number }
  reporting_rules?: {
    min_sample?: number
    engines_averaged?: boolean
    alerts?: {
      enabled?: boolean
      min_delta_points?: number
      min_sample_each_side?: number
      empty_list_means?: string
    }
  }
}
