<script lang="ts">
  import { invoke } from "@tauri-apps/api/core"
  import { Loader2, X, Paintbrush, Play, AppWindow, HardDrive } from "lucide-svelte"
  import AlertModal from "../../components/ui/alert-modal.svelte"
  import { untrack } from "svelte"
  import { fade } from "svelte/transition"
  import { store, setSettings } from "../../lib/launcherStore.svelte"
  import type { LauncherSettings } from "../../types"
  import AppearanceSection from "./components/appearance-section.svelte"
  import GameSection from "./components/game-section.svelte"
  import LauncherSection from "./components/launcher-section.svelte"
  import StorageSection from "./components/storage-section.svelte"

  type TabId = "appearance" | "game" | "launcher" | "storage"

  const TABS: Array<{ id: TabId; label: string; icon: typeof Paintbrush }> = [
    { id: "appearance", label: "Appearance", icon: Paintbrush },
    { id: "game", label: "Game", icon: Play },
    { id: "launcher", label: "Launcher", icon: AppWindow },
    { id: "storage", label: "Storage", icon: HardDrive },
  ]

  let { isOpen, onClose }: { isOpen: boolean; onClose: () => void } = $props()

  let activeTab = $state<TabId>("appearance")
  let appVersion = $state("")
  let semanticVersion = $state("")
  let alertModal: {
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null = $state(null)
  let isClosing = $state(false)
  let contentH = $state(0)
  let heightReady = $state(false)
  let isResizing = $state(false)
  let resizeMs = $state(0)
  let contentScrollerEl: HTMLDivElement | undefined = $state()
  let resizeTimeout: ReturnType<typeof setTimeout> | undefined
  let saveTimeout: ReturnType<typeof setTimeout> | undefined

  function holdOverflow(ms: number) {
    isResizing = true
    if (resizeTimeout) clearTimeout(resizeTimeout)
    resizeTimeout = setTimeout(() => { isResizing = false }, ms)
  }

  function applyHeight(h: number) {
    if (h <= 0) return
    if (contentH === 0) {
      contentH = h
      requestAnimationFrame(() => { heightReady = true })
      return
    }
    const delta = Math.abs(h - contentH)
    if (delta < 1) return
    resizeMs = delta < 4 ? 0 : Math.round(Math.min(240, Math.max(120, 100 + delta * 0.9)))
    contentH = h
    holdOverflow(resizeMs + 60)
  }

  function observeHeight(node: HTMLElement) {
    const ro = new ResizeObserver(() => applyHeight(node.offsetHeight))
    ro.observe(node)
    return {
      destroy() {
        ro.disconnect()
        contentH = 0
        heightReady = false
        isResizing = false
        if (resizeTimeout) clearTimeout(resizeTimeout)
      },
    }
  }

  $effect(() => {
    if (isOpen) {
      untrack(() => {
        loadAppVersion()

        if (store.pendingSettingsTab) {
          activeTab = store.pendingSettingsTab
          store.pendingSettingsTab = null
        }
      })
    }

    return () => {
      if (saveTimeout) clearTimeout(saveTimeout)
    }
  })

  async function loadAppVersion() {
    try {
      const version = await invoke<string>("get_app_version")
      appVersion = version
      semanticVersion = version.split('-')[0]
    } catch {}
  }

  async function handleSettingChange(newSettings: LauncherSettings) {
    try {
      await invoke("save_settings", { settings: newSettings })
      setSettings(newSettings)
    } catch (error) {
      alertModal = { isOpen: true, title: "An error occurred", message: "Failed to save settings" + `: ${error}`, type: "danger" }
    }
  }

  function handleSettingChangeDebounced(newSettings: LauncherSettings) {
    setSettings(newSettings)
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => handleSettingChange(newSettings), 500)
  }

  let backdropArmed = false

  function handleClose() {
    isClosing = true
    setTimeout(() => { isClosing = false; onClose() }, 150)
  }
