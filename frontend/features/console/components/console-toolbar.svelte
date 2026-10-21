<script lang="ts">
  import { Search } from "lucide-svelte"

  let { instances, activeInstance, searchQuery = $bindable(""), onSelect }: {
    instances: string[]
    activeInstance: string | null
    searchQuery?: string
    onSelect: (instance: string) => void
  } = $props()
</script>

<div class="flex items-center justify-between mb-4">
  <div class="flex items-center gap-2">
    <div class="relative rounded-md bg-[var(--bg-tertiary)]">
      <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-20 pointer-events-none" strokeWidth={2} />
      <input
        type="text"
        placeholder="Search logs..."
        bind:value={searchQuery}
        class="w-72 bg-transparent rounded-md pl-9 pr-3 py-1.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition-all relative z-10"
      />
    </div>
  </div>

  <div class="flex items-center gap-2">
    {#if instances.length > 0}
      <div class="flex items-center gap-1.5 bg-[var(--bg-secondary)] rounded-lg p-0.5">
        {#each instances as instance (instance)}
          <button
            onclick={() => onSelect(instance)}
            class="px-3 py-1 rounded-md text-sm font-medium whitespace-nowrap cursor-pointer {activeInstance === instance ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}"
          >
            {instance}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
