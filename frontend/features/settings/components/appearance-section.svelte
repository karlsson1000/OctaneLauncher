<script lang="ts">
  import { invoke, convertFileSrc } from "@tauri-apps/api/core"
  import { Check, FileText, ImagePlus, Palette, RefreshCw, Trash2 } from "lucide-svelte"
  import { store, loadBackground } from "../../../lib/launcherStore.svelte"
  import { applyCustomTheme } from "../../../lib/custom-theme"
  import type { LauncherSettings } from "../../../types"

  const THEMES = [
    { id: "octane", label: "Octane", colors: ["#20232a", "#22252c", "#4572e3", "#e6e6e6"] },
    { id: "light", label: "Light", colors: ["#e8e9ee", "#dedfe6", "#4572e3", "#20212b"] },
    { id: "rose", label: "Rosé", colors: ["#28212e", "#332a3a", "#f472b6", "#e8e8ee"] },
    { id: "forest", label: "Forest", colors: ["#222c25", "#2d3831", "#43d978", "#e8eee9"] },
    { id: "custom", label: "Custom", colors: ["#20232a", "#22252c", "#4572e3", "#e6e6e6"] },
  ] as const

  const CUSTOM_DOTS = ["#ff6b6b", "#ffa94d", "#51cf66", "#4dabf7"]

  let { onChange, onChangeDebounced, onAlert }: {
    onChange: (settings: LauncherSettings) => void
    onChangeDebounced: (settings: LauncherSettings) => void
    onAlert: (alert: { isOpen: boolean; title: string; message: string; type: "warning" | "danger" | "success" | "info" }) => void
  } = $props()

  let backgroundPreview = $state<string | null>(null)
  let fileInputEl: HTMLInputElement | undefined = $state()
  let themeReloaded = $state(false)
  let themeReloadTimeout: ReturnType<typeof setTimeout> | undefined

  $effect(() => { loadSidebarBackground() })
  $effect(() => () => clearTimeout(themeReloadTimeout))

  async function openThemeFile() {
    try {
      await invoke("open_custom_theme")
    } catch (error) {
      onAlert({ isOpen: true, title: "An error occurred", message: "Failed to open theme.css" + `: ${error}`, type: "danger" })
    }
  }

  async function reloadTheme() {
    themeReloaded = await applyCustomTheme()
    if (!themeReloaded) return
    clearTimeout(themeReloadTimeout)
    themeReloadTimeout = setTimeout(() => themeReloaded = false, 1500)
  }

  async function loadSidebarBackground() {
    try {
      const path = await invoke<string | null>("get_background")
      backgroundPreview = path ? `${convertFileSrc(path)}?v=${Date.now()}` : null
    } catch {}
  }

  async function handleFileSelect(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      onAlert({ isOpen: true, title: "Invalid File", message: "Please select an image file (PNG, JPG, etc.)", type: "warning" })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      onAlert({ isOpen: true, title: "File Too Large", message: "Image must be smaller than 10MB", type: "warning" })
      return
    }

    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = e.target?.result as string

        try {
          await invoke("set_background", { imageData: base64 })
          await loadSidebarBackground()
          loadBackground()
        } catch (error) {
          onAlert({ isOpen: true, title: "An error occurred", message: "Failed to save background" + `: ${error}`, type: "danger" })
        }
      }
      reader.readAsDataURL(file)
    } catch (error) {
      onAlert({ isOpen: true, title: "An error occurred", message: "Failed to read image file", type: "danger" })
    }

    if (fileInputEl) fileInputEl.value = ''
  }

  async function handleRemoveBackground() {
    try {
      await invoke("remove_background")
      backgroundPreview = null
      loadBackground()
    } catch (error) {
      onAlert({ isOpen: true, title: "An error occurred", message: "Failed to remove background" + `: ${error}`, type: "danger" })
    }
  }
</script>