</script>

{#if isOpen}
  {#if !store.settings}
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-[var(--content-bg)] rounded-md border border-[var(--border-subtle)] shadow-md p-5">
        <div class="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 size={18} class="animate-spin" />
          <span>Loading settings...</span>
        </div>
      </div>
    </div>
  {:else}
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop"
      class:closing={isClosing}
      role="presentation"
      onmousedown={(e) => { backdropArmed = e.target === e.currentTarget }}
      onmouseup={(e) => { backdropArmed = backdropArmed && e.target === e.currentTarget }}
      onclick={() => { if (backdropArmed) handleClose() }}
      onkeydown={(e) => { if (e.key === 'Escape') handleClose() }}
    >
      <div
        class="bg-[var(--content-bg)] rounded-md border border-[var(--border-subtle)] shadow-md w-full max-w-3xl modal-content p-5 space-y-5"
        role="presentation"
        class:closing={isClosing}
          onclick={(e) => e.stopPropagation()}
          style="pointer-events: auto"
        >
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-lg font-semibold text-[var(--text-primary)] tracking-tight leading-tight">Settings</h2>
            <p class="text-[13px] text-[var(--text-muted)] truncate">Octane Launcher {semanticVersion || "…"}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0 self-start">
            {#if appVersion}
              <span class="h-[30px] -mt-0.5 px-2.5 inline-flex items-center rounded-sm text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-tertiary)]">{appVersion.split('-')[1] || appVersion}</span>
            {/if}
            <button
              onclick={handleClose}
              class="p-1.5 -mt-0.5 hover:bg-[var(--bg-hover)] rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div class="grid grid-cols-4 gap-1 p-1 rounded-md bg-[var(--bg-tertiary)] -mt-2">
          {#each TABS as tab (tab.id)}
            <button
              onclick={() => { if (activeTab === tab.id) return; holdOverflow(300); activeTab = tab.id; contentScrollerEl?.scrollTo({ top: 0 }) }}
              class="h-9 rounded-sm text-sm font-medium cursor-pointer flex items-center justify-center gap-2 {activeTab === tab.id
 ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm'
 : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
            >
              <tab.icon size={16} strokeWidth={2} class={"shrink-0 " + (activeTab === tab.id ? "text-[var(--accent-primary)]" : "")} />
              <span>{tab.label}</span>
            </button>
          {/each}
        </div>

        <div
          bind:this={contentScrollerEl}
          class="max-h-[56vh] custom-scrollbar {isResizing ? 'overflow-y-hidden' : 'overflow-y-auto'} {heightReady ? 'transition-[height] motion-reduce:transition-none' : ''}"
          style:height={contentH > 0 ? `${contentH}px` : "auto"}
          style:transition-duration="{resizeMs}ms"
          style:transition-timing-function="cubic-bezier(0.4, 0, 0.2, 1)"
        >
        <div use:observeHeight>
        {#key activeTab}
        <div class="space-y-3" in:fade={{ duration: 120 }}>
          {#if activeTab === "appearance"}
            <AppearanceSection onChange={handleSettingChange} onChangeDebounced={handleSettingChangeDebounced} onAlert={(alert) => alertModal = alert} />
          {:else if activeTab === "game"}
            <GameSection onChange={handleSettingChange} onChangeDebounced={handleSettingChangeDebounced} />
          {:else if activeTab === "launcher"}
            <LauncherSection onChange={handleSettingChange} onClose={onClose} />
          {:else if activeTab === "storage"}
            <StorageSection onAlert={(alert) => alertModal = alert} />
          {/if}
        </div>
        {/key}
        </div>
        </div>
      </div>
    </div>

    {#if alertModal}
      <AlertModal isOpen={alertModal.isOpen} title={alertModal.title} message={alertModal.message} type={alertModal.type} onClose={() => alertModal = null} />
    {/if}
  {/if}
{/if}
