<script lang="ts">
  import { invoke } from "@tauri-apps/api/core"
  import { Loader2, Trash2 } from "lucide-svelte"

  let { onAlert }: { onAlert: (alert: any) => void } = $props()

  let count = $state(0)
  let totalSize = $state(0)
  let loading = $state(false)
  let emptying = $state(false)
  let confirmClear = $state(false)

  async function loadTrash() {
    loading = true
    try {
      const [c, s] = await invoke<[number, number]>("get_trash_size")
      count = c
      totalSize = s
    } catch {
      count = 0
      totalSize = 0
    }
    loading = false
  }

  $effect(() => { loadTrash() })

  async function handleEmptyTrash() {
    if (!confirmClear) {
      confirmClear = true
      setTimeout(() => confirmClear = false, 3000)
      return
    }
    emptying = true
    try {
      await invoke("empty_trash")
      count = 0
      totalSize = 0
      confirmClear = false
    } catch (e) {
      onAlert({ isOpen: true, title: "Error", message: `Failed to empty trash: ${e}`, type: "danger" })
    }
    emptying = false
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }
</script>

<div class="space-y-2">
  <div class="flex items-center gap-2 text-[var(--text-primary)]">
    <Trash2 size={16} class="text-red-400" />
    <span class="font-medium text-sm">Trash</span>
  </div>
  <div class="bg-[var(--bg-elevated)] rounded p-3 space-y-2">
    {#if loading}
      <div class="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <Loader2 size={14} class="animate-spin" />
        <span>Loading trash...</span>
      </div>
    {:else if count === 0}
      <p class="text-xs text-[var(--text-muted)]">Trash is empty</p>
    {:else}
      <div class="flex items-center justify-between">
        <span class="text-xs text-[var(--text-muted)]">
          {count} item{count !== 1 ? "s" : ""} ({formatBytes(totalSize)})
        </span>
        <button
          onclick={handleEmptyTrash}
          disabled={emptying}
          class="px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 {confirmClear ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10'}"
        >
          {#if emptying}
            <Loader2 size={12} class="animate-spin" />
          {:else if confirmClear}
            Click again to confirm
          {:else}
            Empty Trash
          {/if}
        </button>
      </div>
    {/if}
  </div>
</div>
