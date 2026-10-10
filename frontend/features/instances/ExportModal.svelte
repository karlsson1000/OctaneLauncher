<script lang="ts">
  import { invoke } from "@tauri-apps/api/core"
  import { save } from "@tauri-apps/plugin-dialog"
  import { X, Download } from "lucide-svelte"
  import AlertModal from "../../components/ui/AlertModal.svelte"

  let { instanceName, onClose }: {
    instanceName: string
    onClose: () => void
  } = $props()

  let isExporting = $state(false)
  let isClosing = $state(false)
  let exportFormat = $state<"zip" | "mrpack">("mrpack")
  let includeWorlds = $state(true)
  let includeResourcePacks = $state(true)
  let includeShaderPacks = $state(true)
  let includeMods = $state(true)
  let includeConfig = $state(true)
  let alertModal = $state<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null>(null)
  let autoCloseTimeout: ReturnType<typeof setTimeout> | undefined

  $effect(() => {
    return () => { if (autoCloseTimeout) clearTimeout(autoCloseTimeout) }
  })

  type PreviewEntry = { text: string; enabled: boolean }

  let previewTitle = $derived(`${instanceName}.${exportFormat === "mrpack" ? "mrpack" : "zip"}`)
  let previewEntries = $derived.by<PreviewEntry[]>(() => {
    const file = (text: string): PreviewEntry => ({ text, enabled: true })
    const flag = (text: string, enabled: boolean): PreviewEntry => ({ text, enabled })
    if (exportFormat === "mrpack") {
      return [
        file("modrinth.index.json"),
        flag("overrides/mods/", includeMods),
        flag("overrides/saves/", includeWorlds),
        flag("overrides/resourcepacks/", includeResourcePacks),
        flag("overrides/shaderpacks/", includeShaderPacks),
        flag("overrides/config/", includeConfig),
      ]
    }
    return [
      file("instance.json"),
      file("icon.png"),
      flag("saves/", includeWorlds),
      flag("resourcepacks/", includeResourcePacks),
      flag("shaderpacks/", includeShaderPacks),
      flag("mods/", includeMods),
      flag("config/", includeConfig),
      flag("options.txt", includeConfig),
    ]
  })

  function handleClose() {
    isClosing = true
    setTimeout(() => {
      isClosing = false
      onClose()
    }, 150)
  }

  async function handleExport() {
    try {
      const defaultExtension = exportFormat === "mrpack" ? "mrpack" : "zip"
      const defaultFileName = `${instanceName}.${defaultExtension}`

      const savePath = await save({
        defaultPath: defaultFileName,
        filters: [{
          name: exportFormat === "mrpack" ? "Modrinth Modpack" : "ZIP Archive",
          extensions: [defaultExtension]
        }]
      })

      if (!savePath) return

      isExporting = true

      await invoke("export_instance", {
        instanceName: instanceName,
        outputPath: savePath,
        exportFormat: exportFormat,
        includeWorlds: includeWorlds,
        includeResourcePacks: includeResourcePacks,
        includeShaderPacks: includeShaderPacks,
        includeMods: includeMods,
        includeConfig: includeConfig,
      })

      alertModal = {
        isOpen: true,
        title: "Success",
        message: `Instance exported successfully to ${savePath}`,
        type: "success"
      }

      autoCloseTimeout = setTimeout(() => {
        handleClose()
      }, 1500)
    } catch (error) {
      console.error("Export error:", error)
      alertModal = {
        isOpen: true,
        title: "Error",
        message: `Failed to export instance: ${error}`,
        type: "danger"
      }
    } finally {
      isExporting = false
    }
  }
</script>

