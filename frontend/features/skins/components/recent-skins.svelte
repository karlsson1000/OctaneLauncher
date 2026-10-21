<script lang="ts">
  import type { RecentSkin } from "../../../types"

  let { recentSkins, uploading, onSelect }: {
    recentSkins: RecentSkin[]
    uploading: boolean
    onSelect: (skin: RecentSkin) => void
  } = $props()
</script>

{#if recentSkins.length > 0}
  <div class="flex items-center gap-1 bg-[var(--bg-elevated)]/95 backdrop-blur-md rounded-lg px-3 py-2 flex-shrink-0">
    {#each recentSkins as skin}
      {@const match = skin.url.match(/texture\/([a-f0-9]+)/)}
      {@const hash = match ? match[1] : null}
      {@const bustUrl = hash ? `https://renders.stellarmc.gg/bust/${hash}${skin.variant === "slim" ? "?slim" : ""}` : skin.url}
      <button
        onclick={() => onSelect(skin)}
        disabled={uploading}
        title="Apply recent skin"
        class="box-border w-10 h-10 rounded-md p-0 border-2 border-transparent hover:border-[var(--text-muted)] overflow-hidden bg-transparent shrink-0 enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
      >
        <img
          src={bustUrl}
          alt="Recent skin"
          draggable={false}
          class="w-full h-full object-cover block"
          style="image-rendering: pixelated"
        />
      </button>
    {/each}
  </div>
{/if}
