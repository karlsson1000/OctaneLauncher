<script module lang="ts">
  let dismissCurrent: (() => void) | null = null
</script>

<script lang="ts">
  import type { Snippet } from "svelte"
  import { onDestroy } from "svelte"
  import { portal } from "../../lib/portal"

  let { text, children, enabled = true }: {
    text: string
    children: Snippet
    enabled?: boolean
  } = $props()

  const HIDE_DELAY_MS = 80

  let show = $state(false)
  let rect = $state<DOMRect | null>(null)
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  function hideNow() {
    if (hideTimer !== undefined) clearTimeout(hideTimer)
    hideTimer = undefined
    show = false
    if (dismissCurrent === hideNow) dismissCurrent = null
  }

  function handleEnter(e: MouseEvent) {
    if (hideTimer !== undefined) clearTimeout(hideTimer)
    hideTimer = undefined
    dismissCurrent?.()
    const target = e.currentTarget as HTMLElement
    rect = target.getBoundingClientRect()
    show = true
    dismissCurrent = hideNow
  }

  function handleLeave() {
    if (hideTimer !== undefined) clearTimeout(hideTimer)
    hideTimer = setTimeout(hideNow, HIDE_DELAY_MS)
  }

  onDestroy(() => {
    if (hideTimer !== undefined) clearTimeout(hideTimer)
    if (dismissCurrent === hideNow) dismissCurrent = null
  })
</script>

<div
  role="presentation"
  onmouseenter={handleEnter}
  onmouseleave={handleLeave}
>
  {@render children()}
</div>

{#if show && enabled && rect}
  <div use:portal>
    <div
      role="tooltip" class="fixed z-[100] pointer-events-none whitespace-nowrap"
      style="left: {rect.right + 10}px; top: {rect.top + rect.height / 2}px"
    >
      <div class="tooltip-bubble bg-[var(--bg-secondary)] rounded-md px-2 py-1 border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] -translate-y-1/2">
        {text}
      </div>
    </div>
  </div>
{/if}

<style>
  .tooltip-bubble {
    position: relative;
    animation: tooltipIn 0.12s ease-out;
  }

  .tooltip-bubble::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 0;
    width: 10px;
    height: 10px;
    margin: -5px 0 0 -5px;
    transform: rotate(45deg);
    background: var(--bg-secondary);
    border-left: 1px solid var(--border-subtle);
    border-bottom: 1px solid var(--border-subtle);
  }

  @keyframes tooltipIn {
    from {
      opacity: 0;
      transform: translateX(-4px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tooltip-bubble {
      animation: none;
    }
  }
</style>
