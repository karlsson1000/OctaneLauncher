import { invoke } from "@tauri-apps/api/core"

let generation = 0
let applied: string[] = []

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
