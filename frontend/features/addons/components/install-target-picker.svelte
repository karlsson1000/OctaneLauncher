<script lang="ts">
  import { Check, ChevronUp, Package } from "lucide-svelte"
  import type { Instance } from "../../../types"
  import { getMinecraftVersion } from "../../../lib/version"
  import { instanceIconSrc } from "../../../lib/icons"

  let { selectedInstance, instances, onSelect }: {
    selectedInstance: Instance | null
    instances: Instance[]
    onSelect: (instance: Instance) => void
  } = $props()

  let isOpen = $state(false)
  let rootEl = $state<HTMLDivElement | undefined>(undefined)

  const moddedInstances = $derived(
    instances.filter(i => i.loader === "fabric" || i.loader === "neoforge" || i.loader === "forge")
  )

  function getLoaderDisplay(instance: Instance): { name: string; color: string } {
    if (instance.loader === "fabric") return { name: "Fabric", color: "text-[#3b82f6]" }
    if (instance.loader === "neoforge") return { name: "NeoForge", color: "text-[#f97316]" }
    return { name: "Forge", color: "text-[#e05d2e]" }
  }

  $effect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootEl && !rootEl.contains(event.target as Node)) isOpen = false
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  })
</script>

<div class="absolute bottom-4 right-4 z-30" bind:this={rootEl}>
  {#if isOpen}
    <div role="menu" class="dropdown-menu absolute bottom-full right-0 mb-1.5 z-[60] w-64 min-w-[190px] bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] shadow-md rounded-md overflow-hidden p-1.5 flex flex-col max-h-60 overflow-y-auto custom-scrollbar">
      {#if moddedInstances.length === 0}
        <p class="text-xs text-[var(--text-muted)] px-1">No modded instances</p>
      {:else}
        <div class="flex flex-col">
          {#each moddedInstances as instance}
            {@const icon = instanceIconSrc(instance.icon_path, instance.name)}
            {@const loader = getLoaderDisplay(instance)}
            {@const selected = selectedInstance?.name === instance.name}
            <button
              onclick={() => { onSelect(instance); isOpen = false }}
              class="w-full flex items-center text-left text-sm cursor-pointer text-[var(--text-primary)] gap-2.5 px-2 py-2 rounded-sm select-none hover:bg-[var(--bg-hover)]"
            >
              {#if icon}
                <img src={icon} alt={instance.name} class="w-8 h-8 rounded object-cover flex-shrink-0" />
              {:else}
                <div class="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <Package size={20} class="text-[var(--text-muted)]" strokeWidth={1.5} />
                </div>
              {/if}
              <div class="flex-1 min-w-0">
                <div class="font-medium text-sm text-[var(--text-primary)] truncate leading-tight">{instance.name}</div>
                <div class="text-xs text-[var(--text-muted)] truncate mt-0.5">
                  {getMinecraftVersion(instance)} <span class="text-[var(--text-muted)]">•</span> <span class={loader.color}>{loader.name}</span>
                </div>
              </div>
              {#if selected}
                <Check size={18} class="flex-shrink-0 text-[#16a34a]" strokeWidth={3} />
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
  <button
    onclick={() => isOpen = !isOpen}
    class="flex items-center gap-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 hover:bg-[var(--bg-hover)] cursor-pointer"
  >
    {#if selectedInstance}
      {@const selectedIcon = instanceIconSrc(selectedInstance.icon_path, selectedInstance.name)}
      {#if selectedIcon}
        <img src={selectedIcon} alt={selectedInstance.name} class="w-9 h-9 rounded object-cover flex-shrink-0" />
      {:else}
        <div class="w-9 h-9 flex items-center justify-center flex-shrink-0">
          <Package size={26} class="text-[var(--text-muted)]" />
        </div>
      {/if}
      <div class="text-left">
        <div class="text-xs leading-tight text-[var(--text-muted)]">Install to</div>
        <div class="text-[15px] font-semibold text-[var(--text-primary)] max-w-[180px] truncate leading-tight">{selectedInstance.name}</div>
      </div>
    {:else}
      <Package size={22} class="text-[var(--text-muted)] ml-2" />
      <span class="text-[15px] font-medium text-[var(--text-secondary)]">Select instance</span>
    {/if}
    <ChevronUp size={18} strokeWidth={3} class="text-[var(--text-secondary)] ml-0.5 transition-transform {isOpen ? 'rotate-180' : ''}" />
  </button>
</div>
