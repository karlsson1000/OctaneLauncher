<script lang="ts">
  import { Loader2, Plane, RectangleVertical } from "lucide-svelte"
  import type { Cape } from "../../../types"

  let { capes, activeCape, loadingCapes, activeCapeUrl, showElytra, onSelect, onRemove, onToggleElytra }: {
    capes: Cape[]
    activeCape: string | null
    loadingCapes: boolean
    activeCapeUrl: string | null
    showElytra: boolean
    onSelect: (capeId: string) => void
    onRemove: () => void
    onToggleElytra: () => void
  } = $props()
</script>

{#if loadingCapes || capes.length > 0}
  {#if loadingCapes}
    <div class="flex items-center gap-1">
      <Loader2 size={14} class="animate-spin text-[var(--text-muted)]" />
      <span class="text-[11px] text-[var(--text-muted)]">Capes…</span>
    </div>
  {:else if capes.length === 0}
    <span class="text-[11px] text-[var(--text-muted)]">No capes</span>
  {:else}
    <div class="flex items-center gap-[3px]">
      {#each capes as cape (cape.id)}
        {@const isActive = activeCape === cape.id}
        <div
          role="button"
          tabindex="0"
          title={cape.alias}
          onclick={() => isActive ? onRemove() : onSelect(cape.id)}
          onkeydown={(e) => { if (e.key === 'Enter') isActive ? onRemove() : onSelect(cape.id) }}
          class="group cursor-pointer shrink-0 leading-none"
        >
          <div class="w-[26px] h-[38px] rounded border-2 border-transparent group-hover:border-[var(--text-muted)] overflow-hidden bg-[var(--bg-secondary)] relative flex items-center justify-center">
            <div class="w-[20px] h-[32px] overflow-hidden shrink-0">
              <img
                src={cape.url}
                alt={cape.alias}
                draggable={false}
                class="block w-[128px] max-w-none h-auto ml-[-2px] mt-[-2px] [image-rendering:pixelated]"
                onerror={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = '/logo.png' }}
              />
            </div>
            {#if isActive}
              <div class="absolute inset-0 flex items-center justify-center bg-black/45">
                <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="group-hover:stroke-[#ef4444]" />
                </svg>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if activeCapeUrl}
    <button
      onclick={onToggleElytra}
      title={showElytra ? "Show as cape" : "Show as elytra"}
      class="flex items-center justify-center w-8 h-8 rounded-md bg-transparent hover:bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-pointer shrink-0"
    >
      {#if showElytra}
        <RectangleVertical size={22} strokeWidth={2.5} />
      {:else}
        <Plane size={22} strokeWidth={2.5} />
      {/if}
    </button>
  {/if}
{/if}
