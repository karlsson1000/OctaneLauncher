<script lang="ts">
  import { Loader2, Search, X, Package, RefreshCw, Check, Trash2 } from "lucide-svelte"
  import { invoke } from "@tauri-apps/api/core"
  import AlertModal from "../../../components/ui/alert-modal.svelte"
  import type { Instance, ModFileWithMetadata } from "../../../types"
  import { getMinecraftVersion } from "../../../lib/version"
  import { formatFileSize } from "../../../lib/format"

  type InstalledMod = ModFileWithMetadata

  interface ModUpdate {
    filename: string
    latestVersion: {
      downloadUrl: string
      filename: string
      sha1: string
    }
  }

  let { instance }: { instance: Instance } = $props()

  let installedMods = $state<InstalledMod[]>([])
  let isLoadingMods = $state(true)
  let availableUpdates = $state<ModUpdate[]>([])
  let isCheckingUpdates = $state(false)
  let allModsUpToDate = $state(false)
  let upToDateTimer: ReturnType<typeof setTimeout> | undefined
  let isUpdatingMods = $state(false)
  let modSearchQuery = $state("")
  let alertModal = $state<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null>(null)

  $effect(() => {
    void instance.name
    allModsUpToDate = false
    loadInstalledMods()
    return () => {
      if (upToDateTimer) clearTimeout(upToDateTimer)
    }
  })

  async function loadInstalledMods() {
    isLoadingMods = true
    try {
      const mods = await invoke<InstalledMod[]>("get_installed_mods_with_metadata", { instanceName: instance.name })
      installedMods = mods
    } catch (error) {
      installedMods = []
    } finally {
      isLoadingMods = false
    }
  }

  async function runUpdateCheck(): Promise<ModUpdate[]> {
    return await invoke<ModUpdate[]>("check_mod_updates", {
      instanceName: instance.name,
      loader: instance.loader,
      gameVersion: getMinecraftVersion(instance),
    })
  }

  async function checkForUpdates() {
    if (!instance || (instance.loader !== "fabric" && instance.loader !== "neoforge" && instance.loader !== "forge")) return

    isCheckingUpdates = true
    allModsUpToDate = false
    if (upToDateTimer) clearTimeout(upToDateTimer)

    try {
      availableUpdates = await runUpdateCheck()
      if (availableUpdates.length === 0) {
        allModsUpToDate = true
        upToDateTimer = setTimeout(() => (allModsUpToDate = false), 3000)
      }
    } catch (error) {
      alertModal = { isOpen: true, title: "Error", message: `Failed to check for updates: ${String(error)}`, type: "danger" }
    } finally {
      isCheckingUpdates = false
    }
  }

  async function applyModUpdate(update: ModUpdate) {
    await invoke("download_mod", {
      instanceName: instance.name,
      downloadUrl: update.latestVersion.downloadUrl,
      filename: update.latestVersion.filename,
      expectedSha1: update.latestVersion.sha1 ?? null,
    })
    if (update.filename !== update.latestVersion.filename) {
      await invoke("delete_mod", { instanceName: instance.name, filename: update.filename }).catch(() => {})
    }
  }

  async function updateAllMods() {
    if (availableUpdates.length === 0) return

    isUpdatingMods = true

    const queue = [...availableUpdates]
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length > 0) {
        const update = queue.shift()
        if (!update) break
        try {
          await applyModUpdate(update)
        } catch {}
      }
    })
    await Promise.all(workers)

    isUpdatingMods = false
    availableUpdates = []

    await loadInstalledMods()
  }

  async function updateSingleMod(update: ModUpdate) {
    if (isUpdatingMods) return
    const previousUpdates = availableUpdates
    isUpdatingMods = true
    availableUpdates = availableUpdates.filter(u => u.filename !== update.filename)
    try {
      await applyModUpdate(update)
      await loadInstalledMods()
      availableUpdates = await runUpdateCheck().catch(() => availableUpdates)
    } catch (error) {
      availableUpdates = previousUpdates
      alertModal = {
        isOpen: true,
        title: "Update failed",
        message: `Failed to update ${update.filename}: ${String(error)}`,
        type: "danger",
      }
    } finally {
      isUpdatingMods = false
    }
  }

  async function handleDeleteMod(filename: string) {
    const previousMods = installedMods
    const previousUpdates = availableUpdates
    installedMods = installedMods.filter(m => m.filename !== filename)
    availableUpdates = availableUpdates.filter(u => u.filename !== filename)
    try {
      await invoke("delete_mod", { instanceName: instance.name, filename })
    } catch (error) {
      installedMods = previousMods
      availableUpdates = previousUpdates
      alertModal = { isOpen: true, title: "Error", message: `Failed to delete mod: ${String(error)}`, type: "danger" }
    }
  }

  async function handleToggleMod(mod: InstalledMod) {
    const disabled = !mod.disabled
    const filename = disabled
      ? (mod.filename.endsWith(".disabled") ? mod.filename : `${mod.filename}.disabled`)
      : (mod.filename.endsWith(".disabled") ? mod.filename.slice(0, -".disabled".length) : mod.filename)
    const updated = { ...mod, filename, disabled }
    installedMods = installedMods.map(m => m.filename === mod.filename ? updated : m)
    try {
      await invoke("toggle_mod", { instanceName: instance.name, filename: mod.filename, disable: disabled })
    } catch (error) {
      installedMods = installedMods.map(m => m.filename === filename ? mod : m)
      alertModal = { isOpen: true, title: "Error", message: `Failed to ${mod.disabled ? "enable" : "disable"} mod: ${String(error)}`, type: "danger" }
    }
  }

  let filteredMods = $derived(
    installedMods.filter(mod => {
      if (!modSearchQuery.trim()) return true
      const query = modSearchQuery.toLowerCase()
      return (mod.name || mod.filename).toLowerCase().includes(query) || mod.filename.toLowerCase().includes(query)
    })
  )
