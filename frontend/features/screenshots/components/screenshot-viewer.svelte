<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core"
  import { X, Trash2, ExternalLink, ChevronLeft, ChevronRight } from "lucide-svelte"
  import type { Screenshot } from "../../../types"

  let { shot, index, total, onClose, onPrev, onNext, onOpen, onDelete }: {
    shot: Screenshot
    index: number
    total: number
    onClose: () => void
    onPrev: () => void
    onNext: () => void
    onOpen: (s: Screenshot) => void
    onDelete: (s: Screenshot) => void
  } = $props()

  const viewerIconButton =
    "w-9 h-9 flex items-center justify-center rounded-md cursor-pointer shrink-0 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
  const viewerNavButton =
    "w-9 h-9 flex items-center justify-center rounded-md cursor-pointer shrink-0 bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:bg-[var(--accent-primary)] hover:text-white"

  function focusDialog(node: HTMLElement) {
    const previouslyFocused = document.activeElement as HTMLElement | null
    node.focus()
    return { destroy: () => previouslyFocused?.focus?.() }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div
  use:focusDialog
  role="dialog"
  aria-modal="true"
  aria-label="Screenshot viewer"
  tabindex="-1"
  class="fixed inset-0 bg-black/80 backdrop-blur-[3px] z-50 flex items-center justify-center outline-none"
  onclick={handleBackdropClick}
>
  <div class="flex flex-col items-center gap-8">
    <img
      src={convertFileSrc(shot.path)}
      alt={shot.filename}
      class="max-w-[85vw] max-h-[80vh] object-contain rounded-md"
    />

    <div class="relative w-full max-w-[85vw] z-30">
      <div class="relative flex items-center gap-2 bg-[var(--bg-elevated)]/95 backdrop-blur-md rounded-lg px-3 py-2">
        {#if total > 1}
          <span class="absolute left-1/2 -translate-x-1/2 text-base text-[var(--text-secondary)] select-none whitespace-nowrap pointer-events-none">
            {index + 1} / {total}
          </span>
        {/if}

        <button type="button" onclick={onClose} class="{viewerIconButton} hover:text-[var(--text-primary)]" title="Close" aria-label="Close">
          <X size={24} strokeWidth={2.5} />
        </button>

        <span class="text-base text-[var(--text-muted)] select-none flex-1 min-w-0 truncate whitespace-nowrap">{shot.filename}</span>

        <button type="button" onclick={() => onOpen(shot)} class="{viewerIconButton} hover:text-[var(--text-primary)]" title="Open in default viewer" aria-label="Open in default viewer">
          <ExternalLink size={20} strokeWidth={2.5} />
        </button>
        <button type="button" onclick={() => onDelete(shot)} class="{viewerIconButton} hover:text-red-400" title="Delete" aria-label="Delete screenshot">
          <Trash2 size={20} strokeWidth={2.5} />
        </button>

        {#if total > 1}
          <button type="button" onclick={onPrev} class={viewerNavButton} title="Previous" aria-label="Previous screenshot">
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          <button type="button" onclick={onNext} class={viewerNavButton} title="Next" aria-label="Next screenshot">
            <ChevronRight size={24} strokeWidth={2.5} />
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>
