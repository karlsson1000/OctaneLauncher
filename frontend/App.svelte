<script lang="ts">
  import TitleBar from "./components/layout/TitleBar.svelte"
  import Sidebar from "./components/layout/Sidebar.svelte"
  import FriendsPanel from "./features/social/FriendsPanel.svelte"
  import SettingsModal from "./features/settings/SettingsModal.svelte"
  import CreateInstanceModal from "./features/instances/CreateInstanceModal.svelte"
  import CreationProgressToast from "./features/instances/CreationProgressToast.svelte"
  import InstanceDetailsTab from "./features/instances/InstanceDetailsTab.svelte"
  import ConfirmModal from "./components/ui/ConfirmModal.svelte"
  import AlertModal from "./components/ui/AlertModal.svelte"
  import ExportModal from "./features/instances/ExportModal.svelte"
  import OnboardingModal from "./features/onboarding/OnboardingModal.svelte"
  import GlobalSearch from "./components/ui/GlobalSearch.svelte"
  import Toaster from "./components/ui/Toaster.svelte"
  import HomeTab from "./features/home/HomeTab.svelte"
  import InstancesTab from "./features/instances/InstancesTab.svelte"
  import AddonsTab from "./features/addons/AddonsTab.svelte"
  import ConsoleTab from "./features/console/ConsoleTab.svelte"
  import ServersTab from "./features/servers/ServersTab.svelte"
  import SkinsTab from "./features/skins/SkinsTab.svelte"
  import ScreenshotsTab from "./features/screenshots/ScreenshotsTab.svelte"
  import ContextMenu from "./components/ui/ContextMenu.svelte"
  import {
    store,
    setShowSettingsModal, setShowCreateModal, setConfirmModal,
    setAlertModal, loadAllInitialData, setupEventListeners, pushToHistory,
    handleStartCreating, handleCreationComplete, handleCreationError,
    setExportModal, setShowSearchPalette, navigateBack, navigateForward,
  } from "./lib/launcherStore.svelte"
  import { onMount, untrack } from "svelte"
  import { invoke } from "@tauri-apps/api/core"
  import { ArrowLeft, ArrowRight, RefreshCw, Search } from "lucide-svelte"

  const SPLASH_DELAY_MS = 100
  const SPLASH_REMOVE_MS = 500

  const tabs = {
    home: HomeTab,
    instances: InstancesTab,
    addons: AddonsTab,
    servers: ServersTab,
    skins: SkinsTab,
    screenshots: ScreenshotsTab,
    console: ConsoleTab,
  }

  let globalMenu = $state<{ x: number; y: number } | null>(null)

  const ActiveTab = $derived(tabs[store.activeTab as keyof typeof tabs])

  const backgroundStyle = $derived(
    store.background
      ? `background-image: url("${store.background}"); background-size: cover; background-position: center`
      : "background-color: var(--content-bg)"
  )

  const overlayStyle = $derived.by(() => {
    const darkness = ((store.settings?.background_darkness ?? 80) / 100).toFixed(2)
    const blur = store.settings?.background_blur ?? 0
    return `background: rgba(0,0,0,${darkness});${blur > 0 ? ` backdrop-filter: blur(${blur}px);` : ""}`
  })

  function handleGlobalKeydown(e: KeyboardEvent) {
    const key = e.key.toLowerCase()
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && key === "f") {
      e.preventDefault()
      setShowSearchPalette(!store.showSearchPalette)
    }
  }

  function handleGlobalContextMenu(e: MouseEvent) {
    if (e.defaultPrevented) return
    const el = e.target as HTMLElement | null
    if (el?.closest("input, textarea, [contenteditable='true']")) return
    if (window.getSelection()?.toString()) return
    e.preventDefault()
    globalMenu = { x: e.clientX, y: e.clientY }
  }

  function dismissCreationToast() {
    store.creatingInstanceName = null
  }

  $effect(() => {
    if (!store.settings) return
    const theme = store.settings.theme || "octane"
    try { localStorage.setItem("octane_theme", theme) } catch {}
    const root = document.documentElement
    for (const cls of Array.from(root.classList)) {
      if (cls.startsWith("theme-")) root.classList.remove(cls)
    }
    root.classList.add(`theme-${theme}`)
  })

  onMount(() => {
    invoke("show_window").catch(() => {})
    setTimeout(() => {
      store.isReady = true
      const splash = document.getElementById("splash-screen")
      const root = document.getElementById("root")
      if (splash && root) {
        splash.classList.add("hidden")
        root.classList.add("visible")
        setTimeout(() => splash.remove(), SPLASH_REMOVE_MS)
      }
      loadAllInitialData()
    }, SPLASH_DELAY_MS)
  })

  $effect(() => {
    if (!store.isReady) return
    const cleanup: unknown = setupEventListeners()
    return () => {
      Promise.resolve(cleanup).then((fn) => {
        if (typeof fn === "function") fn()
      })
    }
  })

  $effect(() => {
    if (!store.isReady) return
    store.activeTab
    store.showInstanceDetails
    store.selectedInstance?.name
    untrack(pushToHistory)
  })
