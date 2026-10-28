<script lang="ts">
  import { invoke } from "@tauri-apps/api/core"
  import { untrack } from "svelte"
  import { ChevronDown, Loader2 } from "lucide-svelte"
  import { store } from "../../../lib/launcherStore.svelte"
  import type { LauncherSettings, SystemInfo } from "../../../types"
  import MenuOption from "./menu-option.svelte"

  let { onChange, onChangeDebounced }: {
    onChange: (settings: LauncherSettings) => void
    onChangeDebounced: (settings: LauncherSettings) => void
  } = $props()

  let javaInstallations: string[] = $state([])
  let isLoadingJava = $state(false)
  let showCustomPath = $state(false)
  let customPathValue = $state("")
  let systemInfo: SystemInfo | null = $state(null)
  let isJavaDropdownOpen = $state(false)
  let javaDropdownEl: HTMLDivElement | undefined = $state()
  let javaDropdownUp = $state(false)
  let javaDropdownMaxH = $state(240)
  let ramSliderValue = $state(store.settings?.memory_mb ?? 4096)
  let ramTextValue = $state(((store.settings?.memory_mb ?? 4096) / 1024).toFixed(1))
  let ramTextFocused = $state(false)
  let javaArgsText = $state("")
  let javaArgsFocused = $state(false)

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

  function commitJavaArgsFocus() {
    javaArgsFocused = false
    const normalized = javaArgsText.replace(/\s+/g, " ").trim()
    onChange({ ...store.settings!, java_args: normalized === "" ? null : normalized } as LauncherSettings)
    javaArgsText = store.settings?.java_args ?? ""
  }

  function handleJavaArgsChange(value: string) {
    javaArgsText = value
    const normalized = value.replace(/\s+/g, " ").trim()
    onChangeDebounced({ ...store.settings!, java_args: normalized === "" ? null : normalized } as LauncherSettings)
  }

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
    onChangeDebounced({ ...store.settings!, memory_mb: mb } as LauncherSettings)
  }

  let ramPercent = $derived(store.settings ? ((ramSliderValue - 1024) / (((systemInfo as SystemInfo | null)?.total_memory_mb || 32768) - 1024)) * 100 : 0)

  async function loadSystemInfo() {
    try {
      const info = await invoke<SystemInfo>("get_system_info")
      systemInfo = info
    } catch {}
  }

  async function loadJavaInstallations() {
    isLoadingJava = true
    try {
      const installations = await invoke<string[]>("detect_java_installations")
      javaInstallations = installations
    } catch {} finally {
      isLoadingJava = false
    }
  }

  $effect(() => {
    untrack(() => {
      ramSliderValue = store.settings?.memory_mb ?? 4096
      if (!javaArgsFocused) javaArgsText = store.settings?.java_args ?? ""
      loadSystemInfo()
      loadJavaInstallations()
    })
  })

  $effect(() => {
    if (!ramTextFocused) ramTextValue = (ramSliderValue / 1024).toFixed(1)
  })

  $effect(() => {
    const nextJavaArgs = store.settings?.java_args ?? ""
    if (!javaArgsFocused && nextJavaArgs !== javaArgsText) {
      javaArgsText = nextJavaArgs
    }
  })

  $effect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (javaDropdownEl && !javaDropdownEl.contains(event.target as Node)) {
        isJavaDropdownOpen = false
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
</script>

<section>
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
        class="w-[4ch] rounded-sm px-1 -mx-1 text-2xl font-bold text-[var(--text-primary)] font-mono text-right cursor-text bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] focus:outline-none"
      />
      <span class="text-sm text-[var(--text-muted)] font-sans font-normal ml-1">GB</span>
    </div>
  </div>
  <div class="relative h-6 flex items-center">
    <div class="absolute inset-x-0 h-2 bg-[var(--bg-tertiary)] rounded-full"></div>
    <div class="absolute h-2 rounded-full" style="width: calc(3px + (100% - 6px) * {ramPercent / 100}); background: var(--accent-primary)"></div>
    <div class="absolute w-1.5 h-5 rounded-full bg-[var(--accent-primary)] -translate-x-1/2 top-1/2 -mt-2.5" style="left: calc(3px + (100% - 6px) * {ramPercent / 100})"></div>
    <input
      type="range" min="1024" max={systemInfo?.total_memory_mb || 32768} step="512"
      bind:value={ramSliderValue}
      oninput={() => onChangeDebounced({ ...store.settings!, memory_mb: ramSliderValue } as LauncherSettings)}
      class="absolute inset-0 w-full opacity-0 cursor-pointer"
    />
  </div>
</section>

<section>
  <div class="flex items-center justify-between gap-3 mb-3">
    <div class="min-w-0">
      <h4 class="text-sm font-medium text-[var(--text-primary)] leading-tight">Java runtime</h4>
      <p class="text-xs text-[var(--text-muted)] mt-0.5">Which runtime Minecraft runs on.</p>
    </div>
    <button
      onclick={loadJavaInstallations}
      disabled={isLoadingJava}
      class="h-8 px-3 shrink-0 text-sm font-medium rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
    >
      {#if isLoadingJava}<Loader2 size={14} class="animate-spin" />{/if}
      Rescan
    </button>
  </div>

  <div class="relative" bind:this={javaDropdownEl}>
    <button
      onclick={toggleJavaDropdown}
      class="w-full h-8 bg-[var(--bg-tertiary)] px-3 text-sm text-[var(--text-primary)] text-left flex items-center justify-between cursor-pointer min-w-0 rounded-md hover:bg-[var(--bg-hover)]"
    >
      <span class="truncate">
        {showCustomPath ? "Custom Path..." : (store.settings?.java_path || "Auto-detect (Recommended)")}
      </span>
      <ChevronDown size={14} strokeWidth={3} class="shrink-0 ml-2 transition-transform {isJavaDropdownOpen ? 'rotate-180' : ''}" />
    </button>

    {#if isJavaDropdownOpen}
      <div role="menu" class="dropdown-menu absolute z-[60] w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] shadow-md rounded-md overflow-y-auto custom-scrollbar p-1.5 flex flex-col {javaDropdownUp ? 'bottom-full mb-1.5' : 'mt-1.5'}" class:drop-up={javaDropdownUp} style="max-height: {javaDropdownMaxH}px">
        <MenuOption label="Auto-detect (Recommended)" checked={!store.settings?.java_path && !showCustomPath} onclick={() => { showCustomPath = false; customPathValue = ""; onChange({ ...store.settings!, java_path: null } as LauncherSettings); isJavaDropdownOpen = false }} />
        {#each javaInstallations as path (path)}
          <MenuOption label={path} checked={store.settings?.java_path === path && !showCustomPath} onclick={() => { showCustomPath = false; customPathValue = ""; onChange({ ...store.settings!, java_path: path } as LauncherSettings); isJavaDropdownOpen = false }} />
        {/each}
        <MenuOption label="Custom Path..." checked={showCustomPath} onclick={() => { showCustomPath = true; customPathValue = store.settings?.java_path || ""; isJavaDropdownOpen = false }} />
      </div>
    {/if}
  </div>

  {#if showCustomPath}
    <input
      type="text"
      class="w-full h-8 bg-[var(--bg-tertiary)] rounded-md px-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] font-mono min-w-0 mt-2"
      placeholder="C:\\Program Files\\Java\\jdk-21\\bin\\javaw.exe"
      bind:value={customPathValue}
      onblur={() => { if (customPathValue.trim()) onChange({ ...store.settings!, java_path: customPathValue.trim() } as LauncherSettings) }}
      onkeydown={(e) => { if (e.key === 'Enter' && customPathValue.trim()) { onChange({ ...store.settings!, java_path: customPathValue.trim() } as LauncherSettings); (e.currentTarget as HTMLInputElement).blur() } }}
    />
  {/if}

  <div class="mt-5">
    <h5 class="text-sm font-medium text-[var(--text-primary)] leading-tight">Custom Java arguments</h5>
    <p class="text-xs text-[var(--text-muted)] mt-0.5 mb-3">
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
      class="w-full bg-[var(--bg-tertiary)] rounded-md px-3 py-2 text-xs font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-y min-h-[56px] max-h-40 custom-scrollbar"
    ></textarea>
  </div>
</section>
