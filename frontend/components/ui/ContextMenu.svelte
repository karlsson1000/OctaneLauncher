<script lang="ts">
  import { portal } from "../../lib/portal"
  interface ContextMenuItem {
    label?: string
    icon?: new (...args: any[]) => any
    onClick?: () => void
    danger?: boolean
    separator?: boolean
  }

  let { x, y, items, onClose }: {
    x: number
    y: number
    items: ContextMenuItem[]
    onClose: () => void
  } = $props()

  let menuEl: HTMLDivElement | undefined = $state()
  let position = $state({ x: 0, y: 0 })

  $effect(() => {
    const close = onClose
    function handleClick(e: MouseEvent) {
      if (menuEl && !menuEl.contains(e.target as Node)) close()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }

    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  })

  $effect(() => {
    if (!menuEl) {
      position = { x, y }
      return
    }
    const { width, height } = menuEl.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    position = {
      x: x + width > vw ? vw - width - 8 : x,
      y: y + height > vh ? vh - height - 8 : y,
    }
  })
</script>

<div use:portal>
  <div
    bind:this={menuEl}
    role="menu"
    class="fixed z-[100] bg-[var(--bg-secondary)] rounded-md overflow-hidden min-w-[180px] border border-[var(--border-subtle)]"
    style="left: {position.x}px; top: {position.y}px"
  >
    {#each items as item}
      {#if item.separator}
        <div class="h-px bg-[var(--bg-tertiary)] my-1 mx-2"></div>
      {:else}
        <button
          onclick={() => { item.onClick?.(); onClose() }}
          class="w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors cursor-pointer {item.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover-strong)]'}"
        >
          {#if item.icon}
            <span class="flex-shrink-0">
              <item.icon size={16} />
            </span>
          {/if}
          <span>{item.label}</span>
        </button>
      {/if}
    {/each}
  </div>
</div>