</script>

<svelte:window onkeydown={handleGlobalKeydown} oncontextmenu={handleGlobalContextMenu} />

<!-- preload avatar keeps the browser decode cache warm across tab switches -->
{#if store.activeAccount}
  <img src="https://renders.stellarmc.gg/bust/{store.activeAccount.username}" alt="" aria-hidden="true" class="fixed opacity-0 pointer-events-none" />
{/if}

{#if store.settings?.cat_mode}
  <img src="/cat.webp" alt="" aria-hidden="true" class="fixed top-0 left-1/2 -translate-x-1/2 z-40 h-12 w-auto pointer-events-none select-none" />
{/if}

<div class="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden font-sans">
  <TitleBar />

  <div class="flex flex-1 overflow-hidden px-4 pb-4 gap-4">
    <Sidebar />

    <div class="flex-1 rounded-xl overflow-hidden flex flex-col relative" style={backgroundStyle}>
      {#if store.background}
        <div class="absolute inset-0" style={overlayStyle}></div>
      {/if}

      <main class="flex-1 min-h-0 overflow-y-auto relative">
        {#if store.showInstanceDetails && store.selectedInstance}
          <InstanceDetailsTab instance={store.selectedInstance} />
        {:else if ActiveTab}
          <ActiveTab />
        {/if}
      </main>

      {#if store.creatingInstanceName}
        <div class="absolute bottom-0 left-0 right-0 z-20">
          <CreationProgressToast
            instanceName={store.creatingInstanceName}
            onDismiss={dismissCreationToast}
            onError={handleCreationError}
          />
        </div>
      {/if}
    </div>

    <FriendsPanel
      isOpen={store.showFriendsPanel}
      isAuthenticated={store.isAuthenticated}
      activeAccountUuid={store.activeAccount?.uuid}
    />
  </div>

  {#if store.confirmModal}
    <ConfirmModal
      isOpen={store.confirmModal.isOpen}
      title={store.confirmModal.title}
      message={store.confirmModal.message}
      type={store.confirmModal.type}
      confirmText={store.confirmModal.type === "danger" ? "Delete" : "Confirm"}
      onConfirm={store.confirmModal.onConfirm}
      onCancel={() => setConfirmModal(null)}
      checkboxLabel={store.confirmModal.checkboxLabel}
      checkboxChecked={store.confirmModal.checkboxChecked}
      onCheckboxChange={store.confirmModal.onCheckboxChange}
    />
  {/if}

  {#if store.alertModal}
    <AlertModal
      isOpen={store.alertModal.isOpen}
      title={store.alertModal.title}
      message={store.alertModal.message}
      type={store.alertModal.type}
      onClose={() => setAlertModal(null)}
    />
  {/if}

  {#if store.exportModalInstance}
    <ExportModal
      instanceName={store.exportModalInstance.name}
      onClose={() => setExportModal(null)}
    />
  {/if}

  <SettingsModal
    isOpen={store.showSettingsModal}
    onClose={() => setShowSettingsModal(false)}
  />

  {#if store.showCreateModal}
    <CreateInstanceModal
      instances={store.instances}
      onClose={() => setShowCreateModal(false)}
      onSuccess={handleCreationComplete}
      onStartCreating={handleStartCreating}
    />
  {/if}

  {#if store.showOnboarding}
    <OnboardingModal />
  {/if}

  <GlobalSearch />

  {#if globalMenu}
    {@const gm = globalMenu}
    <ContextMenu
      x={gm.x}
      y={gm.y}
      onClose={() => (globalMenu = null)}
      items={[
        ...(store.historyIndex > 0 ? [{ label: "Back", icon: ArrowLeft, onClick: navigateBack }] : []),
        ...(store.historyIndex < store.navigationHistory.length - 1 ? [{ label: "Forward", icon: ArrowRight, onClick: navigateForward }] : []),
        { label: "Reload", icon: RefreshCw, onClick: () => window.location.reload() },
        { separator: true },
        { label: "Search", icon: Search, onClick: () => setShowSearchPalette(true) },
      ]}
    />
  {/if}

  <Toaster />
</div>
