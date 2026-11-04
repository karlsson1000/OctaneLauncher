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

  let trimmedName = $derived(newName.trim())
  let isDirty = $derived(trimmedName !== instance.name)
  let canSave = $derived(isDirty && !!trimmedName && !isRenamingInstance)

  $effect(() => {
    newName = instance.name
  })

  async function handleRename() {
    if (!canSave) return
    isRenamingInstance = true
    try {
      await invoke("rename_instance", { oldName: instance.name, newName: trimmedName })
      renameError = null
      handleInstanceRenamed(instance.name, trimmedName)
      onClose()
    } catch (error) {
      renameError = String(error)
    } finally {
      isRenamingInstance = false
    }
  }
</script>

<div>
  <label for="instance-name-input" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Instance Name</label>
  <div class="flex items-center gap-2">
    <input
      id="instance-name-input"
      type="text"
      autocomplete="off"
      bind:value={newName}
      oninput={() => renameError = null}
      onkeydown={(e) => { if (e.key === "Enter") handleRename() }}
      class="min-w-0 flex-1 bg-[var(--bg-tertiary)] rounded-md px-3 py-[9px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition-all"
      placeholder="Enter instance name"
      disabled={isRenamingInstance}
    />
    {#if isDirty}
      <button
        onclick={handleRename}
        disabled={!canSave}
        class="relative shrink-0 px-3 h-[38px] bg-[var(--accent-primary)] text-white rounded-md font-medium text-sm flex items-center justify-center cursor-pointer transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span class:invisible={isRenamingInstance}>Save</span>
        {#if isRenamingInstance}
          <span class="absolute inset-0 flex items-center justify-center">
            <Loader2 size={14} class="animate-spin" />
          </span>
        {/if}
      </button>
    {/if}
  </div>
  {#if renameError}
    <p class="text-xs text-red-400 mt-2">{renameError}</p>
  {:else if !trimmedName}
    <p class="text-xs text-red-400 mt-2">Instance name cannot be empty</p>
  {/if}
</div>
