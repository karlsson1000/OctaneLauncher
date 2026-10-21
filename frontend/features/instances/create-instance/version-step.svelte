<script lang="ts">
  import type { MinecraftVersion } from "./constants"
  import CreateDropdown from "./create-dropdown.svelte"
  import StatusBox from "./status-box.svelte"

  let { filteredVersions, selectedVersion, versionFilter, isLoadingVersions, isCreating, onFilterChange, onSelect }: {
    filteredVersions: MinecraftVersion[]
    selectedVersion: string
    versionFilter: "release" | "snapshot"
    isLoadingVersions: boolean
    isCreating: boolean
    onFilterChange: (filter: "release" | "snapshot") => void
    onSelect: (versionId: string) => void
  } = $props()

  let mcOptions = $derived(filteredVersions.map((v) => ({ value: v.id, label: v.id })))
</script>

<div class="flex-1 min-h-0 flex flex-col">
  <div>
    <label for="create-mc-btn" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Choose a Minecraft version</label>
    <div class="grid grid-cols-2 gap-1 p-1 rounded-md bg-[var(--bg-tertiary)] mb-3">
      <button
        type="button"
        onclick={() => onFilterChange("release")}
        disabled={isCreating}
        class="h-8 rounded-sm text-sm font-medium cursor-pointer disabled:cursor-not-allowed {versionFilter === 'release' ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
      >
        Releases
      </button>
      <button
        type="button"
        onclick={() => onFilterChange("snapshot")}
        disabled={isCreating}
        class="h-8 rounded-sm text-sm font-medium cursor-pointer disabled:cursor-not-allowed {versionFilter === 'snapshot' ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
      >
        Snapshots
      </button>
    </div>

    {#if isLoadingVersions}
      <StatusBox kind="loading" text="Loading versions..." />
    {:else if filteredVersions.length === 0}
      <StatusBox kind="empty" text="No versions available" />
    {:else}
      <CreateDropdown id="mc" options={mcOptions} selected={selectedVersion} display={selectedVersion} onPick={onSelect} listHeight="max-h-64" />
    {/if}
  </div>
</div>
