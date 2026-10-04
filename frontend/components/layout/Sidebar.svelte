<script lang="ts">
  import { House, LibraryBig, Package, Blocks, Shirt, Images, SquareTerminal, HardDrive, Settings, Download, Plus, FolderOpen, Copy, Trash2 } from "lucide-svelte"
  import ContextMenu from "../ui/ContextMenu.svelte"
  import Tooltip from "../ui/Tooltip.svelte"
  import {
    store, setActiveTab, setShowInstanceDetails,
    setSidebarContextMenu, setSelectedInstance,
    handleInstallUpdate, handleOpenSettings, handleCreateNew,
    handleOpenInstanceFolderByInstance, handleDuplicateInstance, handleDeleteInstance,
    handleShowDetails,
  } from "../../lib/launcherStore.svelte"
  import { instanceIconSrc } from "../../lib/icons"
  import { storeGet, storeSet } from "../../lib/store"
  import { onMount, tick } from "svelte"
  import { flip } from "svelte/animate"
  import type { Instance } from "../../types"

  const tabs = [
    { id: "home" as const, icon: House, label: "Home" },
    { id: "instances" as const, icon: LibraryBig, label: "Instances" },
    { id: "addons" as const, icon: Blocks, label: "Addons" },
    { id: "skins" as const, icon: Shirt, label: "Skins" },
    { id: "screenshots" as const, icon: Images, label: "Screenshots" },
    { id: "servers" as const, icon: HardDrive, label: "Servers" },
    { id: "console" as const, icon: SquareTerminal, label: "Console" },
  ]

  const recentInstances = $derived<Instance[]>(
    [...store.instances]
      .filter(i => i.last_played)
      .sort((a, b) => new Date(b.last_played!).getTime() - new Date(a.last_played!).getTime())
      .slice(0, 3)
  )

  function openRecentInstance(instance: Instance) {
    setActiveTab("instances")
    handleShowDetails(instance)
  }

  const DEFAULT_ORDER: string[] = [...tabs.map(t => t.id), "recents"]
  let sidebarOrder = $state<string[]>(DEFAULT_ORDER)
  let dragBlock = $state<string | null>(null)
  let listEl: HTMLDivElement | undefined = $state()
  let lastPointerY = 0
  let ready = $state(false)
  let dragStartOrder: string[] = []
  const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  const flipDuration = $derived(!ready || reduceMotion ? 0 : 200)

  onMount(() => {
    storeGet<string[]>("sidebar_order")
      .then((saved) => {
        if (saved?.length) {
          const known = saved.filter(s => DEFAULT_ORDER.includes(s))
          const missing = DEFAULT_ORDER.filter(s => !known.includes(s))
          sidebarOrder = [...known, ...missing]
        }
      })
      .catch(() => {})
      .finally(() => {
        tick().then(() => { ready = true })
      })
  })

  function persistOrder(order: string[]) {
    sidebarOrder = order
    storeSet("sidebar_order", order).catch(() => {})
  }

  let pressInfo: { id: string; x: number; y: number } | null = null
  let suppressClick = false

  function handleBlockPointerDown(e: PointerEvent, id: string) {
    if (e.button !== 0) return
    dragBlock = null
    pressInfo = { id, x: e.clientX, y: e.clientY }
  }

  function handleBlockPointerUp() {
    if (dragBlock && sidebarOrder.join() !== dragStartOrder.join()) {
      persistOrder(sidebarOrder)
    }
    if (dragBlock) {
      suppressClick = true
      setTimeout(() => suppressClick = false, 0)
    }
    pressInfo = null
    dragBlock = null
  }

  function guardClick(e: Event) {
    if (suppressClick) {
      e.stopPropagation()
      e.preventDefault()
    }
  }

  function handleWindowPointerMove(e: PointerEvent) {
    if (e.buttons === 0 && (pressInfo || dragBlock)) {
      handleBlockPointerUp()
      return
    }
    if (pressInfo && !dragBlock) {
      if (Math.hypot(e.clientX - pressInfo.x, e.clientY - pressInfo.y) <= 4) return
      dragBlock = pressInfo.id
      dragStartOrder = [...sidebarOrder]
      lastPointerY = e.clientY
    }
    if (!dragBlock || !listEl) return
    const movingDown = e.clientY >= lastPointerY
    lastPointerY = e.clientY
    const kids = Array.from(listEl.children) as HTMLElement[]
    let slot = kids.length
    for (let i = 0; i < kids.length; i++) {
      const r = kids[i].getBoundingClientRect()
      if (r.height === 0) continue
      const edge = movingDown ? r.top + r.height / 4 : r.top + (r.height * 3) / 4
      if (e.clientY < edge) {
        slot = i
        break
      }
    }
    const cur = sidebarOrder.indexOf(dragBlock)
    if (cur === -1) return
    const without = sidebarOrder.filter(b => b !== dragBlock)
    const insertAt = Math.max(0, Math.min(slot <= cur ? slot : slot - 1, without.length))
    const next = [...without]
    next.splice(insertAt, 0, dragBlock)
    if (next.join() !== sidebarOrder.join()) sidebarOrder = next
  }
