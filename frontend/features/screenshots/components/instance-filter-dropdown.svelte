<script lang="ts">
  import { ChevronDown, Check } from "lucide-svelte"

  let { activeInstance, instanceCounts, sortedInstances, total, onSelect }: {
    activeInstance: string | null
    instanceCounts: Record<string, number>
    sortedInstances: [string, number][]
    total: number
    onSelect: (name: string | null) => void
  } = $props()

  let isDropdownOpen = $state(false)
  let dropdownEl = $state<HTMLDivElement | undefined>(undefined)

  function selectInstance(name: string | null) {
    onSelect(name)
    isDropdownOpen = false
  }

  $effect(() => {
    if (!isDropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (dropdownEl && !dropdownEl.contains(e.target as Node)) isDropdownOpen = false
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  })

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && isDropdownOpen) isDropdownOpen = false
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#snippet instanceOption(label: string, value: string | null)}
  <button
    type="button"
    role="menuitem"
    onclick={() => selectInstance(value)}
    class="w-full flex items-center justify-between gap-2.5 px-2 py-2 text-sm text-left rounded-sm cursor-pointer select-none text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
  >
    <span class="truncate min-w-0">{label}</span>
    {#if activeInstance === value}
      <Check size={15} strokeWidth={3} class="text-[var(--accent-primary)] shrink-0 ml-2" />
    {/if}
  </button>
{/snippet}

<div class="relative" bind:this={dropdownEl}>
  <button
    type="button"
    onclick={() => (isDropdownOpen = !isDropdownOpen)}
    aria-haspopup="menu"
    aria-expanded={isDropdownOpen}
    class="h-8 pl-3 pr-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-sm text-[var(--text-primary)] rounded-md flex items-center gap-2 cursor-pointer"
  >
    <span class="truncate">
      {activeInstance ? `${activeInstance} (${instanceCounts[activeInstance]})` : `All Instances (${total})`}
    </span>
    <ChevronDown
      size={16}
      strokeWidth={3}
      class="shrink-0 text-[var(--text-secondary)] transition-transform {isDropdownOpen ? 'rotate-180' : ''}"
    />
  </button>

  {#if isDropdownOpen}
    <div
      role="menu"
      class="dropdown-menu absolute left-1/2 -translate-x-1/2 z-[60] w-full min-w-[190px] bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] shadow-md rounded-md overflow-hidden p-1.5 flex flex-col mt-1.5 max-h-60 overflow-y-auto custom-scrollbar"
    >
      {@render instanceOption(`All Instances (${total})`, null)}
      {#each sortedInstances as [name, count] (name)}
        {@render instanceOption(`${name} (${count})`, name)}
      {/each}
    </div>
  {/if}
</div>
