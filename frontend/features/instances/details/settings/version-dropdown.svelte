<script lang="ts">
  import { Check, ChevronDown, Loader2 } from "lucide-svelte"

  let { id, label, loading, updating, disabled = false, buttonText, items, selectedKey, onSelect }: {
    id: string
    label: string
    loading: boolean
    updating: boolean
    disabled?: boolean
    buttonText: string
    items: Array<{ key: string; label: string }>
    selectedKey: string
    onSelect: (key: string) => void
  } = $props()

  let isOpen = $state(false)
  let rootEl = $state<HTMLDivElement | undefined>(undefined)

  $effect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootEl && !rootEl.contains(event.target as Node)) isOpen = false
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  })
</script>

<div>
  <label for={id} class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">{label}</label>
  {#if loading}
    <div class="flex items-center gap-2 text-[var(--text-muted)] text-sm py-[9px] px-3 bg-[var(--bg-tertiary)] rounded-md">
      <Loader2 size={16} class="animate-spin text-[var(--accent-primary)]" />
      <span>Loading...</span>
    </div>
  {:else}
    <div class="relative" bind:this={rootEl}>
      <button
        {id}
        type="button"
        onclick={() => isOpen = !isOpen}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        class="w-full h-[38px] pl-3 pr-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-sm text-[var(--text-primary)] rounded-md flex items-center justify-between gap-2 cursor-pointer text-left"
        {disabled}
      >
        <span class="truncate">{buttonText}</span>
        {#if updating}
          <Loader2 size={16} class="shrink-0 animate-spin text-[var(--accent-primary)]" />
        {:else}
          <ChevronDown
            size={16}
            strokeWidth={3}
            class="shrink-0 text-[var(--text-secondary)] transition-transform {isOpen ? 'rotate-180' : ''}"
          />
        {/if}
      </button>

      {#if isOpen}
        <div
          role="menu"
          class="dropdown-menu absolute z-[60] w-full min-w-[190px] bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] shadow-md rounded-md overflow-hidden p-1.5 flex flex-col mt-1.5 max-h-60 overflow-y-auto custom-scrollbar"
        >
          {#each items as item (item.key)}
            <button
              type="button"
              role="menuitem"
              onclick={() => { onSelect(item.key); isOpen = false }}
              class="w-full flex items-center justify-between gap-2.5 px-2 py-2 text-sm text-left rounded-sm cursor-pointer select-none text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <span class="truncate min-w-0">{item.label}</span>
              {#if selectedKey === item.key}
                <Check size={17} strokeWidth={3} class="text-[var(--accent-primary)] shrink-0 ml-2" />
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
