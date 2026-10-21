import type { Instance } from "../types"

export function getMinecraftVersion(instance: Instance): string {
  if (instance.loader === "fabric") {
    const parts = instance.version.split("-")
    return parts[parts.length - 1]
  }
  if (instance.loader === "neoforge") {
    const versionPart = instance.version.replace("neoforge-", "")
    const parts = versionPart.split("-")
    if (parts[0].startsWith("1.")) return parts[0]
    const versionNumbers = parts[0].split(".")
    if (versionNumbers.length >= 2) {
      const major = versionNumbers[0]
      const minor = versionNumbers[1]
      const patch = versionNumbers[2] || "0"
      if (parseInt(major) >= 20) return patch === "0" ? `1.${major}` : `1.${major}.${minor}`
    }
  }
  if (instance.loader === "forge") {
    return instance.version.split("-forge-")[0] || instance.version
  }
  return instance.version
}

export function getFabricLoaderVersion(instance: Instance): string | null {
  if (instance.loader === "fabric") {
    const parts = instance.version.split("-")
    if (parts.length >= 2) return parts[parts.length - 2]
  }
  return null
}

export function getNeoForgeVersion(instance: Instance): string | null {
  if (instance.loader === "neoforge") {
    const versionPart = instance.version.replace("neoforge-", "")
    const parts = versionPart.split("-")
    const mcVersion = getMinecraftVersion(instance)
    const neoforgeVersionParts = parts.filter(part => part !== mcVersion)
    if (neoforgeVersionParts.length > 0) return neoforgeVersionParts.join("-")
  }
  return null
}

export function getForgeVersion(instance: Instance): string | null {
  if (instance.loader === "forge") {
    const parts = instance.version.split("-forge-")
    if (parts.length > 1) return parts[1]
  }
  return null
}
