import { invoke } from "@tauri-apps/api/core"

const SPLASH_KEY = "octane_custom_splash"
const SPLASH_VARS = [
  ["--splash-bg", "--bg-primary"],
  ["--splash-text", "--text-primary"],
  ["--splash-accent", "--accent-primary"],
] as const

let generation = 0
let applied: string[] = []

function syncSplash(root: HTMLElement) {
  const computed = getComputedStyle(root)
  const splash: Record<string, string> = {}

  for (const [target, source] of SPLASH_VARS) {
    const value = computed.getPropertyValue(source).trim()
    if (!value) continue
    root.style.setProperty(target, value)
    applied.push(target)
    splash[target] = value
  }

  try {
    localStorage.setItem(SPLASH_KEY, JSON.stringify(splash))
  } catch {}
}

function clearApplied() {
  const root = document.documentElement
  for (const name of applied) root.style.removeProperty(name)
  applied = []
}

export async function applyCustomTheme(): Promise<boolean> {
  const run = ++generation
  try {
    const css = await invoke<string>("get_custom_theme")
    if (run !== generation) return false

    clearApplied()
    const body = css.replace(/\/\*[\s\S]*?\*\//g, "")
    const root = document.documentElement

    for (const match of body.matchAll(/--([\w-]+)\s*:\s*([^;{}]+)(?:;|(?=\}))/g)) {
      const name = `--${match[1]}`
      const value = match[2].trim()
      if (!value) continue
      root.style.setProperty(name, value)
      applied.push(name)
    }

    syncSplash(root)
    return true
  } catch (error) {
    console.error("Failed to load custom theme:", error)
    return false
  }
}

export function clearCustomTheme(): void {
  generation++
  clearApplied()
}
