<script lang="ts">
  import { Search, ChevronDown, Check, LayoutGrid, List, ListChecks, Plus, Trash2, X } from "lucide-svelte"
  import { handleCreateNew } from "../../../lib/launcherStore.svelte"
  import { SORT_LABELS, SORT_OPTIONS, type SortOption } from "./sort"

  let { searchQuery = $bindable(), sortBy = $bindable(), layout, hasInstances, selectMode, selectedCount, allVisibleSelected, onToggleSelectAll, onDeleteSelected, onExitSelect, onSelectMode, onLayoutChange }: {
    searchQuery: string
    sortBy: SortOption
    layout: "list" | "grid"
    hasInstances: boolean
    selectMode: boolean
    selectedCount: number
    allVisibleSelected: boolean
    onToggleSelectAll: () => void
    onDeleteSelected: () => void
    onExitSelect: () => void
    onSelectMode: () => void
    onLayoutChange: (layout: "list" | "grid") => void
  } = $props()

  let isSortDropdownOpen = $state(false)
  let sortDropdownRef = $state<HTMLDivElement | undefined>(undefined)

  $effect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortDropdownRef && !sortDropdownRef.contains(event.target as Node)) isSortDropdownOpen = false
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  })
</script>

<div class="flex items-center justify-between mb-4">
  <div class="flex items-center gap-2">
    {#if hasInstances}
      <div class="relative rounded-md bg-[var(--bg-tertiary)]">
        <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-20 pointer-events-none" strokeWidth={2} />
        <input
          type="text"
          placeholder="Search instances..."
          bind:value={searchQuery}
          class="w-72 bg-transparent rounded-md pl-9 pr-3 py-1.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition-all relative z-10"
        />
      </div>
    {/if}
  </div>
  <div class="flex items-center gap-2">
    {#if selectMode}
      <span class="text-sm text-[var(--text-muted)] font-medium whitespace-nowrap">{selectedCount} selected</span>
      <button
        onclick={onToggleSelectAll}
        class="h-8 px-3 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-sm text-[var(--text-primary)] cursor-pointer"
      >
        {allVisibleSelected ? "Clear" : "Select all"}
      </button>
      <button
        onclick={onDeleteSelected}
        disabled={selectedCount === 0}
        class="h-8 px-3 rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 text-sm font-medium flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Trash2 size={16} strokeWidth={2.5} />
        Delete
      </button>
      <button
        onclick={onExitSelect}
        title="Cancel selection"
        class="h-8 w-8 rounded-md flex items-center justify-center cursor-pointer text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      >
        <X size={18} strokeWidth={2.5} />
      </button>
    {:else}
      {#if hasInstances}
        <div class="relative" bind:this={sortDropdownRef}>
          <button
            onclick={() => isSortDropdownOpen = !isSortDropdownOpen}
            class="relative h-8 pl-3 pr-8 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] rounded-md flex items-center gap-1.5 cursor-pointer"
          >
            <span class="text-sm text-[var(--text-muted)] font-medium whitespace-nowrap">Sort by:</span>
            <span class="text-sm text-[var(--text-primary)] font-semibold whitespace-nowrap">{SORT_LABELS[sortBy]}</span>
            <span class="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-secondary)]">
              <ChevronDown size={16} strokeWidth={3} class="transition-transform {isSortDropdownOpen ? 'rotate-180' : ''}" />
            </span>
          </button>
          {#if isSortDropdownOpen}
            <div role="menu" class="dropdown-menu drop-right absolute right-0 z-[60] w-full min-w-[180px] bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] shadow-md rounded-md overflow-hidden p-1.5 flex flex-col mt-1.5">
              {#each SORT_OPTIONS as option (option)}
                <button
                  type="button"
                  role="menuitem"
                  onclick={() => { sortBy = option; isSortDropdownOpen = false }}
                  class="w-full flex items-center justify-between gap-2.5 px-2 py-2 text-sm text-left rounded-sm cursor-pointer select-none text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                >
                  <span class="truncate min-w-0">{SORT_LABELS[option]}</span>
                  {#if sortBy === option}
                    <Check size={15} strokeWidth={3} class="text-[var(--accent-primary)] shrink-0 ml-2" />
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
        <div class="grid grid-cols-2 gap-1 p-0.5 rounded-md bg-[var(--bg-tertiary)]">
          <button
            onclick={() => onLayoutChange("list")}
            title="List view"
            class="h-7 w-8 rounded-sm flex items-center justify-center cursor-pointer {layout === 'list' ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
          >
            <List size={18} strokeWidth={2.5} />
          </button>
          <button
            onclick={() => onLayoutChange("grid")}
            title="Grid view"
            class="h-7 w-8 rounded-sm flex items-center justify-center cursor-pointer {layout === 'grid' ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
          >
            <LayoutGrid size={18} strokeWidth={2.5} />
          </button>
        </div>
        <button
          onclick={onSelectMode}
          title="Select instances"
          class="h-8 w-8 rounded-md flex items-center justify-center cursor-pointer text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <ListChecks size={18} strokeWidth={2.5} />
        </button>
      {/if}
      <button
        onclick={handleCreateNew}
        class="px-4 h-8 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-md text-sm font-medium flex items-center gap-2 cursor-pointer"
      >
        <Plus size={16} />
        New
      </button>
    {/if}
  </div>
</div>
