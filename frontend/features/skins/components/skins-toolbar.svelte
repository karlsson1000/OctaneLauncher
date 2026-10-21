<script lang="ts">
  import { Upload, Loader2, RotateCcw, Save } from "lucide-svelte"
  import type { Cape, RecentSkin } from "../../../types"
  import CapeBar from "./cape-bar.svelte"
  import RecentSkins from "./recent-skins.svelte"

  let {
    uploading, loading, skinVariant, capes, activeCape, loadingCapes, activeCapeUrl,
    showElytra, recentSkins, hasPendingChanges, saving,
    onUploadClick, onReset, onSelectVariant, onCapeSelect, onCapeRemove, onToggleElytra,
    onRecentSelect, onSave, onDiscard,
  }: {
    uploading: boolean
    loading: boolean
    skinVariant: "classic" | "slim"
    capes: Cape[]
    activeCape: string | null
    loadingCapes: boolean
    activeCapeUrl: string | null
    showElytra: boolean
    recentSkins: RecentSkin[]
    hasPendingChanges: boolean
    saving: boolean
    onUploadClick: () => void
    onReset: () => void
    onSelectVariant: (variant: "classic" | "slim") => void
    onCapeSelect: (capeId: string) => void
    onCapeRemove: () => void
    onToggleElytra: () => void
    onRecentSelect: (skin: RecentSkin) => void
    onSave: () => void
    onDiscard: () => void
  } = $props()
</script>

<div
  role="presentation"
  onpointerdown={(e) => e.stopPropagation()}
  class="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 max-w-[calc(100%-4rem)] flex-wrap justify-center"
>
  <div class="flex items-center gap-2 bg-[var(--bg-elevated)]/95 backdrop-blur-md rounded-lg px-3 py-2 justify-center">
    <button
      onclick={onUploadClick}
      disabled={uploading || loading}
      title="Upload skin"
      class="flex items-center justify-center w-8 h-8 rounded-md bg-transparent text-[#16a34a] shrink-0 enabled:hover:bg-[var(--bg-hover)] enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
    >
      {#if uploading}
        <Loader2 size={20} class="animate-spin" />
      {:else}
        <Upload size={20} strokeWidth={2.5} />
      {/if}
    </button>

    <button
      onclick={onReset}
      disabled={loading}
      title="Reset to default skin"
      class="flex items-center justify-center w-8 h-8 rounded-md bg-transparent text-[var(--text-muted)] shrink-0 enabled:hover:bg-[var(--bg-hover)] enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
    >
      <RotateCcw size={20} strokeWidth={2.5} />
    </button>

    <button
      onclick={() => onSelectVariant("classic")}
      class="px-3 h-8 inline-flex items-center justify-center rounded-md text-[13px] font-semibold whitespace-nowrap cursor-pointer shrink-0 {skinVariant === 'classic' ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}"
    >
      Classic
    </button>
    <button
      onclick={() => onSelectVariant("slim")}
      class="px-3 h-8 inline-flex items-center justify-center rounded-md text-[13px] font-semibold whitespace-nowrap cursor-pointer shrink-0 {skinVariant === 'slim' ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}"
    >
      Slim
    </button>

    <CapeBar
      {capes}
      {activeCape}
      {loadingCapes}
      {activeCapeUrl}
      {showElytra}
      onSelect={onCapeSelect}
      onRemove={onCapeRemove}
      onToggleElytra={onToggleElytra}
    />

    {#if hasPendingChanges}
      <div class="flex gap-2 ml-auto shrink-0">
        <button
          onclick={onDiscard}
          disabled={saving}
          class="px-4 h-8 inline-flex items-center justify-center rounded-md bg-[var(--bg-secondary)] text-[var(--text-muted)] text-[13px] font-semibold shrink-0 enabled:hover:bg-[var(--bg-hover)] enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onclick={onSave}
          disabled={saving}
          class="px-4 h-8 rounded-md bg-[#16a34a] enabled:hover:bg-[#15803d] text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 shrink-0 enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
        >
          {#if saving}
            Saving…
          {:else}
            <Save size={16} strokeWidth={2.5} /> Save
          {/if}
        </button>
      </div>
    {/if}
  </div>

  <RecentSkins {recentSkins} {uploading} onSelect={onRecentSelect} />
</div>