</script>

<svelte:window
  onpointermove={handleWindowPointerMove}
  onpointerup={handleBlockPointerUp}
  onpointercancel={handleBlockPointerUp}
/>

<div class="w-10 flex-shrink-0 flex flex-col items-center gap-1 relative z-10">
  <div bind:this={listEl} class="flex flex-col items-center gap-2.5 flex-1 {dragBlock ? '[&_*]:cursor-grabbing!' : ''}">
    {#each sidebarOrder as block, bi (block)}
      <div animate:flip={{ duration: flipDuration }} class={block === "recents" && recentInstances.length === 0 ? "hidden" : ""}>
      {#if block === "recents"}
        {#if recentInstances.length > 0}
          <!-- svelte-ignore a11y_no_static_element_interactions: drag handled via pointer events -->
          <div
            onpointerdown={(e) => handleBlockPointerDown(e, "recents")}
            onclickcapture={guardClick}
            class="flex flex-col items-center gap-2.5 touch-none select-none {bi > 0 ? 'pt-2.5 border-t border-[var(--bg-tertiary)]' : ''} {dragBlock === 'recents' ? 'opacity-40' : ''}"
          >
            {#each recentInstances as instance (instance.name)}
              {@const icon = instanceIconSrc(instance.icon_path, instance.name)}
              <Tooltip text={instance.name} enabled={!dragBlock}>
                <button
                  onclick={() => openRecentInstance(instance)}
                  oncontextmenu={(e) => { e.preventDefault(); setSidebarContextMenu({ x: e.clientX, y: e.clientY, instance }) }}
                  class="w-11 h-11 flex items-center justify-center rounded-lg transition-all cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-active)]"
                >
                  {#if icon}
                    <img src={icon} alt={instance.name} class="w-9 h-9 rounded object-cover" />
                  {:else}
                    <Package size={28} strokeWidth={2} />
                  {/if}
                </button>
              </Tooltip>
            {/each}
          </div>
        {/if}
      {:else}
        {@const tab = tabs.find(t => t.id === block)}
        {#if tab}
          {@const Icon = tab.icon}
          {@const isActive = store.activeTab === tab.id}
          <!-- svelte-ignore a11y_no_static_element_interactions: drag handled via pointer events -->
          <div
            onpointerdown={(e) => handleBlockPointerDown(e, tab.id)}
            onclickcapture={guardClick}
            class="touch-none select-none {dragBlock === tab.id ? 'opacity-40' : ''}"
          >
            <Tooltip text={tab.label} enabled={!dragBlock}>
              <button
                onclick={() => { setActiveTab(tab.id); setShowInstanceDetails(false) }}
                class="w-11 h-11 flex items-center justify-center rounded-lg transition-all cursor-pointer {isActive ? 'bg-[var(--bg-active)] text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-active)]'}"
              >
                <Icon size={28} strokeWidth={2} />
              </button>
            </Tooltip>
          </div>
        {/if}
      {/if}
      </div>
    {/each}
  </div>

  <div class="flex flex-col items-center gap-2">
    {#if store.updateInfo}
      <Tooltip text={store.isInstallingUpdate ? "Installing update..." : `Update available: ${store.updateInfo.new_version}`}>
        <button
          onclick={handleInstallUpdate}
          disabled={store.isInstallingUpdate}
          class="w-11 h-11 flex items-center justify-center rounded-lg transition-all cursor-pointer {store.isInstallingUpdate ? 'text-[#16a34a] animate-pulse' : 'text-[#16a34a] hover:bg-[var(--bg-active)]'}"
        >
          <Download size={28} strokeWidth={2} />
        </button>
      </Tooltip>
    {/if}

    <Tooltip text="New instance">
      <button
        onclick={handleCreateNew}
        class="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-active)] transition-all cursor-pointer"
      >
        <Plus size={28} strokeWidth={2} />
      </button>
    </Tooltip>

    <Tooltip text="Settings">
      <button
        onclick={handleOpenSettings}
        class="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-active)] transition-all cursor-pointer"
      >
        <Settings size={28} strokeWidth={2} />
      </button>
    </Tooltip>
  </div>
</div>

{#if store.sidebarContextMenu}
  {@const scm = store.sidebarContextMenu}
  <ContextMenu
    x={scm.x}
    y={scm.y}
    onClose={() => setSidebarContextMenu(null)}
    items={[
      {
        label: "Open",
        icon: Package,
        onClick: () => {
          setSelectedInstance(scm.instance)
          setActiveTab("instances")
          setShowInstanceDetails(true)
        },
      },
      {
        label: "Open Folder",
        icon: FolderOpen,
        onClick: () => handleOpenInstanceFolderByInstance(scm.instance),
      },
      {
        label: "Duplicate",
        icon: Copy,
        onClick: () => handleDuplicateInstance(scm.instance),
      },
      { separator: true },
      {
        label: "Delete",
        icon: Trash2,
        onClick: () => handleDeleteInstance(scm.instance.name),
        danger: true,
      },
    ]}
  />
{/if}
