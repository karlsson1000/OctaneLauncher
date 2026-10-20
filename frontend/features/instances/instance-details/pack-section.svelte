<script lang="ts">
  import { Loader2, Search, X, Image, Palette, ExternalLink, Trash2 } from "lucide-svelte"
  import { invoke } from "@tauri-apps/api/core"
  import AlertModal from "../../../components/ui/alert-modal.svelte"
  import type { Instance, ModFileWithMetadata } from "../../../types"
  import { formatFileSize } from "../../../lib/format"

  let { instance, kind }: { instance: Instance; kind: "resource" | "shader" } = $props()

  const config = $derived(
    kind === "resource"
      ? {
          title: "Resource Packs",
          noun: "resource pack",
          listCommand: "get_installed_resourcepacks_with_metadata",
          deleteCommand: "delete_resourcepack",
          openCommand: "open_resourcepacks_folder",
          icon: Image,
          color: "#f97316",
        }
      : {
          title: "Shader Packs",
          noun: "shader pack",
          listCommand: "get_installed_shaderpacks_with_metadata",
          deleteCommand: "delete_shaderpack",
          openCommand: "open_shaderpacks_folder",
          icon: Palette,
          color: "#8b5cf6",
        }
  )

  let packs = $state<ModFileWithMetadata[]>([])
  let isLoading = $state(true)
  let searchQuery = $state("")
  let alertModal = $state<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null>(null)

  $effect(() => {
    void instance.name
    loadPacks()
  })

  async function loadPacks() {
    isLoading = true
    try {
      packs = await invoke<ModFileWithMetadata[]>(config.listCommand, { instanceName: instance.name })
    } catch {
      packs = []
    } finally {
      isLoading = false
    }
  }

  async function handleDelete(filename: string) {
    const previous = packs
    packs = packs.filter(p => p.filename !== filename)
    try {
      await invoke(config.deleteCommand, { instanceName: instance.name, filename })
    } catch (error) {
      packs = previous
      alertModal = { isOpen: true, title: "Error", message: `Failed to delete ${config.noun}: ${String(error)}`, type: "danger" }
    }
  }

  async function handleOpenFolder() {
    try {
      await invoke(config.openCommand, { instanceName: instance.name })
    } catch {}
  }

  let filteredPacks = $derived(
    packs.filter(pack => {
      if (!searchQuery.trim()) return true
      const query = searchQuery.toLowerCase()
      return (pack.name || pack.filename).toLowerCase().includes(query) || pack.filename.toLowerCase().includes(query)
    })
  )

  const Icon = $derived(config.icon)
</script>

<div class="flex-1 flex flex-col min-h-0 overflow-hidden">
  <div class="flex-shrink-0">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold text-[var(--text-primary)] tracking-tight">{config.title}</h2>
        <span class="px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-xs rounded">{packs.length} pack{packs.length === 1 ? "" : "s"}</span>
      </div>
      <button onclick={handleOpenFolder} class="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded text-xs cursor-pointer">
        <ExternalLink size={14} /><span>Open Folder</span>
      </button>
    </div>
    <div class="relative mb-3">
      <Search size={14} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
      <input type="text" bind:value={searchQuery} placeholder="Search {config.noun}s..." class="w-full bg-[var(--bg-tertiary)] rounded-md pl-8 pr-8 py-1.5 text-sm text-[var(--text-muted)] placeholder-[var(--text-muted)] focus:outline-none" />
      {#if searchQuery}
        <button onclick={() => searchQuery = ""} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-muted)] cursor-pointer"><X size={14} /></button>
      {/if}
    </div>
  </div>
  <div class="flex-1 overflow-y-auto min-h-0">
    {#if isLoading}
      <div class="text-center py-16"><Loader2 size={32} class="animate-spin text-[#16a34a] mx-auto" /></div>
    {:else if packs.length === 0}
      <div class="flex flex-col items-center justify-center py-16">
        <Icon size={48} class="mb-3" color={config.color} strokeWidth={1.5} />
        <h3 class="text-base font-semibold text-[var(--text-primary)] mb-1">No {config.noun}s</h3>
        <p class="text-sm text-[var(--text-muted)]">Browse the addons tab to add {config.noun}s</p>
      </div>
    {:else if filteredPacks.length === 0}
      <div class="flex flex-col items-center justify-center py-16">
        <Search size={32} class="text-[var(--text-muted)] mb-3" strokeWidth={1.5} />
        <p class="text-sm text-[var(--text-muted)]">No {config.noun}s match your search</p>
      </div>
    {:else}
      <div class="space-y-3 pr-1">
        {#each filteredPacks as pack (pack.filename)}
          <div class="bg-[var(--bg-tertiary)] rounded-md overflow-hidden transition-all">
            <div class="flex min-h-0">
              {#if pack.icon_url}
                <div class="w-22 h-22 bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0 self-stretch">
                  <img src={pack.icon_url} alt={pack.name || pack.filename} class="w-full h-full object-contain" />
                </div>
              {:else}
                <div class="w-22 h-22 flex items-center justify-center flex-shrink-0 self-stretch">
                  <Icon size={36} color={config.color} strokeWidth={1.5} />
                </div>
              {/if}
              <div class="flex-1 min-w-0 py-2 px-4 flex items-center gap-3 relative z-0">
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold text-base text-[var(--text-primary)] truncate">{pack.name || pack.filename}</h3>
                  <p class="text-sm text-[var(--text-muted)] truncate">{pack.filename}</p>
                  <p class="text-sm text-[var(--text-muted)] mt-0.5">{formatFileSize(pack.size)}</p>
                </div>
                <div class="flex flex-col items-center gap-1 self-center">
                  <button onclick={() => handleDelete(pack.filename)} class="p-1 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 rounded cursor-pointer">
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
