import { storeGet, storeSet } from "../../../lib/store"
import type { Cape } from "../../../types"

export const SKIN_CACHE_KEY = "octane_skin_cache"
export const CAPE_CACHE_KEY = "octane_cape_cache"
export const CACHE_DURATION = 15 * 60 * 1000
export const MIN_FETCH_INTERVAL = 10 * 1000

export type PersistedSkinCache = { uuid: string; url: string; variant: string; timestamp: number }
export type PersistedCapeCache = { uuid: string; capes: Cape[]; activeCapeId: string | null; timestamp: number }

export function loadCache<T>(key: string): Promise<T | null> {
  return storeGet<T>(key).then(v => v ?? null)
}

export function saveCache<T>(key: string, data: T) {
  return storeSet(key, data)
}

export const canFetch = (last: number) => Date.now() - last >= MIN_FETCH_INTERVAL

export function normalizeCapeUrl(url: string) { return url.replace("http://", "https://") }
