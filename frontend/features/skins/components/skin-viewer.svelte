<script lang="ts">
  import type { Snippet } from "svelte"
  import { Loader2 } from "lucide-svelte"
  import * as skinview3d from "skinview3d"

  let { skinUrl, variant, capeUrl, showElytra, loading, error, username, children }: {
    skinUrl: string | null
    variant: "classic" | "slim"
    capeUrl: string | null
    showElytra: boolean
    loading: boolean
    error: string | null
    username?: string
    children: Snippet
  } = $props()

  let containerEl = $state<HTMLDivElement>()
  let canvasEl = $state<HTMLCanvasElement>()
  let containerSize = $state({ width: 800, height: 600 })
  let viewer = $state<skinview3d.SkinViewer | null>(null)
  let dragState = { active: false, startX: 0, startRot: 0.3 }

  $effect(() => {
    const canvas = canvasEl
    const container = containerEl
    if (!canvas || !container) return

    const { width: cw, height: ch } = container.getBoundingClientRect()
    const v = new skinview3d.SkinViewer({ canvas, width: Math.round(cw), height: Math.round(ch) })

    v.renderer.setClearColor(0x000000, 0)
    v.globalLight.intensity = 3.0
    v.cameraLight.intensity = 0.0
    v.animation = new skinview3d.IdleAnimation()
    v.animation.speed = 1
    v.controls.enabled = false
    v.fov = 70
    v.zoom = 0.6
    v.playerObject.rotation.y = 0.3
    v.camera.position.y += 8
    v.camera.lookAt(v.playerObject.position)

    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      containerSize = { width: Math.round(width), height: Math.round(height) }
    })
    ro.observe(container)

    viewer = v

    return () => {
      ro.disconnect()
      v.dispose()
      viewer = null
    }
  })

  $effect(() => {
    const v = viewer
    if (!v) return
    const { width, height } = containerSize
    if (width < 1 || height < 1) return
    v.setSize(width, height)
    v.render()
  })

  $effect(() => {
    const v = viewer
    if (!v) return
    if (skinUrl) {
      v.loadSkin(skinUrl, { model: variant === "slim" ? "slim" : "default" })
    } else {
      v.loadSkin(null)
    }
  })

  $effect(() => {
    const v = viewer
    if (!v) return
    if (capeUrl) {
      v.loadCape(capeUrl, showElytra ? { backEquipment: "elytra" } : undefined)
    } else {
      v.loadCape(null)
    }
  })

  function handlePointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest("button, input")) return
    dragState = {
      active: true,
      startX: e.clientX,
      startRot: viewer?.playerObject.rotation.y ?? 0.3,
    }
    ;(e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId)
  }

  function handlePointerMove(e: PointerEvent) {
    if (!dragState.active || !viewer) return
    const dx = e.clientX - dragState.startX
    viewer.playerObject.rotation.y = dragState.startRot + dx * 0.01
  }

  function handlePointerUp() { dragState.active = false }
  function handlePointerCancel() { dragState.active = false }
</script>

<div
  role="presentation"
  bind:this={containerEl}
  class="relative h-full overflow-hidden box-border select-none rounded-[inherit] isolate transform-gpu"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerCancel}
>
  <div class="absolute inset-0 z-0 pointer-events-none rounded-[inherit] overflow-hidden">
    <div class="relative w-full h-full overflow-hidden rounded-[inherit] bg-[url('/skinstab/background.webp')] bg-cover bg-center bg-no-repeat">
      <div
        class="absolute inset-0 z-[1] bg-linear-to-b from-(--bg-primary)/90 to-(--bg-primary)/98"
      ></div>

      <div
        class="absolute inset-0 z-[3] flex flex-col items-center justify-center pointer-events-none transition-opacity duration-150 {loading ? 'opacity-100' : 'opacity-0'}"
      >
        <Loader2 size={32} class="animate-spin text-blue-500 mb-3" />
        <p class="m-0 text-sm text-[var(--text-muted)]">Loading skin…</p>
      </div>

      <canvas
        bind:this={canvasEl}
        class="relative z-[2] block w-full h-full transition-opacity duration-200 {loading ? 'opacity-0' : 'opacity-100'}"
      ></canvas>
    </div>
  </div>

  <div class="relative z-[1] h-full box-border px-8 pt-8 pb-[88px]">
    <div class="max-w-7xl mx-auto w-full">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          {username ?? "Skins"}
        </h1>
      </div>
    </div>

    {#if error}
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
        <div class="bg-[var(--bg-tertiary)] rounded-md p-4 max-w-sm w-full">
          <p class="text-xs text-red-400 leading-relaxed text-center">{error}</p>
        </div>
      </div>
    {/if}
  </div>

  {@render children()}
</div>
