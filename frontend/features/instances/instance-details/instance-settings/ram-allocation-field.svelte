<script lang="ts">
  import { invoke } from "@tauri-apps/api/core"
  import type { Instance, LauncherSettings, SystemInfo } from "../../../../types"

  let { instance, onInstanceUpdated, onAlert }: {
    instance: Instance
    onInstanceUpdated: () => void
    onAlert: (alert: { isOpen: boolean; title: string; message: string; type: "warning" | "danger" | "success" | "info" }) => void
  } = $props()

  let useCustomRam = $state(false)
  let instanceMemoryMb = $state(4096)
  let systemInfo = $state<SystemInfo | null>(null)
  let ramSaveTimeout: ReturnType<typeof setTimeout> | undefined

  let minMem = 1024
  let maxMem = $derived(systemInfo?.total_memory_mb || 32768)
  let ramPercent = $derived(((instanceMemoryMb - minMem) / (maxMem - minMem)) * 100)

  async function loadInstanceRamSettings() {
    try {
      const settings = await invoke<LauncherSettings | null>("get_instance_settings", { instanceName: instance.name })
      if (settings?.memory_mb) {
        useCustomRam = true
        instanceMemoryMb = settings.memory_mb
      } else {
        useCustomRam = false
        instanceMemoryMb = 4096
      }
    } catch (error) {
      useCustomRam = false
      instanceMemoryMb = 4096
    }
  }

  async function loadSystemInfo() {
    try {
      const info = await invoke<SystemInfo>("get_system_info")
      systemInfo = info
    } catch {}
  }

  async function saveRamSettings(memoryMb: number, enabled: boolean) {
    try {
      if (enabled) {
        const currentSettings = await invoke<LauncherSettings | null>("get_instance_settings", { instanceName: instance.name })
        const newSettings: LauncherSettings = {
          memory_mb: memoryMb,
          java_path: currentSettings?.java_path ?? null,
          auto_navigate_to_console: currentSettings?.auto_navigate_to_console ?? true,
        }
        await invoke("save_instance_settings", { instanceName: instance.name, settings: newSettings })
      } else {
        await invoke("save_instance_settings", { instanceName: instance.name, settings: null })
      }
      onInstanceUpdated()
    } catch (error) {
      onAlert({ isOpen: true, title: "An error occurred", message: `Failed to save RAM settings: ${String(error)}`, type: "danger" })
    }
  }

  function handleRamChange() {
    if (ramSaveTimeout) clearTimeout(ramSaveTimeout)
    ramSaveTimeout = setTimeout(() => saveRamSettings(instanceMemoryMb, useCustomRam), 500)
  }

  $effect(() => {
    loadInstanceRamSettings()
    loadSystemInfo()

    return () => {
      if (ramSaveTimeout) clearTimeout(ramSaveTimeout)
    }
  })
</script>

<div class="col-span-2">
  <div class="flex items-center justify-between mb-2">
    <div class="flex items-center gap-2 text-[var(--text-primary)]">
      <span class="text-sm font-medium">RAM Allocation</span>
    </div>
      <button
        onclick={() => { const next = !useCustomRam; useCustomRam = next; saveRamSettings(instanceMemoryMb, next) }}
        class="relative w-9 h-[22px] rounded-full shrink-0 cursor-pointer {useCustomRam ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-hover-strong)]'}"
        aria-label="Toggle custom RAM"
      >
        <span class="absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform {useCustomRam ? 'translate-x-[14px]' : ''}"></span>
      </button>
  </div>
  <div class="transition-opacity {useCustomRam ? 'opacity-100' : 'opacity-40 pointer-events-none'}">
    <div class="bg-[var(--bg-tertiary)] rounded-md px-3 py-2.5 space-y-1.5">
      <div class="flex items-baseline justify-between">
        <span class="text-lg font-bold text-[var(--text-primary)]">{(instanceMemoryMb / 1024).toFixed(1)} GB</span>
        <span class="text-xs text-[var(--text-muted)]">{systemInfo ? `of ${(systemInfo.total_memory_mb / 1024).toFixed(0)} GB total` : ""}</span>
      </div>
      <div class="relative h-5 flex items-center">
        <div class="absolute inset-x-0 h-2 bg-[var(--content-bg)] rounded-full"></div>
        <div class="absolute h-2 rounded-full" style="width: calc(3px + (100% - 6px) * {ramPercent / 100}); background: var(--accent-primary)"></div>
        <div class="absolute w-1.5 h-4 rounded-full bg-[var(--accent-primary)] -translate-x-1/2 top-1/2 -mt-2" style="left: calc(3px + (100% - 6px) * {ramPercent / 100})"></div>
        <input
          type="range" min={minMem} max={maxMem} step="512"
          bind:value={instanceMemoryMb}
          oninput={handleRamChange}
          class="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  </div>
</div>
