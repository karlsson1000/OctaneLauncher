<script lang="ts">
  import { invoke } from "@tauri-apps/api/core"
  import { FolderOpen, Loader2 } from "lucide-svelte"
  import { store } from "../../../lib/launcherStore.svelte"
  import type { StorageCategory } from "../../../types"
  import { formatFileSize } from "../../../lib/format"
  import TrashSection from "./trash-section.svelte"

  let { onAlert }: {
    onAlert: (alert: { isOpen: boolean; title: string; message: string; type: "warning" | "danger" | "success" | "info" }) => void
  } = $props()

  let storageCategories: StorageCategory[] = $state([])
  let storageLoading = $state(false)

  let totalBytes = $derived(storageCategories.reduce((sum, c) => sum + c.size_bytes, 0))

  const storageColors: Record<string, string> = {
    Instances: "#3b82f6",
    Cache: "#f59e0b",
    Trash: "#ef4444",
    Other: "#6b7280",
  }

  async function loadStorageUsage() {
    storageLoading = true
    try {
      const data = await invoke<StorageCategory[]>("get_storage_usage")
      storageCategories = data
    } catch {} finally {
      storageLoading = false
    }
  }

  async function handleOpenDirectory(path: string) {
    try {
      await invoke("open_directory", { path })
    } catch (error) {
      onAlert({ isOpen: true, title: "An error occurred", message: "Failed to open directory" + `: ${error}`, type: "danger" })
    }
  }

  $effect(() => { loadStorageUsage() })
</script>

<section class="rounded-md bg-[var(--bg-tertiary)] p-4">
  <h4 class="text-sm font-medium text-[var(--text-primary)] leading-tight mb-3">Disk usage</h4>
  {#if storageLoading}
    <div class="flex items-center gap-2 text-xs text-[var(--text-muted)]">
      <Loader2 size={14} class="animate-spin" />
      <span>Calculating storage usage...</span>
    </div>
  {:else if storageCategories.length === 0}
    <div class="text-xs text-[var(--text-muted)]">No data</div>
  {:else}
    <div class="h-2 rounded-full overflow-hidden flex bg-[var(--content-bg)]">
      {#each storageCategories as cat (cat.name)}
        <div
          style="width: {(cat.size_bytes / totalBytes) * 100}%; background-color: {storageColors[cat.name] || '#6b7280'}"
          class="h-full first:rounded-l-full last:rounded-r-full"
        ></div>
      {/each}
    </div>
    <div class="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
      {#each storageCategories as cat (cat.name)}
        <div class="flex items-center gap-1.5 text-xs">
          <div class="w-2.5 h-2.5 rounded-sm" style="background-color: {storageColors[cat.name] || '#6b7280'}"></div>
          <span class="text-[var(--text-muted)]">{cat.name}</span>
          <span class="text-[var(--text-primary)] font-medium">{formatFileSize(cat.size_bytes)}</span>
        </div>
      {/each}
    </div>
  {/if}
</section>

<section class="rounded-md bg-[var(--bg-tertiary)] px-4 py-1.5">
  <div class="flex items-center gap-3 py-2.5">
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-[var(--text-primary)] leading-tight">Game directory</p>
      <p class="text-xs text-[var(--text-muted)] font-mono break-all mt-0.5">{store.launcherDirectory || "Loading..."}</p>
    </div>
    <button
      onclick={() => handleOpenDirectory(store.launcherDirectory)}
      disabled={!store.launcherDirectory}
      class="h-8 px-3 shrink-0 text-sm font-medium rounded-md bg-[var(--content-bg)] hover:bg-[var(--bg-hover)] disabled:opacity-50 text-[var(--text-primary)] cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
    >
      <FolderOpen size={14} />
      Open folder
    </button>
  </div>
</section>

<section class="rounded-md bg-[var(--bg-tertiary)] p-4">
  <TrashSection onAlert={onAlert} />
</section>
