import { convertFileSrc } from "@tauri-apps/api/core"

const iconVersions = new Map<string, string>()

export function bumpInstanceIcon(key: string): void {
  iconVersions.set(key, Date.now().toString())
}

export function clearInstanceIcon(key: string): void {
  iconVersions.delete(key)
}

export function instanceIconSrc(iconPath?: string | null, key?: string): string | null {
  if (!iconPath) return null
  const base = convertFileSrc(iconPath)
  const version = key ? iconVersions.get(key) : undefined
  return version ? `${base}?v=${version}` : base
}
