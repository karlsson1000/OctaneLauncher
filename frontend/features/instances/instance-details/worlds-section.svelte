<script lang="ts">
  import { Loader2, Search, X, Globe, ExternalLink, Play, FolderOpen, Trash2 } from "lucide-svelte"
  import { invoke, convertFileSrc } from "@tauri-apps/api/core"
  import AlertModal from "../../../components/ui/alert-modal.svelte"
  import ConfirmModal from "../../../components/ui/confirm-modal.svelte"
  import type { Instance } from "../../../types"
  import { formatFileSize, formatDate } from "../../../lib/format"
  import { store, handleWorldLaunch } from "../../../lib/launcherStore.svelte"

  interface World {
    name: string
    folder_name: string
    size: number
    icon_path?: string
    created?: number
  }

  let { instance }: { instance: Instance } = $props()

  let worlds = $state<World[]>([])
  let isLoadingWorlds = $state(true)
  let worldSearchQuery = $state("")
  let launchingWorld = $state<string | null>(null)
  let alertModal = $state<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null>(null)
  let confirmModal = $state<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
    onConfirm: () => void
  } | null>(null)

  $effect(() => {
    void instance.name
    loadWorlds()
  })

  async function loadWorlds() {
    isLoadingWorlds = true
    try {
      const worldsList = await invoke<World[]>("get_instance_worlds", { instanceName: instance.name })
      worlds = worldsList
    } catch (error) {
      worlds = []
    } finally {
      isLoadingWorlds = false
    }
  }

  async function handleOpenWorldsFolder() {
    try {
      await invoke("open_worlds_folder", { instanceName: instance.name })
    } catch (error) {
      alertModal = { isOpen: true, title: "Error", message: `Failed to open worlds folder: ${String(error)}`, type: "danger" }
    }
  }

  async function handleOpenWorldFolder(folderName: string) {
    try {
      await invoke("open_world_folder", { instanceName: instance.name, folderName })
    } catch (error) {
      alertModal = { isOpen: true, title: "Error", message: `Failed to open world folder: ${String(error)}`, type: "danger" }
    }
  }

  async function handleLaunchWorld(worldName: string) {
    launchingWorld = worldName
    await handleWorldLaunch(worldName)
    launchingWorld = null
  }

  function handleDeleteWorld(folderName: string, worldName: string) {
    confirmModal = {
      isOpen: true,
      title: "Delete World",
      message: `Are you sure you want to delete "${worldName}"?\n\nThis action cannot be undone.`,
      type: "danger",
      onConfirm: async () => {
        confirmModal = null
        try {
          await invoke("delete_world", { instanceName: instance.name, folderName })
          await loadWorlds()
        } catch (error) {
          alertModal = { isOpen: true, title: "Error", message: `Failed to delete world: ${String(error)}`, type: "danger" }
        }
      }
    }
  }

  let filteredWorlds = $derived(
    worlds.filter(world => {
      if (!worldSearchQuery.trim()) return true
      return world.name.toLowerCase().includes(worldSearchQuery.toLowerCase())
    })
  )
</script>

