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
  style="position: relative; overflow: hidden; height: 100%; box-sizing: border-box; user-select: none; -webkit-user-select: none;"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerCancel}
>
  <div style="position: absolute; inset: 0; z-index: 0; pointer-events: none;">
    <div style="width: 100%; height: 100%; position: relative; overflow: hidden; background-image: url(/skinstab/background.webp); background-size: cover; background-position: center; background-repeat: no-repeat;">
      <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.35); z-index: 1;"></div>
      <div style="position: absolute; inset: 0; z-index: 3; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; opacity: {loading ? 1 : 0}; transition: opacity 0.15s;">
        <Loader2 size={32} style="animation: spin 1s linear infinite; color: #3b82f6; margin-bottom: 12px;" />
        <p style="font-size: 14px; color: var(--text-muted); margin: 0;">Loading skin…</p>
      </div>
      <canvas
        bind:this={canvasEl}
        style="display: block; position: relative; z-index: 2; opacity: {loading ? 0 : 1}; transition: opacity 0.2s; width: 100%; height: 100%;"
      ></canvas>
    </div>
  </div>

  <div style="position: relative; z-index: 1; height: 100%; box-sizing: border-box; padding: 32px 32px 88px;">
    <div class="max-w-7xl mx-auto w-full">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          {username ?? "Skins"}
        </h1>
      </div>
    </div>

    {#if error}
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: auto;">
        <div class="bg-[var(--bg-tertiary)] rounded-md p-4 max-w-sm w-full">
          <p class="text-xs text-red-400 leading-relaxed text-center">{error}</p>
        </div>
      </div>
    {/if}
  </div>

  {@render children()}
</div>
