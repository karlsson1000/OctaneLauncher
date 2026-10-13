<script lang="ts">
  import { invoke } from "@tauri-apps/api/core"
  import { Loader2, ImagePlus, FolderOpen, X, Check, ChevronDown, ChevronUp, Paintbrush, Play, AppWindow, HardDrive } from "lucide-svelte"
  import AlertModal from "../../components/ui/AlertModal.svelte"
  import TrashSection from "./TrashSection.svelte"
  import { untrack } from "svelte"
  import { fade } from "svelte/transition"
  import { store, setSettings, loadBackground, setShowOnboarding } from "../../lib/launcherStore.svelte"
  import { storeSet } from "../../lib/store"
  import type { LauncherSettings, StorageCategory, SystemInfo } from "../../types"
  import { formatFileSize } from "../../lib/format"

  const THEMES = [
    { id: "octane", label: "Octane", colors: ["#15171c", "#252932", "#4572e3", "#e6e6e6"] },
    { id: "light", label: "Light", colors: ["#f5f5f5", "#ffffff", "#4361ee", "#1a1d23"] },
    { id: "rose", label: "Rosé", colors: ["#1a1423", "#2a1a33", "#f472b6", "#e6e6ee"] },
    { id: "forest", label: "Forest", colors: ["#1a241e", "#30423a", "#4ade80", "#e8eee9"] },
  ] as const

  type TabId = "appearance" | "game" | "launcher" | "storage"

  const TABS: Array<{ id: TabId; label: string; icon: typeof Paintbrush }> = [
    { id: "appearance", label: "Appearance", icon: Paintbrush },
    { id: "game", label: "Game", icon: Play },
    { id: "launcher", label: "Launcher", icon: AppWindow },
    { id: "storage", label: "Storage", icon: HardDrive },
  ]

  let { isOpen, onClose }: { isOpen: boolean; onClose: () => void } = $props()

  let activeTab = $state<TabId>("appearance")
  let javaInstallations: string[] = $state([])
  let isLoadingJava = $state(false)
  let showCustomPath = $state(false)
  let customPathValue = $state("")
  let systemInfo: SystemInfo | null = $state(null)
  let backgroundPreview: string | null = $state(null)
  let appVersion = $state("")
  let semanticVersion = $state("")
  let storageCategories: StorageCategory[] = $state([])
  let storageLoading = $state(false)
  let fileInputEl: HTMLInputElement | undefined = $state()
  let alertModal: {
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null = $state(null)
  let isClosing = $state(false)
  let isJavaDropdownOpen = $state(false)
  let javaDropdownEl: HTMLDivElement | undefined = $state()
  let javaDropdownUp = $state(false)
  let javaDropdownMaxH = $state(240)
  let contentH = $state(0)
  let heightReady = $state(false)
  let isResizing = $state(false)
  let resizeMs = $state(0)
  let contentScrollerEl: HTMLDivElement | undefined = $state()
  let resizeTimeout: ReturnType<typeof setTimeout> | undefined

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

  function toggleJavaDropdown() {
    if (isJavaDropdownOpen) {
      isJavaDropdownOpen = false
      return
    }
    const el = javaDropdownEl
    const scroller = el?.closest(".overflow-y-auto")
    if (el && scroller) {
      const trig = el.getBoundingClientRect()
      const sc = scroller.getBoundingClientRect()
      const spaceBelow = sc.bottom - trig.bottom - 8
      const spaceAbove = trig.top - sc.top - 8
      javaDropdownUp = spaceAbove > spaceBelow
      javaDropdownMaxH = Math.min(240, Math.max(javaDropdownUp ? spaceAbove : spaceBelow, 96))
    }
    isJavaDropdownOpen = true
  }
  let isTabDropdownOpen = $state(false)
  let tabDropdownEl: HTMLDivElement | undefined = $state()
  let saveTimeout: ReturnType<typeof setTimeout> | undefined
  let ramSliderValue = $state(store.settings?.memory_mb ?? 4096)
  let ramTextValue = $state(((store.settings?.memory_mb ?? 4096) / 1024).toFixed(1))
  let ramTextFocused = $state(false)
  let javaArgsText = $state("")
  let javaArgsFocused = $state(false)

  function commitJavaArgsFocus() {
    javaArgsFocused = false
    if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = undefined }
    const normalized = javaArgsText.replace(/\s+/g, " ").trim()
    handleSettingChange({ ...store.settings!, java_args: normalized === "" ? null : normalized } as LauncherSettings)
    javaArgsText = store.settings?.java_args ?? ""
  }

  $effect(() => {
    if (!ramTextFocused) ramTextValue = (ramSliderValue / 1024).toFixed(1)
  })

  function commitRamText() {
    ramTextFocused = false
    const parsed = parseFloat(ramTextValue.replace(",", "."))
    if (isNaN(parsed)) {
      ramTextValue = (ramSliderValue / 1024).toFixed(1)
      return
    }
    const maxMb = (systemInfo as SystemInfo | null)?.total_memory_mb || 32768
    const mb = Math.min(maxMb, Math.max(1024, Math.round((parsed * 1024) / 512) * 512))
    ramTextValue = (mb / 1024).toFixed(1)
    if (mb === ramSliderValue) return
    ramSliderValue = mb
    handleSettingChangeDebounced({ ...store.settings!, memory_mb: mb } as LauncherSettings)
  }

  let ramPercent = $derived(store.settings ? ((ramSliderValue - 1024) / (((systemInfo as SystemInfo | null)?.total_memory_mb || 32768) - 1024)) * 100 : 0)
  let totalBytes = $derived(storageCategories.reduce((sum, c) => sum + c.size_bytes, 0))

  const storageColors: Record<string, string> = {
    Instances: "#3b82f6",
    Cache: "#f59e0b",
    Trash: "#ef4444",
    Other: "#6b7280",
  }

  $effect(() => {
    if (isOpen) {
      untrack(() => {
        ramSliderValue = store.settings?.memory_mb ?? 4096
        if (!javaArgsFocused) javaArgsText = store.settings?.java_args ?? ""
        loadSystemInfo()
        loadSidebarBackground()
        loadJavaInstallations()
        loadAppVersion()
        loadStorageUsage()

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

  $effect(() => {
    const nextJavaArgs = store.settings?.java_args ?? ""
    if (isOpen && !javaArgsFocused && nextJavaArgs !== javaArgsText) {
      javaArgsText = nextJavaArgs
    }
  })

  $effect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (javaDropdownEl && !javaDropdownEl.contains(event.target as Node)) {
        isJavaDropdownOpen = false
      }
      if (tabDropdownEl && !tabDropdownEl.contains(event.target as Node)) {
        isTabDropdownOpen = false
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  })

  $effect(() => {
    if (!store.settings?.java_path) {
      showCustomPath = false
      customPathValue = ""
      return
    }

    if (javaInstallations.length > 0) {
      const isCustom = !javaInstallations.includes(store.settings?.java_path as string)
      showCustomPath = isCustom
      if (isCustom) customPathValue = (store.settings?.java_path as string)
      else customPathValue = ""
    }
  })

  async function loadAppVersion() {
    try {
      const version = await invoke<string>("get_app_version")
      appVersion = version
      semanticVersion = version.split('-')[0]
    } catch (error) {
    }
  }

  async function loadStorageUsage() {
    storageLoading = true
    try {
      const data = await invoke<StorageCategory[]>("get_storage_usage")
      storageCategories = data
    } catch (error) {
    } finally {
      storageLoading = false
    }
  }

  async function loadSystemInfo() {
    try {
      const info = await invoke<SystemInfo>("get_system_info")
      systemInfo = info
    } catch (error) {
    }
  }

  async function loadSidebarBackground() {
    try {
      const bg = await invoke<string | null>("get_background")
      backgroundPreview = bg
    } catch (error) {
    }
  }

  async function loadJavaInstallations() {
    isLoadingJava = true
    try {
      const installations = await invoke<string[]>("detect_java_installations")
      javaInstallations = installations
    } catch (error) {
    } finally {
      isLoadingJava = false
    }
  }

  async function handleSettingChange(newSettings: LauncherSettings) {
    try {
      await invoke("save_settings", { settings: newSettings })
      await storeSet('octane_theme', newSettings.theme ?? 'octane')
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

  function handleJavaArgsChange(value: string) {
    javaArgsText = value
    const normalized = value.replace(/\s+/g, " ").trim()
    handleSettingChangeDebounced({ ...store.settings!, java_args: normalized === "" ? null : normalized } as LauncherSettings)
  }

  async function handleFileSelect(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alertModal = { isOpen: true, title: "Invalid File", message: "Please select an image file (PNG, JPG, etc.)", type: "warning" }
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alertModal = { isOpen: true, title: "File Too Large", message: "Image must be smaller than 10MB", type: "warning" }
      return
    }

    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = e.target?.result as string

        try {
          await invoke("set_background", { imageData: base64 })
          backgroundPreview = base64
          loadBackground()
        } catch (error) {
          alertModal = { isOpen: true, title: "An error occurred", message: "Failed to save background" + `: ${error}`, type: "danger" }
        }
      }
      reader.readAsDataURL(file)
    } catch (error) {
      alertModal = { isOpen: true, title: "An error occurred", message: "Failed to read image file", type: "danger" }
    }

    if (fileInputEl) fileInputEl.value = ''
  }

  async function handleRemoveBackground() {
    try {
      await invoke("remove_background")
      backgroundPreview = null
      loadBackground()
    } catch (error) {
      alertModal = { isOpen: true, title: "An error occurred", message: "Failed to remove background" + `: ${error}`, type: "danger" }
    }
  }

  async function handleOpenDirectory(path: string) {
    try {
      await invoke("open_directory", { path })
    } catch (error) {
      alertModal = { isOpen: true, title: "An error occurred", message: "Failed to open directory" + `: ${error}`, type: "danger" }
    }
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
        {#snippet menuOption(label: string, checked: boolean, onclick: () => void)}
          <button
            role="menuitem"
            {onclick}
            class="w-full flex items-center justify-between gap-2.5 px-2 py-2 text-sm text-left rounded-sm cursor-pointer select-none text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          >
            <span class="truncate min-w-0">{label}</span>
            {#if checked}<Check size={15} strokeWidth={3} class="text-[var(--accent-primary)] shrink-0 ml-2" />{/if}
          </button>
        {/snippet}

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
            <section class="rounded-md bg-[var(--bg-tertiary)] p-4">
              <h4 class="text-sm font-medium text-[var(--text-primary)] leading-tight">Theme</h4>
              <p class="text-xs text-[var(--text-muted)] mt-0.5 mb-4">Pick the color scheme for the whole launcher.</p>
              <div class="grid grid-cols-4 gap-3">
                {#each THEMES as theme (theme.id)}
                  <button
                    onclick={() => store.settings && handleSettingChange({ ...store.settings, theme: theme.id })}
                    class="group rounded-md overflow-hidden text-left cursor-pointer transition-all relative {store.settings?.theme === theme.id
 ? 'ring-2 ring-[var(--accent-primary)]'
 : 'hover:brightness-110'}"
                  >
                    <div class="flex h-16" style="background: {theme.colors[0]}">
                      <div class="w-6 h-full flex flex-col gap-1 p-1" style="background: {theme.colors[1]}">
                        <div class="w-full h-1.5 rounded-sm" style="background: {theme.colors[2]}"></div>
                        <div class="w-full h-1.5 rounded-sm opacity-30" style="background: {theme.colors[3]}"></div>
                        <div class="w-full h-1.5 rounded-sm opacity-30" style="background: {theme.colors[3]}"></div>
                      </div>
                      <div class="flex-1 p-2 space-y-1">
                        <div class="h-1.5 w-10 rounded-sm" style="background: {theme.colors[3]}"></div>
                        <div class="h-1.5 w-14 rounded-sm opacity-30" style="background: {theme.colors[3]}"></div>
                        <div class="h-6 w-full rounded-sm mt-1.5 opacity-15" style="background: {theme.colors[1]}"></div>
                      </div>
                    </div>
                    <div class="flex items-center justify-between px-2.5 py-2" style="background: {theme.colors[1]}">
                      <span class="text-xs font-semibold" style="color: {theme.colors[3]}">{theme.label}</span>
                      <div class="w-3.5 h-3.5 rounded-full flex items-center justify-center" style="background: {theme.colors[2]}">
                        {#if store.settings?.theme === theme.id}<Check size={10} class="text-white" strokeWidth={3} />{/if}
                      </div>
                    </div>
                  </button>
                {/each}
              </div>
            </section>

            <section class="rounded-md bg-[var(--bg-tertiary)] p-4">
              <h4 class="text-sm font-medium text-[var(--text-primary)] leading-tight mb-3">Custom background</h4>
              {#if backgroundPreview}
                <div class="relative group">
                  <div class="h-36 rounded-md overflow-hidden bg-[var(--content-bg)]">
                    <img src={backgroundPreview} alt="Background" class="w-full h-full object-cover" />
                  </div>
                  <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-2">
                    <button onclick={() => fileInputEl?.click()} class="h-8 px-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-md text-xs font-medium cursor-pointer">Change</button>
                    <button onclick={handleRemoveBackground} class="h-8 px-3 bg-red-500 hover:bg-red-600 text-white rounded-md text-xs font-medium cursor-pointer">Remove</button>
                  </div>
                </div>
              {:else}
                <button onclick={() => fileInputEl?.click()} class="w-full h-24 bg-[var(--content-bg)] hover:bg-[var(--bg-hover)] rounded-md flex flex-col items-center justify-center gap-1.5 cursor-pointer">
                  <ImagePlus size={20} class="text-[var(--text-muted)]" />
                  <span class="text-xs text-[var(--text-muted)]">Click to upload an image · PNG, JPG up to 10MB</span>
                </button>
              {/if}
              <input bind:this={fileInputEl} type="file" accept="image/*" onchange={handleFileSelect} class="hidden" />
              {#if backgroundPreview}
                {#snippet settingSlider(label: string, display: string, min: number, max: number, step: number, value: number, oninput: (v: number) => void)}
                  {@const pct = max > min ? (value - min) / (max - min) : 0}
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-sm text-[var(--text-primary)]">{label}</span>
                      <span class="text-sm font-mono text-[var(--text-muted)]">{display}</span>
                    </div>
                    <div class="relative h-6 flex items-center">
                      <div class="absolute inset-x-0 h-2 bg-[var(--content-bg)] rounded-full"></div>
                      <div class="absolute h-2 rounded-full" style="width: calc(3px + (100% - 6px) * {pct}); background: var(--accent-primary)"></div>
                      <div class="absolute w-1.5 h-5 rounded-full bg-[var(--accent-primary)] -translate-x-1/2 top-1/2 -mt-2.5" style="left: calc(3px + (100% - 6px) * {pct})"></div>
                      <input
                        type="range" {min} {max} {step}
                        value={value}
                        oninput={(e) => oninput(Number((e.currentTarget as HTMLInputElement).value))}
                        class="absolute inset-0 w-full opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                {/snippet}
                <div class="mt-4">
                  {@render settingSlider("Darkness", `${store.settings?.background_darkness ?? 80}%`, 0, 100, 1, store.settings?.background_darkness ?? 80, (v) => handleSettingChangeDebounced({ ...store.settings!, background_darkness: v } as LauncherSettings))}
                </div>
                <div class="mt-2">
                  {@render settingSlider("Blur", `${store.settings?.background_blur ?? 0}px`, 0, 20, 1, store.settings?.background_blur ?? 0, (v) => handleSettingChangeDebounced({ ...store.settings!, background_blur: v } as LauncherSettings))}
                </div>
              {/if}
            </section>
          {:else if activeTab === "game"}
            <section class="rounded-md bg-[var(--bg-tertiary)] p-4">
              <div class="flex items-center justify-between gap-3 mb-3">
                <div class="min-w-0">
                  <h4 class="text-sm font-medium text-[var(--text-primary)] leading-tight">Memory allocation</h4>
                  <p class="text-xs text-[var(--text-muted)] mt-0.5">
                    {systemInfo ? `${(systemInfo.available_memory_mb / 1024).toFixed(1)} GB` : "?"} currently available on your system
                  </p>
                </div>
                <div class="flex items-baseline shrink-0">
                  <input
                    type="text"
                    inputmode="decimal"
                    aria-label="Memory allocation in GB"
                    bind:value={ramTextValue}
                    onfocus={() => ramTextFocused = true}
                    onblur={commitRamText}
                    onkeydown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
                    class="w-[4ch] rounded-sm px-1 -mx-1 text-2xl font-bold text-[var(--text-primary)] font-mono text-right cursor-text bg-[var(--content-bg)] hover:bg-[var(--bg-hover)] focus:outline-none"
                  />
                  <span class="text-sm text-[var(--text-muted)] font-sans font-normal ml-1">GB</span>
                </div>
              </div>
              <div class="relative h-6 flex items-center">
                <div class="absolute inset-x-0 h-2 bg-[var(--content-bg)] rounded-full"></div>
                <div class="absolute h-2 rounded-full" style="width: calc(3px + (100% - 6px) * {ramPercent / 100}); background: var(--accent-primary)"></div>
                <div class="absolute w-1.5 h-5 rounded-full bg-[var(--accent-primary)] -translate-x-1/2 top-1/2 -mt-2.5" style="left: calc(3px + (100% - 6px) * {ramPercent / 100})"></div>
                <input
                  type="range" min="1024" max={systemInfo?.total_memory_mb || 32768} step="512"
                  bind:value={ramSliderValue}
                  oninput={() => handleSettingChangeDebounced({ ...store.settings!, memory_mb: ramSliderValue } as LauncherSettings)}
                  class="absolute inset-0 w-full opacity-0 cursor-pointer"
                />
              </div>
            </section>

            <section class="rounded-md bg-[var(--bg-tertiary)] p-4">
              <div class="flex items-center justify-between gap-3 mb-3">
                <div class="min-w-0">
                  <h4 class="text-sm font-medium text-[var(--text-primary)] leading-tight">Java runtime</h4>
                  <p class="text-xs text-[var(--text-muted)] mt-0.5">Which runtime Minecraft runs on.</p>
                </div>
                <button
                  onclick={loadJavaInstallations}
                  disabled={isLoadingJava}
                  class="h-8 px-3 shrink-0 text-sm font-medium rounded-md bg-[var(--content-bg)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {#if isLoadingJava}<Loader2 size={14} class="animate-spin" />{/if}
                  Rescan
                </button>
              </div>

              <div class="relative" bind:this={javaDropdownEl}>
                <button
                  onclick={toggleJavaDropdown}
                  class="w-full h-9 bg-[var(--content-bg)] px-3 text-sm text-[var(--text-primary)] text-left flex items-center justify-between cursor-pointer min-w-0 rounded-md hover:bg-[var(--bg-hover)]"
                >
                  <span class="truncate">
                    {showCustomPath ? "Custom Path..." : (store.settings?.java_path || "Auto-detect (Recommended)")}
                  </span>
                  <ChevronDown size={14} class="shrink-0 ml-2 transition-transform {isJavaDropdownOpen ? 'rotate-180' : ''}" />
                </button>

                {#if isJavaDropdownOpen}
                  <div role="menu" class="dropdown-menu absolute z-[60] w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] shadow-md rounded-md overflow-y-auto custom-scrollbar p-1.5 flex flex-col {javaDropdownUp ? 'bottom-full mb-1.5' : 'mt-1.5'}" class:drop-up={javaDropdownUp} style="max-height: {javaDropdownMaxH}px">
                    {@render menuOption("Auto-detect (Recommended)", !store.settings?.java_path && !showCustomPath, () => { showCustomPath = false; customPathValue = ""; handleSettingChange({ ...store.settings!, java_path: null } as LauncherSettings); isJavaDropdownOpen = false })}
                    {#each javaInstallations as path (path)}
                      {@render menuOption(path, store.settings?.java_path === path && !showCustomPath, () => { showCustomPath = false; customPathValue = ""; handleSettingChange({ ...store.settings!, java_path: path } as LauncherSettings); isJavaDropdownOpen = false })}
                    {/each}
                    {@render menuOption("Custom Path...", showCustomPath, () => { showCustomPath = true; customPathValue = store.settings?.java_path || ""; isJavaDropdownOpen = false })}
                  </div>
                {/if}
              </div>

              {#if showCustomPath}
                <input
                  type="text"
                  class="w-full h-9 bg-[var(--content-bg)] rounded-md px-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] font-mono min-w-0 mt-2"
                  placeholder="C:\\Program Files\\Java\\jdk-21\\bin\\javaw.exe"
                  bind:value={customPathValue}
                  onblur={() => { if (customPathValue.trim()) handleSettingChange({ ...store.settings!, java_path: customPathValue.trim() } as LauncherSettings) }}
                  onkeydown={(e) => { if (e.key === 'Enter' && customPathValue.trim()) { handleSettingChange({ ...store.settings!, java_path: customPathValue.trim() } as LauncherSettings); (e.currentTarget as HTMLInputElement).blur() } }}
                />
              {/if}

              <div class="mt-4 pt-3 border-t border-[var(--border-subtle)]">
                <h5 class="text-sm font-medium text-[var(--text-primary)] leading-tight">Custom Java arguments</h5>
                <p class="text-xs text-[var(--text-muted)] mt-0.5 mb-2.5">
                  Extra JVM flags appended at launch for every instance.
                </p>
                <textarea
                  bind:value={javaArgsText}
                  oninput={(e) => handleJavaArgsChange((e.currentTarget as HTMLTextAreaElement).value)}
                  onfocus={() => (javaArgsFocused = true)}
                  onblur={() => commitJavaArgsFocus()}
                  rows={2}
                  spellcheck="false"
                  placeholder="-Xmx4G -XX:+UseG1GC"
                  class="w-full bg-[var(--content-bg)] rounded-md px-3 py-2 text-xs font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-y min-h-[56px] max-h-40 custom-scrollbar"
                ></textarea>
              </div>
            </section>
          {:else if activeTab === "launcher"}
            {#snippet toggleRow(label: string, desc: string, checked: boolean, toggle: () => void, id?: string)}
              <div {id} class="flex items-center gap-3 py-2.5">
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <div class="flex-1 min-w-0" onclick={toggle}>
                  <p class="text-sm font-medium text-[var(--text-primary)] leading-tight">{label}</p>
                  <p class="text-xs text-[var(--text-muted)] mt-0.5">{desc}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={checked}
                  aria-label={label}
                  onclick={toggle}
                  class="relative w-9 h-[22px] rounded-full shrink-0 cursor-pointer {checked ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-hover-strong)]'}"
                >
                  <span class="absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform {checked ? 'translate-x-[14px]' : ''}"></span>
                </button>
              </div>
            {/snippet}

            <section class="rounded-md bg-[var(--bg-tertiary)] px-4 py-1.5 divide-y divide-[var(--border-subtle)]">
              <div class="flex items-center gap-3 py-2.5">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-[var(--text-primary)] leading-tight">Default tab</p>
                  <p class="text-xs text-[var(--text-muted)] mt-0.5">The tab shown when the launcher opens.</p>
                </div>
                <div class="relative shrink-0" bind:this={tabDropdownEl}>
                  <button
                    onclick={() => isTabDropdownOpen = !isTabDropdownOpen}
                    class="relative h-8 pl-3 pr-8 bg-[var(--content-bg)] hover:bg-[var(--bg-hover)] text-sm text-[var(--text-primary)] rounded-md flex items-center gap-2 cursor-pointer capitalize min-w-[130px]"
                  >
                    {store.settings?.default_tab || "home"}
                    <div class="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      {#if isTabDropdownOpen}
                        <ChevronUp size={14} strokeWidth={3} />
                      {:else}
                        <ChevronDown size={14} strokeWidth={3} />
                      {/if}
                    </div>
                  </button>
                  {#if isTabDropdownOpen}
                    <div role="menu" class="dropdown-menu drop-right absolute right-0 z-[60] w-full min-w-[160px] bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] shadow-md rounded-md overflow-hidden p-1.5 flex flex-col mt-1.5">
                      {#each ["home", "instances", "addons", "skins", "screenshots", "servers"] as tab (tab)}
                        {@render menuOption(tab.charAt(0).toUpperCase() + tab.slice(1), (store.settings?.default_tab || "home") === tab, () => { handleSettingChange({ ...store.settings!, default_tab: tab } as LauncherSettings); isTabDropdownOpen = false })}
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>

              {@render toggleRow(
                "Auto-navigate to console",
                "Switch to the Console tab when an instance launches.",
                store.settings?.auto_navigate_to_console ?? true,
                () => handleSettingChange({ ...store.settings!, auto_navigate_to_console: !(store.settings?.auto_navigate_to_console ?? true) } as LauncherSettings),
                "settings-console"
              )}

              {@render toggleRow(
                "Discord Rich Presence",
                "Show Octane Launcher activity on Discord.",
                store.settings?.discord_rpc ?? true,
                () => handleSettingChange({ ...store.settings!, discord_rpc: !(store.settings?.discord_rpc ?? true) } as LauncherSettings)
              )}

              {@render toggleRow(
                "Cat mode",
                "A cat lays down at the top of the launcher.",
                store.settings?.cat_mode ?? false,
                () => handleSettingChange({ ...store.settings!, cat_mode: !(store.settings?.cat_mode ?? false) } as LauncherSettings)
              )}

              <div class="flex items-center gap-3 py-2.5">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-[var(--text-primary)] leading-tight">Run onboarding again</p>
                  <p class="text-xs text-[var(--text-muted)] mt-0.5">Revisit first-time setup or import instances from other launchers.</p>
                </div>
                <button
                  onclick={() => { onClose(); setShowOnboarding(true) }}
                  class="h-8 px-3 shrink-0 text-sm font-medium rounded-md bg-[var(--content-bg)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] cursor-pointer"
                >
                  Show onboarding
                </button>
              </div>
            </section>
          {:else if activeTab === "storage"}
            <section class="rounded-md bg-[var(--bg-tertiary)] p-4">
              <h4 class="text-sm font-medium text-[var(--text-primary)] leading-tight mb-3">Disk usage</h4>
              {#if storageLoading}
                <div class="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <Loader2 size={14} class="animate-spin" />
                  <span>Calculating storage usage...</span>
                </div>
              {:else if storageCategories.length === 0}
                <div class="text-xs text-[var(--text-muted)]">No data</div>
              {:else}
                <div class="h-2 rounded-full overflow-hidden flex bg-[var(--content-bg)]">
                  {#each storageCategories as cat (cat.name)}
                    <div
                      style="width: {(cat.size_bytes / totalBytes) * 100}%; background-color: {storageColors[cat.name] || '#6b7280'}"
                      class="h-full first:rounded-l-full last:rounded-r-full"
                    ></div>
                  {/each}
                </div>
                <div class="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
                  {#each storageCategories as cat (cat.name)}
                    <div class="flex items-center gap-1.5 text-xs">
                      <div class="w-2.5 h-2.5 rounded-sm" style="background-color: {storageColors[cat.name] || '#6b7280'}"></div>
                      <span class="text-[var(--text-muted)]">{cat.name}</span>
                      <span class="text-[var(--text-primary)] font-medium">{formatFileSize(cat.size_bytes)}</span>
                    </div>
                  {/each}
                </div>
              {/if}
            </section>

            <section class="rounded-md bg-[var(--bg-tertiary)] px-4 py-1.5">
              <div class="flex items-center gap-3 py-2.5">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-[var(--text-primary)] leading-tight">Game directory</p>
                  <p class="text-xs text-[var(--text-muted)] font-mono break-all mt-0.5">{store.launcherDirectory || "Loading..."}</p>
                </div>
                <button
                  onclick={() => handleOpenDirectory(store.launcherDirectory)}
                  disabled={!store.launcherDirectory}
                  class="h-8 px-3 shrink-0 text-sm font-medium rounded-md bg-[var(--content-bg)] hover:bg-[var(--bg-hover)] disabled:opacity-50 text-[var(--text-primary)] cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <FolderOpen size={14} />
                  Open folder
                </button>
              </div>
            </section>

            <section class="rounded-md bg-[var(--bg-tertiary)] p-4">
              <TrashSection onAlert={(alert) => alertModal = alert} />
            </section>
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

