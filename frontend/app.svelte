<script lang="ts">
  import TitleBar from "./components/layout/title-bar.svelte"
  import Sidebar from "./components/layout/sidebar.svelte"
  import ContentArea from "./components/layout/content-area.svelte"
  import FriendsPanel from "./features/social/friends-panel.svelte"
  import SettingsModal from "./features/settings/settings-modal.svelte"
  import CreateInstanceModal from "./features/instances/create-instance/create-instance-modal.svelte"
  import ConfirmModal from "./components/ui/confirm-modal.svelte"
  import AlertModal from "./components/ui/alert-modal.svelte"
  import ExportModal from "./features/instances/components/export-modal.svelte"
  import OnboardingModal from "./features/onboarding/onboarding-modal.svelte"
  import GlobalSearch from "./components/ui/global-search.svelte"
  import Toaster from "./components/ui/toaster.svelte"
  import Home from "./features/home/home.svelte"
  import Instances from "./features/instances/instances.svelte"
  import Addons from "./features/addons/addons.svelte"
  import Console from "./features/console/console.svelte"
  import Servers from "./features/servers/servers.svelte"
  import Skins from "./features/skins/skins.svelte"
  import Screenshots from "./features/screenshots/screenshots.svelte"
  import ContextMenu from "./components/ui/context-menu.svelte"
  import {
    store,
    setShowSettingsModal, setShowCreateModal, setConfirmModal,
    setAlertModal, setupEventListeners, pushToHistory,
    handleStartCreating, handleCreationComplete,
    setExportModal, setShowSearchPalette, navigateBack, navigateForward,
  } from "./lib/launcherStore.svelte"
  import { bootLauncher } from "./lib/bootstrap"
  import { onMount, untrack } from "svelte"
  import { invoke } from "@tauri-apps/api/core"
  import { ArrowLeft, ArrowRight, RefreshCw, Search } from "lucide-svelte"

  const tabs = {
    home: Home,
    instances: Instances,
    addons: Addons,
    servers: Servers,
    skins: Skins,
    screenshots: Screenshots,
    console: Console,
  }

  let globalMenu = $state<{ x: number; y: number } | null>(null)

  const ActiveTab = $derived(tabs[store.activeTab as keyof typeof tabs])

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
    void bootLauncher()
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

    <ContentArea activeTab={ActiveTab} />

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
