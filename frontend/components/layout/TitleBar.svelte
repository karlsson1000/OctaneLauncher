<script lang="ts">
  import { Minus, Square, X, ChevronLeft, ChevronRight, PanelRight } from "lucide-svelte"
  import {
    store, navigateBack, navigateForward,
    appWindow,
    setShowFriendsPanel, dragRegion, noDragRegion,
  } from "../../lib/launcherStore.svelte"

  const tabLabels: Record<string, string> = {
    home: "Home", instances: "Instances", addons: "Addons",
    servers: "Servers", skins: "Skins", screenshots: "Screenshots", console: "Console",
  }

  const addonsSubTabLabels: Record<string, string> = {
    mods: "Mods", modpacks: "Modpacks", resourcepacks: "Resource Packs", shaderpacks: "Shader Packs",
  }

  let historyLen = $derived(store.navigationHistory.length)
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

  <span class="text-sm font-medium text-[var(--text-secondary)] ml-1 select-none" style={dragRegion}>
    {store.showInstanceDetails && store.selectedInstance
      ? `Instances / ${store.selectedInstance.name}`
      : store.activeTab === "addons"
      ? `Addons / ${addonsSubTabLabels[store.addonsSubTab]}`
      : tabLabels[store.activeTab]}
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
      <Square size={14} strokeWidth={3} />
    </button>
    <button onclick={() => appWindow.close()} class="h-9 w-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-red-500 cursor-pointer">
      <X size={18} strokeWidth={3} />
    </button>
  </div>
</div>
