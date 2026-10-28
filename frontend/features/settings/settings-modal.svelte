<script lang="ts">
  import { invoke } from "@tauri-apps/api/core"
  import { Loader2, X, Paintbrush, Play, AppWindow, HardDrive } from "lucide-svelte"
  import AlertModal from "../../components/ui/alert-modal.svelte"
  import { untrack } from "svelte"
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
  let contentScrollerEl: HTMLDivElement | undefined = $state()
  let saveTimeout: ReturnType<typeof setTimeout> | undefined

  let activeTabData = $derived(TABS.find((t) => t.id === activeTab))

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
        class="bg-[var(--content-bg)] rounded-md border border-[var(--border-subtle)] shadow-md w-full max-w-4xl h-[540px] max-h-full flex overflow-hidden modal-content"
        role="presentation"
        class:closing={isClosing}
        onclick={(e) => e.stopPropagation()}
        style="pointer-events: auto"
      >
        <aside class="w-52 shrink-0 bg-[var(--bg-tertiary)] p-3 pt-5 flex flex-col gap-4">
          <div class="px-2 pt-1 min-w-0">
            <h2 class="text-lg font-semibold text-[var(--text-primary)] tracking-tight leading-tight">Settings</h2>
            <p class="text-xs text-[var(--text-muted)] truncate">Octane Launcher {semanticVersion || "…"}</p>
          </div>

          <nav class="flex flex-col gap-1">
            {#each TABS as tab (tab.id)}
              <button
                onclick={() => { if (activeTab === tab.id) return; activeTab = tab.id; contentScrollerEl?.scrollTo({ top: 0, behavior: "instant" }) }}
                class="h-9 px-2 rounded-sm text-sm font-medium cursor-pointer flex items-center gap-2.5 text-left {activeTab === tab.id
                  ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]/50'}"
              >
                <tab.icon size={16} strokeWidth={2} class={"shrink-0 " + (activeTab === tab.id ? "text-[var(--accent-primary)]" : "")} />
                <span class="truncate">{tab.label}</span>
              </button>
            {/each}
          </nav>

          {#if appVersion}
            <div class="mt-auto">
              <span class="h-[26px] px-2.5 inline-flex items-center rounded-sm text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-hover)]">{appVersion.split('-')[1] || appVersion}</span>
            </div>
          {/if}
        </aside>

        <div class="flex-1 min-w-0 flex flex-col">
          <div class="px-8 pt-6 pb-8 shrink-0">
            <div class="flex items-center justify-between gap-3 h-[22.5px]">
              <h3 class="flex items-center gap-2.5 min-w-0 text-lg font-semibold text-[var(--text-primary)] tracking-tight leading-tight">
                {#if activeTabData}
                  <activeTabData.icon size={20} strokeWidth={2} class="shrink-0 text-[var(--accent-primary)]" />
                  <span class="truncate">{activeTabData.label}</span>
                {/if}
              </h3>
              <button
                onclick={handleClose}
                aria-label="Close settings"
                class="p-1.5 hover:bg-[var(--bg-hover)] rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
          </div>

          <div
            bind:this={contentScrollerEl}
            class="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-8 pb-6"
          >
            <div class="space-y-8">
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
          </div>
        </div>
      </div>
    </div>

    {#if alertModal}
      <AlertModal isOpen={alertModal.isOpen} title={alertModal.title} message={alertModal.message} type={alertModal.type} onClose={() => alertModal = null} />
    {/if}
  {/if}
{/if}
