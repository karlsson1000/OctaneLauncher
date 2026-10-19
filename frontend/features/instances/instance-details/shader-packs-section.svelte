<script lang="ts">
  import { Loader2, Search, X, Palette, ExternalLink, Trash2 } from "lucide-svelte"
  import { invoke } from "@tauri-apps/api/core"
  import AlertModal from "../../../components/ui/alert-modal.svelte"
  import type { Instance, ModFileWithMetadata } from "../../../types"
  import { formatFileSize } from "../../../lib/format"

  let { instance }: { instance: Instance } = $props()

  let shaderPacks = $state<ModFileWithMetadata[]>([])
  let isLoadingShaderPacks = $state(true)
  let shaderPackSearchQuery = $state("")
  let alertModal = $state<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null>(null)

  $effect(() => {
    void instance.name
    loadShaderPacks()
  })

  async function loadShaderPacks() {
    isLoadingShaderPacks = true
    try {
      const packs = await invoke<ModFileWithMetadata[]>("get_installed_shaderpacks_with_metadata", { instanceName: instance.name })
      shaderPacks = packs
    } catch (error) {
      shaderPacks = []
    } finally {
      isLoadingShaderPacks = false
    }
  }

  async function handleDeleteShaderPack(filename: string) {
    const previous = shaderPacks
    shaderPacks = shaderPacks.filter(p => p.filename !== filename)
    try {
      await invoke("delete_shaderpack", { instanceName: instance.name, filename })
    } catch (error) {
      shaderPacks = previous
      alertModal = { isOpen: true, title: "Error", message: `Failed to delete shader pack: ${String(error)}`, type: "danger" }
    }
  }

  async function handleOpenShaderPacksFolder() {
    try {
      await invoke("open_shaderpacks_folder", { instanceName: instance.name })
    } catch {}
  }

  let filteredShaderPacks = $derived(
    shaderPacks.filter(pack => {
      if (!shaderPackSearchQuery.trim()) return true
      const query = shaderPackSearchQuery.toLowerCase()
      return (pack.name || pack.filename).toLowerCase().includes(query) || pack.filename.toLowerCase().includes(query)
    })
  )
</script>

<div class="flex-1 flex flex-col min-h-0 overflow-hidden">
  <div class="flex-shrink-0">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold text-[var(--text-primary)] tracking-tight">Shader Packs</h2>
        <span class="px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-xs rounded">{shaderPacks.length} pack{shaderPacks.length === 1 ? "" : "s"}</span>
      </div>
      <button onclick={handleOpenShaderPacksFolder} class="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded text-xs cursor-pointer">
        <ExternalLink size={14} /><span>Open Folder</span>
      </button>
    </div>
    <div class="relative mb-3">
      <Search size={14} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
      <input type="text" bind:value={shaderPackSearchQuery} placeholder="Search shader packs..." class="w-full bg-[var(--bg-tertiary)] rounded-md pl-8 pr-8 py-1.5 text-sm text-[var(--text-muted)] placeholder-[var(--text-muted)] focus:outline-none" />
      {#if shaderPackSearchQuery}
        <button onclick={() => shaderPackSearchQuery = ""} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-muted)] cursor-pointer"><X size={14} /></button>
      {/if}
    </div>
  </div>
  <div class="flex-1 overflow-y-auto min-h-0">
    {#if isLoadingShaderPacks}
      <div class="text-center py-16"><Loader2 size={32} class="animate-spin text-[#16a34a] mx-auto" /></div>
    {:else if shaderPacks.length === 0}
      <div class="flex flex-col items-center justify-center py-16">
        <Palette size={48} class="text-[#8b5cf6] mb-3" strokeWidth={1.5} />
        <h3 class="text-base font-semibold text-[var(--text-primary)] mb-1">No shader packs</h3>
        <p class="text-sm text-[var(--text-muted)]">Browse the addons tab to add shader packs</p>
      </div>
    {:else if filteredShaderPacks.length === 0}
      <div class="flex flex-col items-center justify-center py-16">
        <Search size={32} class="text-[var(--text-muted)] mb-3" strokeWidth={1.5} />
        <p class="text-sm text-[var(--text-muted)]">No shader packs match your search</p>
      </div>
    {:else}
      <div class="space-y-3 pr-1">
        {#each filteredShaderPacks as pack (pack.filename)}
          <div class="bg-[var(--bg-tertiary)] rounded-md overflow-hidden transition-all">
            <div class="flex min-h-0">
              {#if pack.icon_url}
                <div class="w-22 h-22 bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0 self-stretch">
                  <img src={pack.icon_url} alt={pack.name || pack.filename} class="w-full h-full object-contain" />
                </div>
              {:else}
                <div class="w-22 h-22 flex items-center justify-center flex-shrink-0 self-stretch">
                  <Palette size={36} class="text-[#8b5cf6]" strokeWidth={1.5} />
                </div>
              {/if}
              <div class="flex-1 min-w-0 py-2 px-4 flex items-center gap-3 relative z-0">
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold text-base text-[var(--text-primary)] truncate">{pack.name || pack.filename}</h3>
                  <p class="text-sm text-[var(--text-muted)] truncate">{pack.filename}</p>
                  <p class="text-sm text-[var(--text-muted)] mt-0.5">{formatFileSize(pack.size)}</p>
                </div>
                <div class="flex flex-col items-center gap-1 self-center">
                  <button onclick={() => handleDeleteShaderPack(pack.filename)} class="p-1 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 rounded cursor-pointer">
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
