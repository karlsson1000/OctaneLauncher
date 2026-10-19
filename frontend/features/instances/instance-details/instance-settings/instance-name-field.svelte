<script lang="ts">
  import { invoke } from "@tauri-apps/api/core"
  import { Loader2 } from "lucide-svelte"
  import type { Instance } from "../../../../types"
  import { handleInstanceRenamed } from "../../../../lib/launcherStore.svelte"

  let { instance, onClose }: {
    instance: Instance
    onClose: () => void
  } = $props()

  let newName = $state("")
  let renameError = $state<string | null>(null)
  let isRenamingInstance = $state(false)

  $effect(() => {
    newName = instance.name
  })

  async function handleRename(trimmedName: string) {
    if (!trimmedName) { renameError = "Instance name cannot be empty"; return }
    if (trimmedName === instance.name) { renameError = null; return }
    isRenamingInstance = true
    try {
      await invoke("rename_instance", { oldName: instance.name, newName: trimmedName })
      renameError = null
      handleInstanceRenamed(instance.name, trimmedName)
      onClose()
    } catch (error) {
      renameError = error as string
      newName = instance.name
    } finally {
      isRenamingInstance = false
    }
  }
</script>

<div>
  <label for="instance-name-input" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Instance Name</label>
  <div class="relative">
    <input
      id="instance-name-input"
      type="text"
      bind:value={newName}
      oninput={() => renameError = null}
      onblur={(e) => { const trimmed = (e.target as HTMLInputElement).value.trim(); if (trimmed && trimmed !== instance.name) handleRename(trimmed) }}
      onkeydown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
      class="w-full bg-[var(--bg-tertiary)] rounded-sm px-4 py-3.5 pr-10 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none transition-all"
      placeholder="Enter instance name"
      disabled={isRenamingInstance}
    />
    {#if isRenamingInstance}
      <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <Loader2 size={14} class="animate-spin text-[var(--accent-primary)]" />
      </div>
    {/if}
  </div>
  {#if renameError}
    <p class="text-xs text-red-400 mt-2">{renameError}</p>
  {/if}
</div>
