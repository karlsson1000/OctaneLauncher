import { storeGet, storeSet } from "../../../lib/store"
import type { Cape } from "../../../types"

export const SKIN_CACHE_KEY = "octane_skin_cache"
export const CAPE_CACHE_KEY = "octane_cape_cache"
export const CACHE_DURATION = 15 * 60 * 1000

export type SkinCacheEntry = { url: string; variant: string; timestamp: number }
export type CapeCacheEntry = { capes: Cape[]; activeCapeId: string | null; timestamp: number }

export const isFresh = (timestamp: number) => Date.now() - timestamp < CACHE_DURATION

async function readEntries<T>(key: string): Promise<Record<string, T>> {
  const value = await storeGet<unknown>(key)
  if (!value || typeof value !== "object") return {}
  const record = value as Record<string, unknown>
  const legacyUuid = record.uuid
  if (typeof legacyUuid === "string") {
    const entry: Record<string, unknown> = { ...record }
    delete entry.uuid
    return { [legacyUuid]: entry as unknown as T }
  }
  return record as Record<string, T>
}

async function writeEntry<T>(key: string, uuid: string, entry: T): Promise<void> {
  const entries = await readEntries<T>(key)
  entries[uuid] = entry
  await storeSet(key, entries)
}

export async function loadSkinCache(uuid: string): Promise<SkinCacheEntry | null> {
  const entries = await readEntries<SkinCacheEntry>(SKIN_CACHE_KEY)
  return entries[uuid] ?? null
}

export function saveSkinCache(uuid: string, entry: SkinCacheEntry): Promise<void> {
  return writeEntry(SKIN_CACHE_KEY, uuid, entry)
}

export async function removeSkinCache(uuid: string): Promise<void> {
  const entries = await readEntries<SkinCacheEntry>(SKIN_CACHE_KEY)
  delete entries[uuid]
  await storeSet(SKIN_CACHE_KEY, entries)
}

export async function loadCapeCache(uuid: string): Promise<CapeCacheEntry | null> {
  const entries = await readEntries<CapeCacheEntry>(CAPE_CACHE_KEY)
  return entries[uuid] ?? null
}

export function saveCapeCache(uuid: string, entry: CapeCacheEntry): Promise<void> {
  return writeEntry(CAPE_CACHE_KEY, uuid, entry)
}

export function normalizeCapeUrl(url: string) { return url.replace("http://", "https://") }
