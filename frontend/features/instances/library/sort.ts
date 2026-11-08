import type { Instance } from "../../../types"
import { getMinecraftVersion } from "../../../lib/version"

export type SortOption = "recently-played" | "version" | "name-asc" | "name-desc"

export const SORT_LABELS: Record<SortOption, string> = {
  "recently-played": "Recently played",
  "version": "Minecraft version",
  "name-asc": "Name (A–Z)",
  "name-desc": "Name (Z–A)",
}

export const SORT_OPTIONS = Object.keys(SORT_LABELS) as SortOption[]

export function sortInstances(list: Instance[], sortBy: SortOption): Instance[] {
  return [...list].sort((a, b) => {
    switch (sortBy) {
      case "name-asc": return a.name.localeCompare(b.name)
      case "name-desc": return b.name.localeCompare(a.name)
      case "version": {
        const byVersion = getMinecraftVersion(b).localeCompare(getMinecraftVersion(a), undefined, { numeric: true })
        return byVersion !== 0 ? byVersion : a.name.localeCompare(b.name)
      }
      case "recently-played":
      default: {
        const aTime = a.last_played ? new Date(a.last_played).getTime() : 0
        const bTime = b.last_played ? new Date(b.last_played).getTime() : 0
        return bTime - aTime
      }
    }
  })
}
