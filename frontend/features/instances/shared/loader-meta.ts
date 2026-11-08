import type { Instance } from "../../../types"
import { getMinecraftVersion } from "../../../lib/version"

export type LoaderMeta = { label: string; accent: string; text: string }

export const VANILLA: LoaderMeta = { label: "Vanilla", accent: "bg-[#16a34a]", text: "text-[#16a34a]" }

export const LOADERS: Record<string, LoaderMeta> = {
  fabric: { label: "Fabric", accent: "bg-[#3b82f6]", text: "text-[#3b82f6]" },
  neoforge: { label: "NeoForge", accent: "bg-[#f97316]", text: "text-[#f97316]" },
  forge: { label: "Forge", accent: "bg-[#e05d2e]", text: "text-[#e05d2e]" },
}

export const getLoaderMeta = (loader?: string | null): LoaderMeta => (loader && LOADERS[loader]) || VANILLA

export function getLoaderVersion(instance: Instance): string | null {
  switch (instance.loader) {
    case "fabric": {
      const parts = instance.version.split("-")
      return parts.length >= 2 ? parts[parts.length - 2] : null
    }
    case "neoforge": {
      const mcVersion = getMinecraftVersion(instance)
      const parts = instance.version.replace("neoforge-", "").split("-").filter(part => part !== mcVersion)
      return parts.length > 0 ? parts.join("-") : null
    }
    case "forge":
      return instance.version.split("-forge-")[1] ?? null
    default:
      return null
  }
}