<div class="flex-1 flex flex-col min-h-0 overflow-hidden">
  <div class="flex-shrink-0">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold text-[var(--text-primary)] tracking-tight">Worlds</h2>
        <span class="px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-xs rounded">{worlds.length} world{worlds.length === 1 ? "" : "s"}</span>
      </div>
      <button onclick={handleOpenWorldsFolder} class="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded text-xs cursor-pointer">
        <ExternalLink size={14} /><span>Open Folder</span>
      </button>
    </div>

    <div class="relative mb-3">
      <Search size={14} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
      <input type="text" bind:value={worldSearchQuery} placeholder="Search worlds..." class="w-full bg-[var(--bg-tertiary)] rounded-md pl-8 pr-8 py-1.5 text-sm text-[var(--text-muted)] placeholder-[var(--text-muted)] focus:outline-none" />
      {#if worldSearchQuery}
        <button onclick={() => worldSearchQuery = ""} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-muted)] cursor-pointer"><X size={14} /></button>
      {/if}
    </div>
  </div>

  <div class="flex-1 overflow-y-auto min-h-0">
    {#if isLoadingWorlds}
      <div class="text-center py-16"><Loader2 size={32} class="animate-spin text-[#16a34a] mx-auto" /></div>
    {:else if worlds.length === 0}
      <div class="flex flex-col items-center justify-center py-16">
        <Globe size={48} class="text-[#16a34a] mb-3" strokeWidth={1.5} />
        <h3 class="text-base font-semibold text-[var(--text-primary)] mb-1">No worlds yet</h3>
        <p class="text-sm text-[var(--text-muted)]">Launch the game to create a world</p>
      </div>
    {:else if filteredWorlds.length === 0}
      <div class="flex flex-col items-center justify-center py-16">
        <Search size={32} class="text-[var(--text-muted)] mb-3" strokeWidth={1.5} />
        <p class="text-sm text-[var(--text-muted)]">No worlds match your search</p>
      </div>
    {:else}
      <div class="space-y-3 pr-1">
        {#each filteredWorlds as world (world.folder_name)}
          <div class="bg-[var(--bg-tertiary)] rounded-md overflow-hidden transition-all">
            <div class="flex min-h-0">
              {#if world.icon_path}
                <div class="w-22 h-22 bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0 self-stretch">
                  <img src={convertFileSrc(world.icon_path)} alt={world.name} class="w-full h-full object-contain" />
                </div>
              {:else}
                <div class="w-22 h-22 flex items-center justify-center flex-shrink-0 self-stretch">
                  <Globe size={32} class="text-[var(--text-muted)]" strokeWidth={1.5} />
                </div>
              {/if}
              <div class="flex-1 min-w-0 py-2 px-4 flex items-center gap-3 relative z-0">
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold text-base text-[var(--text-primary)] truncate">{world.name}</h3>
                  <p class="text-sm text-[var(--text-muted)] truncate">Created {world.created ? formatDate(world.created) : "Unknown"}</p>
                  <p class="text-sm text-[var(--text-muted)] mt-0.5">{formatFileSize(world.size)}</p>
                </div>
                <div class="flex items-center gap-3">
                  <button onclick={() => handleLaunchWorld(world.folder_name)} disabled={!store.isAuthenticated || store.launchingInstanceName !== null || store.runningInstances.has(instance.name) || launchingWorld !== null} class="px-5 py-1.5 mr-2 rounded-sm cursor-pointer {(store.launchingInstanceName === instance.name || launchingWorld === world.folder_name) ? 'bg-red-500/10 text-red-400' : 'bg-[#16a34a] hover:bg-[#15803d] text-[#181a1f]'} disabled:opacity-40 disabled:cursor-not-allowed" title="Play this world">
                    {#if store.launchingInstanceName === instance.name || launchingWorld === world.folder_name}
                      <div class="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
                    {:else}
                      <Play size={20} fill="currentColor" strokeWidth={0} />
                    {/if}
                  </button>
                  <button onclick={() => handleOpenWorldFolder(world.folder_name)} class="p-1 hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded cursor-pointer" title="Open world folder"><FolderOpen size={20} /></button>
                  <button onclick={() => handleDeleteWorld(world.folder_name, world.name)} class="p-1 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 rounded cursor-pointer" title="Delete world"><Trash2 size={20} /></button>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

{#if confirmModal}
  <ConfirmModal
    isOpen={confirmModal.isOpen}
    title={confirmModal.title}
    message={confirmModal.message}
    type={confirmModal.type}
    confirmText={confirmModal.type === "danger" ? "Delete" : "Confirm"}
    onConfirm={confirmModal.onConfirm}
    onCancel={() => confirmModal = null}
  />
{/if}

{#if alertModal}
  <AlertModal
    isOpen={alertModal.isOpen}
    title={alertModal.title}
    message={alertModal.message}
    type={alertModal.type}
    onClose={() => alertModal = null}
  />
{/if}
