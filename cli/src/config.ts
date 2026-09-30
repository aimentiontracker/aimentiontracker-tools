/**
 * Where the key lives.
 *
 * PRECEDENCE IS ENV FIRST, ALWAYS. CI and headless agents set
 * AMT_API_KEY and must never be silently overridden by a config file somebody
 * left in the home directory of a shared build user — that failure looks like
 * "the key is wrong" and takes an afternoon to find.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export const CONFIG_DIR = join(homedir(), ".aimentiontracker")
export const CONFIG_PATH = join(CONFIG_DIR, "config.json")

export interface StoredConfig {
  key?: string
  baseUrl?: string
  /** Default brand, so multi-brand accounts don't retype --brand every time. */
  brand?: string
}

export function readConfig(): StoredConfig {
  try {
    if (!existsSync(CONFIG_PATH)) return {}
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as StoredConfig
  } catch {
    // A corrupt config must not be fatal: `amt login` has to still work so
    // somebody can fix it without hand-editing JSON.
    return {}
  }
}

export function writeConfig(cfg: StoredConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 })
  // Set it explicitly as well as on create: writeFileSync's mode applies only
  // when the file does not already exist, so a re-login would otherwise keep
  // whatever permissions were there before.
  chmodSync(CONFIG_PATH, 0o600)
}

export function clearConfig(): void {
  if (existsSync(CONFIG_PATH)) rmSync(CONFIG_PATH)
}

export interface Resolved {
  key: string | null
  baseUrl: string | undefined
  brand: string | undefined
  source: "env" | "config" | "none"
}

export function resolve(): Resolved {
  const cfg = readConfig()
  const envKey = process.env.AMT_API_KEY?.trim()
  if (envKey) {
    return {
      key: envKey,
      baseUrl: process.env.AMT_BASE_URL || cfg.baseUrl,
      brand: process.env.AMT_BRAND || cfg.brand,
      source: "env",
    }
  }
  if (cfg.key) {
    return {
      key: cfg.key,
      baseUrl: process.env.AMT_BASE_URL || cfg.baseUrl,
      brand: process.env.AMT_BRAND || cfg.brand,
      source: "config",
    }
  }
  return { key: null, baseUrl: process.env.AMT_BASE_URL, brand: process.env.AMT_BRAND, source: "none" }
}