<section>
  <h4 class="text-sm font-medium text-[var(--text-primary)] leading-tight">Theme</h4>
  <p class="text-xs text-[var(--text-muted)] mt-0.5 mb-3">Pick the color scheme for the whole launcher.</p>
  <div class="grid grid-cols-5 gap-3">
    {#each THEMES as theme (theme.id)}
      {@const active = store.settings?.theme === theme.id}
      {@const isCustom = theme.id === "custom"}
      {@const dots = isCustom ? CUSTOM_DOTS : theme.colors}
      <button
        onclick={() => store.settings && onChange({ ...store.settings, theme: theme.id })}
        aria-label={theme.label}
        class="group flex flex-col gap-1.5 cursor-pointer"
      >
        <div class="relative h-16 rounded-md overflow-hidden transition-all {active ? '' : 'group-hover:brightness-110'}" style="background: {theme.colors[0]}">
          <div class="h-full flex flex-col items-center justify-center gap-1.5">
            <Palette
              size={24}
              strokeWidth={2}
              class={isCustom ? "text-[var(--text-secondary)]" : ""}
              style={isCustom ? undefined : `color: ${theme.colors[3]}; opacity: 0.7`}
            />
            <div class="flex items-center gap-1">
              {#each dots as dot}
                <span class="w-2.5 h-2.5 rounded-full" style="background: {dot}; box-shadow: inset 0 0 0 1px rgba(128, 128, 128, 0.35)"></span>
              {/each}
            </div>
          </div>
          {#if active}
            <div class="absolute inset-0 flex items-center justify-center bg-black/50">
              <Check size={32} strokeWidth={3.5} style="color: {isCustom ? CUSTOM_DOTS[0] : theme.colors[2]}" />
            </div>
          {/if}
        </div>
        <span
          class="text-xs text-center transition-colors {active ? (isCustom ? 'font-medium' : 'text-[var(--accent-primary)] font-medium') : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'}"
          style={active && isCustom ? `color: ${CUSTOM_DOTS[0]}` : undefined}
        >
          {theme.label}
        </span>
      </button>
    {/each}
  </div>

  {#if store.settings?.theme === "custom"}
    <div class="mt-3 rounded-md bg-[var(--bg-tertiary)] px-3 py-2.5">
      <div class="flex items-center gap-2">
        <button
          onclick={openThemeFile}
          class="px-3 py-1.5 inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
        >
          <FileText size={14} />
          Open file
        </button>
        <button
          onclick={reloadTheme}
          class="px-3 py-1.5 inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
        >
          <RefreshCw size={14} />
          {themeReloaded ? "Reloaded" : "Reload"}
        </button>
      </div>
    </div>
  {/if}
</section>

<section>
  <h4 class="text-sm font-medium text-[var(--text-primary)] leading-tight mb-3">Custom background</h4>
  {#if backgroundPreview}
    <div class="relative group">
      <div class="h-36 rounded-md overflow-hidden bg-[var(--bg-tertiary)]">
        <img src={backgroundPreview} alt="Background" class="w-full h-full object-cover" />
      </div>
      <div class="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-2">
        <button
          onclick={() => fileInputEl?.click()}
          class="px-3 py-1.5 inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
        >
          <ImagePlus size={14} />
          Change
        </button>
        <button
          onclick={handleRemoveBackground}
          class="px-3 py-1.5 inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-red-400 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
        >
          <Trash2 size={14} />
          Remove
        </button>
      </div>
    </div>
  {:else}
    <button onclick={() => fileInputEl?.click()} class="w-full h-24 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] rounded-md flex flex-col items-center justify-center gap-1.5 cursor-pointer">
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
          <div class="absolute inset-x-0 h-2 bg-[var(--bg-tertiary)] rounded-full"></div>
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
      {@render settingSlider("Darkness", `${store.settings?.background_darkness ?? 80}%`, 0, 100, 1, store.settings?.background_darkness ?? 80, (v) => onChangeDebounced({ ...store.settings!, background_darkness: v } as LauncherSettings))}
    </div>
    <div class="mt-2">
      {@render settingSlider("Blur", `${store.settings?.background_blur ?? 0}px`, 0, 20, 1, store.settings?.background_blur ?? 0, (v) => onChangeDebounced({ ...store.settings!, background_blur: v } as LauncherSettings))}
    </div>
  {/if}
</section>
