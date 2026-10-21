<script lang="ts">
  import { Check, ChevronDown, ChevronUp } from "lucide-svelte"

  let { id, options, selected, display, onPick, listHeight = "max-h-48", disabled = false }: {
    id: string
    options: { value: string; label: string }[]
    selected: string
    display: string
    onPick: (value: string) => void
    listHeight?: string
    disabled?: boolean
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

<div class="relative" bind:this={rootEl} data-dropdown>
  <button
    id="create-{id}-btn"
    type="button"
    onclick={() => isOpen = !isOpen}
    class="w-full bg-[var(--bg-tertiary)] px-4 py-3.5 pr-10 text-sm text-[var(--text-primary)] focus:outline-none text-left cursor-pointer {isOpen ? 'rounded-t-sm' : 'rounded-sm'}"
    {disabled}
  >
    {display}
  </button>
  <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
    {#if isOpen}
      <ChevronUp size={18} strokeWidth={3} />
    {:else}
      <ChevronDown size={18} strokeWidth={3} />
    {/if}
  </div>

  {#if isOpen}
    <div class="absolute z-10 w-full bg-[var(--bg-tertiary)] rounded-b-sm shadow-md {listHeight} overflow-y-auto custom-scrollbar border-t border-[var(--bg-elevated)]">
      {#each options as option (option.value)}
        <button
          type="button"
          onclick={() => { onPick(option.value); isOpen = false }}
          class="w-full px-4 py-3 text-sm text-left hover:bg-[var(--bg-hover)] flex items-center justify-between cursor-pointer text-[var(--text-primary)]"
        >
          <span>{option.label}</span>
          {#if selected === option.value}
            <Check size={17} class="text-[var(--accent-primary)]" strokeWidth={3} />
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
