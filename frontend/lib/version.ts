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
