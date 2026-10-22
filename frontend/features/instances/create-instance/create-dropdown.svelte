<script lang="ts">
  import { Check, ChevronDown } from "lucide-svelte"

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
    aria-haspopup="menu"
    aria-expanded={isOpen}
    class="w-full h-9 pl-3 pr-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-sm text-[var(--text-primary)] rounded-md flex items-center justify-between gap-2 cursor-pointer text-left"
    {disabled}
  >
    <span class="truncate">{display}</span>
    <ChevronDown
      size={16}
      strokeWidth={3}
      class="shrink-0 text-[var(--text-secondary)] transition-transform {isOpen ? 'rotate-180' : ''}"
    />
  </button>

  {#if isOpen}
    <div
      role="menu"
      class="dropdown-menu absolute z-[60] w-full min-w-[190px] bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] shadow-md rounded-md overflow-hidden p-1.5 flex flex-col mt-1.5 {listHeight} overflow-y-auto custom-scrollbar"
    >
      {#each options as option (option.value)}
        <button
          type="button"
          role="menuitem"
          onclick={() => { onPick(option.value); isOpen = false }}
          class="w-full flex items-center justify-between gap-2.5 px-2 py-2 text-sm text-left rounded-sm cursor-pointer select-none text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        >
          <span class="truncate min-w-0">{option.label}</span>
          {#if selected === option.value}
            <Check size={17} strokeWidth={3} class="text-[var(--accent-primary)] shrink-0 ml-2" />
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