<div
    class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop {isClosing ? 'closing' : ''}"
    role="presentation"
    class:closing={isClosing}
    onclick={handleClose}
  >
    <div
      class="bg-[var(--content-bg)] rounded-md border border-[var(--border-subtle)] shadow-md w-full max-w-2xl modal-content p-5 space-y-5"
      role="presentation"
      class:closing={isClosing}
      onclick={(e) => e.stopPropagation()}
      style="pointer-events: auto"
    >
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-lg font-semibold text-[var(--text-primary)] tracking-tight leading-tight">Export Instance</h2>
          <p class="text-[13px] text-[var(--text-muted)] truncate">{instanceName}</p>
        </div>
        <button
          onclick={handleClose}
          class="p-1.5 -mt-0.5 hover:bg-[var(--bg-hover)] rounded-sm transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer shrink-0 self-start"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div class="grid grid-cols-2 gap-5 -mt-2">
        <div class="order-2">
          <div class="grid grid-cols-2 gap-1 p-1 rounded-md bg-[var(--bg-tertiary)]">
            <button
              onclick={() => exportFormat = "mrpack"}
              disabled={isExporting}
              class="h-9 rounded-sm text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed {exportFormat === 'mrpack' ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
            >
              .mrpack
            </button>
            <button
              onclick={() => exportFormat = "zip"}
              disabled={isExporting}
              class="h-9 rounded-sm text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed {exportFormat === 'zip' ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
            >
              .zip
            </button>
          </div>
          <p class="text-xs text-[var(--text-muted)] mt-1.5">
            {exportFormat === "mrpack" ? "Standard modpack format" : "Direct backup of instance folder structure"}
          </p>
          <div class="mt-4 rounded-md bg-[var(--bg-tertiary)] p-3 overflow-x-auto">
            <p class="font-mono text-sm font-semibold text-[var(--text-primary)]/85 truncate">{previewTitle}</p>
            <div class="font-mono text-xs leading-relaxed whitespace-pre">
              {#each previewEntries as entry, idx}
                {@const glyph = idx === previewEntries.length - 1 ? "└─" : "├─"}
                <span class="block truncate {entry.text.endsWith('/') ? 'text-[#60a5fa]' : 'text-[#34d399]'} {entry.enabled ? '' : 'opacity-40'}">{glyph} {entry.text}</span>
              {/each}
            </div>
          </div>
        </div>

        <div class="order-1">
          {#snippet includeRow(label: string, desc: string, checked: boolean, toggle: () => void)}
            <div class="flex items-center gap-3 py-2.5">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-[var(--text-primary)] leading-tight">{label}</p>
              <p class="text-xs text-[var(--text-muted)] mt-0.5">{desc}</p>
            </div>
              <button
                role="switch"
                aria-checked={checked}
                aria-label={label}
                onclick={toggle}
                disabled={isExporting}
                class="relative w-9 h-[22px] rounded-full transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 {checked ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-hover-strong)]'}"
              >
                <span class="absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform {checked ? 'translate-x-[14px]' : ''}"></span>
              </button>
            </div>
          {/snippet}
          <div class="rounded-md bg-[var(--bg-tertiary)] px-4 divide-y divide-[var(--border-subtle)]">
            {@render includeRow("Worlds", "Everything in saves/", includeWorlds, () => includeWorlds = !includeWorlds)}
            {@render includeRow("Resource Packs", "Installed resource packs", includeResourcePacks, () => includeResourcePacks = !includeResourcePacks)}
            {@render includeRow("Shader Packs", "Installed shader packs", includeShaderPacks, () => includeShaderPacks = !includeShaderPacks)}
            {@render includeRow("Mods", "All installed mods", includeMods, () => includeMods = !includeMods)}
            {@render includeRow("Configuration", "Config files and settings", includeConfig, () => includeConfig = !includeConfig)}
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2">
        <button
          onclick={handleClose}
          disabled={isExporting}
          class="h-8 px-4 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onclick={handleExport}
          disabled={isExporting}
          class="h-8 px-4 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {#if isExporting}
            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span>Exporting…</span>
          {:else}
            <Download size={16} strokeWidth={2} />
            <span>Export</span>
          {/if}
        </button>
      </div>
    </div>
  </div>

{#if alertModal}
  <AlertModal
    isOpen={alertModal.isOpen}
    title={alertModal.title}
    message={alertModal.message}
    type={alertModal.type}
    onClose={() => alertModal = null}
  />
{/if}
