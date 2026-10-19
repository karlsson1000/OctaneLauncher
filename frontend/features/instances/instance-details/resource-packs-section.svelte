<script lang="ts">
  import { Loader2, Search, X, Image, ExternalLink, Trash2 } from "lucide-svelte"
  import { invoke } from "@tauri-apps/api/core"
  import AlertModal from "../../../components/ui/alert-modal.svelte"
  import type { Instance, ModFileWithMetadata } from "../../../types"
  import { formatFileSize } from "../../../lib/format"

  let { instance }: { instance: Instance } = $props()

  let resourcePacks = $state<ModFileWithMetadata[]>([])
  let isLoadingResourcePacks = $state(true)
  let resourcePackSearchQuery = $state("")
  let alertModal = $state<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null>(null)

  $effect(() => {
    void instance.name
    loadResourcePacks()
  })

  async function loadResourcePacks() {
    isLoadingResourcePacks = true
    try {
      const packs = await invoke<ModFileWithMetadata[]>("get_installed_resourcepacks_with_metadata", { instanceName: instance.name })
      resourcePacks = packs
    } catch (error) {
      resourcePacks = []
    } finally {
      isLoadingResourcePacks = false
    }
  }

  async function handleDeleteResourcePack(filename: string) {
    const previous = resourcePacks
    resourcePacks = resourcePacks.filter(p => p.filename !== filename)
    try {
      await invoke("delete_resourcepack", { instanceName: instance.name, filename })
    } catch (error) {
      resourcePacks = previous
      alertModal = { isOpen: true, title: "Error", message: `Failed to delete resource pack: ${String(error)}`, type: "danger" }
    }
  }

  async function handleOpenResourcePacksFolder() {
    try {
      await invoke("open_resourcepacks_folder", { instanceName: instance.name })
    } catch {}
  }

  let filteredResourcePacks = $derived(
    resourcePacks.filter(pack => {
      if (!resourcePackSearchQuery.trim()) return true
      const query = resourcePackSearchQuery.toLowerCase()
      return (pack.name || pack.filename).toLowerCase().includes(query) || pack.filename.toLowerCase().includes(query)
    })
  )
</script>

<div class="flex-1 flex flex-col min-h-0 overflow-hidden">
  <div class="flex-shrink-0">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold text-[var(--text-primary)] tracking-tight">Resource Packs</h2>
        <span class="px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-xs rounded">{resourcePacks.length} pack{resourcePacks.length === 1 ? "" : "s"}</span>
      </div>
      <button onclick={handleOpenResourcePacksFolder} class="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded text-xs cursor-pointer">
        <ExternalLink size={14} /><span>Open Folder</span>
      </button>
    </div>
    <div class="relative mb-3">
      <Search size={14} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
      <input type="text" bind:value={resourcePackSearchQuery} placeholder="Search resource packs..." class="w-full bg-[var(--bg-tertiary)] rounded-md pl-8 pr-8 py-1.5 text-sm text-[var(--text-muted)] placeholder-[var(--text-muted)] focus:outline-none" />
      {#if resourcePackSearchQuery}
        <button onclick={() => resourcePackSearchQuery = ""} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-muted)] cursor-pointer"><X size={14} /></button>
      {/if}
    </div>
  </div>
  <div class="flex-1 overflow-y-auto min-h-0">
    {#if isLoadingResourcePacks}
      <div class="text-center py-16"><Loader2 size={32} class="animate-spin text-[#16a34a] mx-auto" /></div>
    {:else if resourcePacks.length === 0}
      <div class="flex flex-col items-center justify-center py-16">
        <Image size={48} class="text-[#f97316] mb-3" strokeWidth={1.5} />
        <h3 class="text-base font-semibold text-[var(--text-primary)] mb-1">No resource packs</h3>
        <p class="text-sm text-[var(--text-muted)]">Browse the addons tab to add resource packs</p>
      </div>
    {:else if filteredResourcePacks.length === 0}
      <div class="flex flex-col items-center justify-center py-16">
        <Search size={32} class="text-[var(--text-muted)] mb-3" strokeWidth={1.5} />
        <p class="text-sm text-[var(--text-muted)]">No resource packs match your search</p>
      </div>
    {:else}
      <div class="space-y-3 pr-1">
        {#each filteredResourcePacks as pack (pack.filename)}
          <div class="bg-[var(--bg-tertiary)] rounded-md overflow-hidden transition-all">
            <div class="flex min-h-0">
              {#if pack.icon_url}
                <div class="w-22 h-22 bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0 self-stretch">
                  <img src={pack.icon_url} alt={pack.name || pack.filename} class="w-full h-full object-contain" />
                </div>
              {:else}
                <div class="w-22 h-22 flex items-center justify-center flex-shrink-0 self-stretch">
                  <Image size={36} class="text-[#f97316]" strokeWidth={1.5} />
                </div>
              {/if}
              <div class="flex-1 min-w-0 py-2 px-4 flex items-center gap-3 relative z-0">
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold text-base text-[var(--text-primary)] truncate">{pack.name || pack.filename}</h3>
                  <p class="text-sm text-[var(--text-muted)] truncate">{pack.filename}</p>
                  <p class="text-sm text-[var(--text-muted)] mt-0.5">{formatFileSize(pack.size)}</p>
                </div>
                <div class="flex flex-col items-center gap-1 self-center">
                  <button onclick={() => handleDeleteResourcePack(pack.filename)} class="p-1 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 rounded cursor-pointer">
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
