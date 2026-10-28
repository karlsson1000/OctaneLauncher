<script lang="ts">
  import { Minus, Square, Copy, X, ChevronLeft, ChevronRight, PanelRight } from "lucide-svelte"
  import {
    store, navigateBack, navigateForward,
    appWindow,
    setShowFriendsPanel, dragRegion, noDragRegion,
  } from "../../lib/launcherStore.svelte"
  import { instanceIconSrc } from "../../lib/icons"

  const tabLabels: Record<string, string> = {
    instances: "Instances", addons: "Addons",
    servers: "Servers", skins: "Skins", screenshots: "Screenshots", console: "Console",
  }

  const addonsSubTabLabels: Record<string, string> = {
    mods: "Mods", modpacks: "Modpacks", resourcepacks: "Resource Packs", shaderpacks: "Shader Packs",
  }

  let historyLen = $derived(store.navigationHistory.length)

  let isMaximized = $state(false)

  const detailInstance = $derived(
    store.showInstanceDetails && store.selectedInstance ? store.selectedInstance : null
  )

  const detailIcon = $derived(
    detailInstance ? instanceIconSrc(detailInstance.icon_path, detailInstance.name) : null
  )

  $effect(() => {
    const sync = () => { appWindow.isMaximized().then(v => { isMaximized = v }) }
    sync()
    const unlisten = appWindow.onResized(sync)
    return () => { unlisten.then(fn => fn()) }
  })
</script>

<div data-tauri-drag-region class="h-9 flex-shrink-0 flex items-center pl-5 pr-3 gap-2 select-none" style={dragRegion}>
  <div class="flex items-center gap-2 flex-shrink-0">
    <img src="/logo.png" alt="Octane" class="h-4 w-4" />
    <span class="text-sm font-semibold text-[var(--text-secondary)]">Octane Launcher</span>
  </div>

  <div class="flex items-center gap-0.5 ml-1" style={noDragRegion}>
    <button
      onclick={navigateBack}
      disabled={store.historyIndex <= 0}
      class="h-6 w-6 flex items-center justify-center rounded {store.historyIndex > 0 ? 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] cursor-pointer' : 'text-[var(--text-disabled)] cursor-not-allowed'}"
    >
      <ChevronLeft size={18} strokeWidth={3} />
    </button>
    <button
      onclick={navigateForward}
      disabled={store.historyIndex >= historyLen - 1}
      class="h-6 w-6 flex items-center justify-center rounded {store.historyIndex < historyLen - 1 ? 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] cursor-pointer' : 'text-[var(--text-disabled)] cursor-not-allowed'}"
    >
      <ChevronRight size={18} strokeWidth={3} />
    </button>
  </div>

  <span class="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] ml-1 select-none min-w-0" style={dragRegion}>
    {#if detailInstance}
      <span class="flex-shrink-0">Instances /</span>
      {#if detailIcon}
        <img
          src={detailIcon}
          alt=""
          draggable="false"
          class="h-4 w-4 rounded-sm object-cover flex-shrink-0"
        />
      {/if}
      <span class="truncate text-[var(--text-primary)]">{detailInstance.name}</span>
    {:else if store.activeTab === "addons"}
      Addons / {addonsSubTabLabels[store.addonsSubTab]}
    {:else}
      {tabLabels[store.activeTab]}
    {/if}
  </span>

  <div class="flex-1" style={dragRegion}></div>

  <div class="flex items-center" style={noDragRegion}>
    <button
      data-friends-toggle
      onclick={() => setShowFriendsPanel(!store.showFriendsPanel)}
      class="h-7 w-7 flex items-center justify-center rounded cursor-pointer {store.showFriendsPanel ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'}"
      title="Friends"
    >
      <PanelRight size={18} strokeWidth={2} />
    </button>
  </div>

  <div class="flex items-center" style={noDragRegion}>
    <button onclick={() => appWindow.minimize()} class="h-9 w-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
      <Minus size={18} strokeWidth={3} />
    </button>
    <button onclick={() => appWindow.toggleMaximize()} class="h-9 w-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
      {#if isMaximized}
        <Copy size={14} strokeWidth={3} />
      {:else}
        <Square size={14} strokeWidth={3} />
      {/if}
    </button>
    <button onclick={() => appWindow.close()} class="h-9 w-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-red-500 cursor-pointer">
      <X size={18} strokeWidth={3} />
    </button>
  </div>
</div>
