<script lang="ts">
  import { Check, ChevronDown, ChevronUp, Loader2 } from "lucide-svelte"

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
    <div class="flex items-center gap-2 text-[var(--text-muted)] text-sm py-3.5 px-4 bg-[var(--bg-tertiary)] rounded-sm">
      <Loader2 size={16} class="animate-spin text-[var(--accent-primary)]" />
      <span>Loading...</span>
    </div>
  {:else}
    <div class="relative" bind:this={rootEl}>
      <button
        {id}
        type="button"
        onclick={() => isOpen = !isOpen}
        class="w-full bg-[var(--bg-tertiary)] px-4 py-3.5 pr-10 text-sm text-[var(--text-primary)] focus:outline-none text-left cursor-pointer {isOpen ? 'rounded-t-sm' : 'rounded-sm'}"
        {disabled}
      >
        {buttonText}
      </button>
      <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
        {#if updating}
          <Loader2 size={16} class="animate-spin text-[var(--accent-primary)]" />
        {:else if isOpen}
          <ChevronUp size={18} strokeWidth={3} />
        {:else}
          <ChevronDown size={18} strokeWidth={3} />
        {/if}
      </div>
      {#if isOpen}
        <div class="absolute z-10 w-full bg-[var(--bg-tertiary)] rounded-b-sm shadow-md max-h-60 overflow-y-auto custom-scrollbar border-t border-[var(--bg-elevated)]">
          {#each items as item (item.key)}
            <button
              type="button"
              onclick={() => { onSelect(item.key); isOpen = false }}
              class="w-full px-4 py-3 text-sm text-left hover:bg-[var(--bg-hover)] flex items-center justify-between cursor-pointer text-[var(--text-primary)]"
            >
              <span>{item.label}</span>
              {#if selectedKey === item.key}
                <Check size={17} class="text-[var(--accent-primary)]" strokeWidth={3} />
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
