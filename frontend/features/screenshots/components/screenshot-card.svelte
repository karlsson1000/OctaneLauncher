<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core"
  import { ExternalLink, Trash2 } from "lucide-svelte"
  import type { Screenshot } from "../../../types"
  import { formatFileSize, formatDate } from "../../../lib/format"

  let { screenshot, onOpen, onOpenExternal, onDelete }: {
    screenshot: Screenshot
    onOpen: (s: Screenshot) => void
    onOpenExternal: (s: Screenshot) => void
    onDelete: (s: Screenshot) => void
  } = $props()

  function fadeIn(img: HTMLImageElement) {
    const show = () => img.classList.remove("opacity-0")
    if (img.complete) show()
    else {
      img.addEventListener("load", show, { once: true })
      img.addEventListener("error", show, { once: true })
    }
  }

  function handleCardKeyDown(e: KeyboardEvent) {
    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault()
      onOpen(screenshot)
    }
  }
</script>

<div
  role="button"
  tabindex="0"
  aria-label="View {screenshot.filename}"
  onclick={() => onOpen(screenshot)}
  onkeydown={handleCardKeyDown}
  class="group relative rounded-md overflow-hidden cursor-pointer screenshot-card"
>
  <div class="aspect-video relative bg-[var(--bg-tertiary)]">
    <img
      use:fadeIn
      src={convertFileSrc(screenshot.path)}
      alt=""
      loading="lazy"
      decoding="async"
      class="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-200"
    />
    <div
      class="absolute inset-x-0 bottom-0 p-2 pt-7 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none text-left"
    >
      <p class="text-xs font-medium text-white truncate">{screenshot.instance_name}</p>
      <div class="flex items-center justify-between text-[11px] text-white/70">
        <span>{formatDate(screenshot.timestamp)}</span>
        <span>{formatFileSize(screenshot.size)}</span>
      </div>
    </div>
  </div>

  <div class="absolute top-2 right-2 flex items-center gap-0.5 p-0.5 rounded-md bg-[var(--bg-tertiary)] opacity-0 group-hover:opacity-100 has-[:focus-visible]:opacity-100 transition-opacity">
    <button
      type="button"
      onclick={(e) => {
        e.stopPropagation()
        onOpenExternal(screenshot)
      }}
      class="w-7 h-7 flex items-center justify-center rounded text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
      title="Open in default viewer"
      aria-label="Open {screenshot.filename} in default viewer"
    >
      <ExternalLink size={16} strokeWidth={2.5} />
    </button>
    <button
      type="button"
      onclick={(e) => {
        e.stopPropagation()
        onDelete(screenshot)
      }}
      class="w-7 h-7 flex items-center justify-center rounded cursor-pointer text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:text-red-400"
      title="Delete screenshot"
      aria-label="Delete {screenshot.filename}"
    >
      <Trash2 size={16} strokeWidth={2.5} />
    </button>
  </div>
</div>
