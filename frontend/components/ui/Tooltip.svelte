<script lang="ts">
  import type { Snippet } from "svelte"
  import { portal } from "../../lib/portal"

  let { text, children }: {
    text: string
    children: Snippet
  } = $props()

  let show = $state(false)
  let rect = $state<DOMRect | null>(null)
  let portalThemeClass = $state("")

  $effect(() => {
    const root = document.querySelector("[class*='theme-']")
    if (root) {
      const match = root.className.match(/theme-\S+/)
      portalThemeClass = match ? match[0] : ""
    }
  })
</script>

<div
  role="presentation"
  onmouseenter={(e) => {
    const target = e.currentTarget as HTMLElement
    rect = target.getBoundingClientRect()
    show = true
  }}
  onmouseleave={() => show = false}
>
  {@render children()}
</div>

{#if show && rect}
  <div use:portal>
    <div
      role="tooltip" class="fixed z-[100] pointer-events-none whitespace-nowrap {portalThemeClass}"
      style="left: {rect.right + 8}px; top: {rect.top + rect.height / 2}px"
    >
      <div class="bg-[var(--bg-secondary)] rounded-md px-2 py-1 border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] -translate-y-1/2">
        {text}
      </div>
    </div>
  </div>
{/if}
