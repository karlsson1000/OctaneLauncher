import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { store, loadAllInitialData, checkForUpdates } from "./launcherStore.svelte"

const SPLASH_DELAY_MS = 100
const SPLASH_REMOVE_MS = 500

function setSplashStatus(text: string) {
  const el = document.getElementById("splash-status")
  if (el) el.textContent = text
}

function setSplashProgress(fraction: number | null) {
  const progress = document.getElementById("splash-progress")
  const fill = document.getElementById("splash-progress-fill")
  const loader = document.querySelector<HTMLElement>(".splash-loader")
  if (!progress || !fill) return
  progress.classList.add("active")
  if (loader) loader.style.display = "none"
  fill.style.width = fraction === null ? "100%" : `${Math.round(fraction * 100)}%`
}

function revealLauncher() {
  store.isReady = true
  const splash = document.getElementById("splash-screen")
  const root = document.getElementById("root")
  if (splash && root) {
    splash.classList.add("hidden")
    root.classList.add("visible")
    setTimeout(() => splash.remove(), SPLASH_REMOVE_MS)
  }
  loadAllInitialData()
}

export async function bootLauncher() {
  const startedAt = Date.now()
  try {
    const update = await checkForUpdates()
    if (update) {
      store.isInstallingUpdate = true
      setSplashStatus(`Update found, installing ${update.new_version}..`)
      setSplashProgress(null)
      const unlisten = await listen<{ downloaded: number; total: number | null }>(
        "update-download-progress",
        (event) => {
          const { downloaded, total } = event.payload
          setSplashProgress(total && total > 0 ? downloaded / total : null)
        }
      )
      try {
        await invoke("install_update")
      } catch (error) {
        console.error("Launch update failed:", error)
        unlisten()
        store.isInstallingUpdate = false
        setSplashStatus("Update failed, launching...")
      }
    }
  } catch (error) {
    console.error("Update check failed:", error)
  }
  const elapsed = Date.now() - startedAt
  if (elapsed < SPLASH_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, SPLASH_DELAY_MS - elapsed))
  }
  revealLauncher()
}
