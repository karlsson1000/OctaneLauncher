<script lang="ts">
  import type { ContentSource } from "../adapters"

  let { source, onSelect }: {
    source: ContentSource
    onSelect: (source: ContentSource) => void
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

<div class="relative" bind:this={rootEl}>
  <button
    data-source-button
    onclick={() => isOpen = !isOpen}
    class="w-10 h-10 flex items-center justify-center bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] rounded-md cursor-pointer"
  >
    <img
      src={source === "modrinth" ? "/modrinth.svg" : "/curseforge.svg"}
      alt={source}
      class="w-6 h-6"
    />
  </button>
  {#if isOpen}
    <div data-source-dropdown class="dropdown-menu absolute top-full mt-2 left-0 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-md overflow-hidden z-50 min-w-[140px] shadow-md p-1.5 flex flex-col gap-1">
      <button
        onclick={() => { onSelect("modrinth"); isOpen = false }}
        class="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm cursor-pointer {source === 'modrinth' ? 'bg-[#16a34a]/10 text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}"
      >
        <img src="/modrinth.svg" alt="Modrinth" class="w-6 h-6" />
        Modrinth
      </button>
      <button
        onclick={() => { onSelect("curseforge"); isOpen = false }}
        class="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm cursor-pointer {source === 'curseforge' ? 'bg-[#f97316]/20 text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}"
      >
        <img src="/curseforge.svg" alt="CurseForge" class="w-6 h-6" />
        CurseForge
      </button>
    </div>
  {/if}
</div>
