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
      class="blur-border bg-[var(--bg-secondary)] rounded w-full max-w-md shadow-2xl modal-content"
      role="presentation"
      class:closing={isClosing}
      onclick={(e) => e.stopPropagation()}
      style="pointer-events: auto"
    >
      <div class="flex items-center justify-between px-6 pt-6 pb-5">
        <div>
          <h2 class="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Export Instance</h2>
          <p class="text-sm text-[var(--text-muted)] mt-0.5">{instanceName}</p>
        </div>
        <button
          onclick={handleClose}
          class="p-1.5 hover:bg-[var(--bg-hover-strong)] rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div class="px-6 pb-4 space-y-4">
        <div>
          <div class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Export Format</div>
          <div class="bg-[var(--bg-tertiary)] rounded p-4 space-y-3">
            <label class="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                checked={exportFormat === "mrpack"}
                onchange={() => exportFormat = "mrpack"}
                disabled={isExporting}
                class="w-4 h-4 text-[var(--accent-primary)] border-gray-500 focus:ring-[var(--accent-primary)] cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
              />
              <div class="flex-1">
                <span class="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                  Modrinth Modpack (.mrpack)
                </span>
                <p class="text-xs text-[var(--text-muted)] mt-0.5">
                  Standard modpack format
                </p>
              </div>
            </label>

            <label class="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                checked={exportFormat === "zip"}
                onchange={() => exportFormat = "zip"}
                disabled={isExporting}
                class="w-4 h-4 text-[var(--accent-primary)] border-gray-500 focus:ring-[var(--accent-primary)] cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
              />
              <div class="flex-1">
                <span class="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                  Standard ZIP Archive (.zip)
                </span>
                <p class="text-xs text-[var(--text-muted)] mt-0.5">
                  Direct backup of instance folder structure
                </p>
              </div>
            </label>
          </div>
        </div>

        <div>
          <div class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Include in Export</div>
          <div class="bg-[var(--bg-tertiary)] rounded p-4 space-y-3">
            <label class="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={includeWorlds}
                onchange={(e) => includeWorlds = (e.target as HTMLInputElement).checked}
                disabled={isExporting}
                class="w-4 h-4 rounded border-2 border-gray-500 bg-transparent checked:bg-[var(--accent-primary)] checked:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-0 transition-all cursor-pointer flex-shrink-0"
              />
              <div class="flex-1">
                <span class="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                  Worlds (saves/)
                </span>
                <p class="text-xs text-[var(--text-muted)] mt-0.5">
                  Include all saved worlds and maps
                </p>
              </div>
            </label>

            <label class="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={includeResourcePacks}
                onchange={(e) => includeResourcePacks = (e.target as HTMLInputElement).checked}
                disabled={isExporting}
                class="w-4 h-4 rounded border-2 border-gray-500 bg-transparent checked:bg-[var(--accent-primary)] checked:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-0 transition-all cursor-pointer flex-shrink-0"
              />
              <div class="flex-1">
                <span class="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                  Resource Packs
                </span>
                <p class="text-xs text-[var(--text-muted)] mt-0.5">
                  Include installed resource packs
                </p>
              </div>
            </label>

            <label class="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={includeShaderPacks}
                onchange={(e) => includeShaderPacks = (e.target as HTMLInputElement).checked}
                disabled={isExporting}
                class="w-4 h-4 rounded border-2 border-gray-500 bg-transparent checked:bg-[var(--accent-primary)] checked:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-0 transition-all cursor-pointer flex-shrink-0"
              />
              <div class="flex-1">
                <span class="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                  Shader Packs
                </span>
                <p class="text-xs text-[var(--text-muted)] mt-0.5">
                  Include installed shader packs
                </p>
              </div>
            </label>

            <label class="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={includeMods}
                onchange={(e) => includeMods = (e.target as HTMLInputElement).checked}
                disabled={isExporting}
                class="w-4 h-4 rounded border-2 border-gray-500 bg-transparent checked:bg-[var(--accent-primary)] checked:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-0 transition-all cursor-pointer flex-shrink-0"
              />
              <div class="flex-1">
                <span class="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                  Mods
                </span>
                <p class="text-xs text-[var(--text-muted)] mt-0.5">
                  Include all installed mods
                </p>
              </div>
            </label>

            <label class="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={includeConfig}
                onchange={(e) => includeConfig = (e.target as HTMLInputElement).checked}
                disabled={isExporting}
                class="w-4 h-4 rounded border-2 border-gray-500 bg-transparent checked:bg-[var(--accent-primary)] checked:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-0 transition-all cursor-pointer flex-shrink-0"
              />
              <div class="flex-1">
                <span class="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                  Configuration
                </span>
                <p class="text-xs text-[var(--text-muted)] mt-0.5">
                  Include config files and settings
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-3 px-6 pb-6 pt-3">
        <button
          onclick={handleClose}
          disabled={isExporting}
          class="px-5 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover-strong)] text-[var(--text-primary)] rounded font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onclick={handleExport}
          disabled={isExporting}
          class="px-5 py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {#if isExporting}
            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span>Exporting...</span>
          {:else}
            <Download size={16} strokeWidth={2} />
            <span>Export Instance</span>
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
