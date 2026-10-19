<script lang="ts">
  import { Loader2, Plane, RectangleVertical } from "lucide-svelte"
  import type { Cape } from "../../../types"

  const CAPE_TEX_W = 64
  const CAPE_FRONT = { x: 1, y: 1, w: 10, h: 16 }
  const CAPE_THUMB_SCALE = 2

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
    <div style="display: flex; align-items: center; gap: 4px;">
      <Loader2 size={14} style="animation: spin 1s linear infinite; color: var(--text-muted);" />
      <span style="font-size: 11px; color: var(--text-muted);">Capes…</span>
    </div>
  {:else if capes.length === 0}
    <span style="font-size: 11px; color: var(--text-muted);">No capes</span>
  {:else}
    <div style="display: flex; align-items: center; gap: 3px;">
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
            <div style="width: {CAPE_FRONT.w * CAPE_THUMB_SCALE}px; height: {CAPE_FRONT.h * CAPE_THUMB_SCALE}px; overflow: hidden; flex-shrink: 0;">
              <img
                src={cape.url}
                alt={cape.alias}
                draggable={false}
                style="width: {CAPE_TEX_W * CAPE_THUMB_SCALE}px; max-width: none; height: auto; margin-left: {-CAPE_FRONT.x * CAPE_THUMB_SCALE}px; margin-top: {-CAPE_FRONT.y * CAPE_THUMB_SCALE}px; image-rendering: pixelated; display: block;"
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