</script>

<div class="flex-1 flex flex-col min-h-0 overflow-hidden">
  <div class="flex-shrink-0">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold text-[var(--text-primary)] tracking-tight">Installed Mods</h2>
        <span class="px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-xs rounded">{installedMods.length} mod{installedMods.length === 1 ? "" : "s"}</span>
      </div>
      <div class="flex items-center gap-2">
        {#if instance.loader === "fabric"}
          {#if availableUpdates.length > 0}
            <button onclick={updateAllMods} disabled={isUpdatingMods} class="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium cursor-pointer">
              {#if isUpdatingMods}
                <Loader2 size={14} class="animate-spin" /><span>Updating...</span>
              {:else}
                <RefreshCw size={14} /><span>Update All ({availableUpdates.length})</span>
              {/if}
            </button>
          {:else}
            <button onclick={checkForUpdates} disabled={isCheckingUpdates} class="flex items-center gap-1.5 px-2 py-0.5 {allModsUpToDate ? 'bg-[#16a34a] hover:bg-[#15803d] text-white' : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] disabled:opacity-50 text-[var(--text-muted)] hover:text-[var(--text-primary)]'} rounded text-xs font-medium cursor-pointer">
              {#if isCheckingUpdates}
                <Loader2 size={14} class="animate-spin" /><span>Checking...</span>
              {:else if allModsUpToDate}
                <Check size={14} strokeWidth={3} /><span>All mods up to date</span>
              {:else}
                <RefreshCw size={14} /><span>Check for Updates</span>
              {/if}
            </button>
          {/if}
        {/if}
      </div>
    </div>

    <div class="relative mb-3">
      <Search size={14} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
      <input type="text" bind:value={modSearchQuery} placeholder="Search mods..." class="w-full bg-[var(--bg-tertiary)] rounded-md pl-8 pr-8 py-1.5 text-sm text-[var(--text-muted)] placeholder-[var(--text-muted)] focus:outline-none" />
      {#if modSearchQuery}
        <button onclick={() => modSearchQuery = ""} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-muted)] cursor-pointer"><X size={14} /></button>
      {/if}
    </div>
  </div>

  <div class="flex-1 overflow-y-auto min-h-0">
    {#if isLoadingMods}
      <div class="text-center py-16"><Loader2 size={32} class="animate-spin text-[#16a34a] mx-auto" /></div>
    {:else if installedMods.length === 0}
      <div class="flex flex-col items-center justify-center py-16">
        <Package size={48} class="text-[#16a34a] mb-3" strokeWidth={1.5} />
        <h3 class="text-base font-semibold text-[var(--text-primary)] mb-1">No mods installed</h3>
        <p class="text-sm text-[var(--text-muted)]">Browse the mods tab to add mods</p>
      </div>
    {:else if filteredMods.length === 0}
      <div class="flex flex-col items-center justify-center py-16">
        <Search size={32} class="text-[var(--text-muted)] mb-3" strokeWidth={1.5} />
        <p class="text-sm text-[var(--text-muted)]">No mods match your search</p>
      </div>
    {:else}
      <div class="space-y-3 pr-1">
        {#each filteredMods as mod (mod.filename)}
          {@const hasUpdate = availableUpdates.some(u => u.filename === mod.filename)}
          <div class="bg-[var(--bg-tertiary)] rounded-md overflow-hidden transition-all {mod.disabled ? 'opacity-60' : ''}">
            <div class="flex min-h-0">
              {#if mod.icon_url}
                <div class="w-22 h-22 bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0 self-stretch">
                  <img src={mod.icon_url} alt={mod.name || mod.filename} class="w-full h-full object-contain {mod.disabled ? 'grayscale' : ''}" />
                </div>
              {:else}
                <div class="w-22 h-22 flex items-center justify-center flex-shrink-0 self-stretch">
                  <Package size={36} class="text-[var(--text-muted)]" strokeWidth={2} />
                </div>
              {/if}
              <div class="flex-1 min-w-0 py-2 px-4 flex items-center gap-3 relative z-0">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <h3 class="font-semibold text-base text-[var(--text-primary)] truncate">{mod.name || mod.filename}</h3>
                    {#if hasUpdate}
                      <button onclick={() => { const u = availableUpdates.find(up => up.filename === mod.filename); if (u) updateSingleMod(u) }} class="px-1.5 py-0.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs rounded font-medium cursor-pointer">Update</button>
                    {/if}
                  </div>
                  <p class="text-sm text-[var(--text-muted)] truncate">{mod.filename}{mod.disabled && !mod.filename.endsWith(".disabled") ? ".disabled" : ""}</p>
                  <p class="text-sm text-[var(--text-muted)] mt-0.5">{formatFileSize(mod.size)}</p>
                </div>
                <div class="flex items-center gap-3">
                  {#key mod.disabled}
                    <button onclick={() => handleToggleMod(mod)} class="check-pop w-6 h-6 rounded-md border-2 flex items-center justify-center cursor-pointer {mod.disabled ? 'bg-transparent border-[var(--text-muted)]/60' : 'bg-[#16a34a] border-[#16a34a]'}" aria-label="Toggle mod">
                      {#if !mod.disabled}
                        <Check size={16} strokeWidth={4} color="#0f1115" />
                      {/if}
                    </button>
                  {/key}
                  <button onclick={() => handleDeleteMod(mod.filename)} class="p-1 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 rounded cursor-pointer">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

{#if alertModal}
  <AlertModal
    isOpen={alertModal.isOpen}
    title={alertModal.title}
    message={alertModal.message}
    type={alertModal.type}
    onClose={() => alertModal = null}
  />
{/if}
