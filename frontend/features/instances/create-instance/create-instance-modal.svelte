<script lang="ts">
  import { invoke } from "@tauri-apps/api/core"
  import { open } from "@tauri-apps/plugin-dialog"
  import { fly } from "svelte/transition"
  import { cubicIn, cubicOut } from "svelte/easing"
  import { X, ArrowLeft, ArrowRight } from "lucide-svelte"
  import AlertModal from "../../../components/ui/alert-modal.svelte"
  import type { FabricVersion, NeoForgeVersion, ForgeVersion, Instance } from "../../../types"
  import { STEPS, STEP_ORDER, LOADERS, type CreateStep, type LoaderType, type MinecraftVersion } from "./constants"
  import NameStep from "./name-step.svelte"
  import VersionStep from "./version-step.svelte"
  import LoaderStep from "./loader-step.svelte"

  const pageClass = "px-5 pt-5 flex flex-col"

  let { instances, onClose, onSuccess, onStartCreating }: {
    instances: Instance[]
    onClose: () => void
    onSuccess: () => void
    onStartCreating: (instanceName: string) => void
  } = $props()

  let step = $state<CreateStep>("name")
  let navDir = $state(1)
  let loaderDir = $state(1)

  let isCreating = $state(false)
  let selectedVersion = $state("")
  let newInstanceName = $state("")
  let loaderType = $state<LoaderType>("vanilla")
  let fabricVersions = $state<FabricVersion[]>([])
  let selectedFabricVersion = $state("")
  let neoforgeVersions = $state<NeoForgeVersion[]>([])
  let selectedNeoforgeVersion = $state("")
  let forgeVersions = $state<ForgeVersion[]>([])
  let selectedForgeVersion = $state("")
  let isLoadingForge = $state(false)
  let isLoadingFabric = $state(false)
  let isLoadingNeoforge = $state(false)
  let forgeSupportedVersions = $state<string[]>([])
  let isClosing = $state(false)
  let alertModal = $state<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null>(null)

  let versionFilter = $state<"release" | "snapshot">("release")
  let allVersions = $state<MinecraftVersion[]>([])
  let isLoadingVersions = $state(false)
  let fabricSupportedVersions = $state<string[]>([])
  let neoforgeSupportedVersions = $state<string[]>([])

  let backdropArmed = false

  let instanceExists = $derived(
    instances.some(
      (instance: Instance) => instance.name.toLowerCase() === newInstanceName.trim().toLowerCase()
    )
  )

  $effect(() => {
    loadVersionsWithMetadata()
    loadFabricSupportedVersions()
    loadNeoforgeSupportedVersions()
    loadForgeSupportedVersions()
  })

  async function loadVersionsWithMetadata() {
    isLoadingVersions = true
    try {
      const versionsData = await invoke<MinecraftVersion[]>("get_minecraft_versions_with_metadata")
      allVersions = versionsData
      const firstRelease = versionsData.find((v: MinecraftVersion) => v.type === "release")
      if (firstRelease) selectedVersion = firstRelease.id
    } catch (error) {
      alertModal = { isOpen: true, title: "An error occurred", message: "Failed to load versions" + `: ${error}`, type: "danger" }
    } finally {
      isLoadingVersions = false
    }
  }

  async function loadFabricSupportedVersions() {
    try {
      const supported = await invoke<string[]>("get_supported_game_versions")
      fabricSupportedVersions = supported
    } catch {}
  }

  async function loadNeoforgeSupportedVersions() {
    try {
      const supported = await invoke<string[]>("get_neoforge_supported_game_versions")
      neoforgeSupportedVersions = supported
    } catch {}
  }

  async function loadForgeSupportedVersions() {
    try {
      const supported = await invoke<string[]>("get_forge_supported_game_versions")
      forgeSupportedVersions = supported
    } catch {}
  }

  let filteredVersions = $derived(
    allVersions.filter((v: MinecraftVersion) => v.type === versionFilter)
  )

  function isLoaderSupported(loader: LoaderType, version: string): boolean {
    if (loader === "vanilla") return true
    if (allVersions.find((v: MinecraftVersion) => v.id === version)?.type === "snapshot") return false
    const supported = loader === "fabric" ? fabricSupportedVersions
      : loader === "neoforge" ? neoforgeSupportedVersions
      : forgeSupportedVersions
    return supported.includes(version)
  }

  let hasUnavailableLoaders = $derived(LOADERS.some((l) => !isLoaderSupported(l.id, selectedVersion)))

  async function loadForgeVersions(forVersion: string) {
    isLoadingForge = true
    try {
      const versions = await invoke<ForgeVersion[]>("get_forge_versions")
      const filtered = versions.filter((v: ForgeVersion) => v.minecraft_version === forVersion)
      forgeVersions = filtered
      selectedForgeVersion = filtered.length > 0 ? filtered[0].forge_version : ""
    } catch (error) {
      alertModal = { isOpen: true, title: "An error occurred", message: "Failed to load Forge versions" + `: ${error}`, type: "danger" }
    } finally {
      isLoadingForge = false
    }
  }

  async function loadFabricVersions() {
    isLoadingFabric = true
    try {
      const versions = await invoke<FabricVersion[]>("get_fabric_versions")
      fabricVersions = versions
      const stableVersion = versions.find((v: FabricVersion) => v.stable)
      if (stableVersion) selectedFabricVersion = stableVersion.version
      else if (versions.length > 0) selectedFabricVersion = versions[0].version
    } catch (error) {
      alertModal = { isOpen: true, title: "An error occurred", message: "Failed to load Fabric versions" + `: ${error}`, type: "danger" }
    } finally {
      isLoadingFabric = false
    }
  }

  async function loadNeoforgeVersions(forVersion: string) {
    isLoadingNeoforge = true
    try {
      const versions = await invoke<NeoForgeVersion[]>("get_neoforge_versions")
      const filtered = versions.filter((v: NeoForgeVersion) => v.minecraft_version === forVersion)
      neoforgeVersions = filtered
      selectedNeoforgeVersion = filtered.length > 0 ? filtered[0].neoforge_version : ""
    } catch (error) {
      alertModal = { isOpen: true, title: "An error occurred", message: "Failed to load NeoForge versions" + `: ${error}`, type: "danger" }
    } finally {
      isLoadingNeoforge = false
    }
  }

  function handleLoaderChange(newLoader: LoaderType) {
    if (!isLoaderSupported(newLoader, selectedVersion)) return
    loaderDir = LOADERS.findIndex((l) => l.id === newLoader) > LOADERS.findIndex((l) => l.id === loaderType) ? 1 : -1
    loaderType = newLoader

    if (newLoader === "fabric" && fabricVersions.length === 0) loadFabricVersions()
    if (newLoader === "neoforge") loadNeoforgeVersions(selectedVersion)
    if (newLoader === "forge") loadForgeVersions(selectedVersion)
  }

  function applyVersion(versionId: string) {
    selectedVersion = versionId
    if (loaderType !== "vanilla" && !isLoaderSupported(loaderType, versionId)) {
      loaderType = "vanilla"
      return
    }
    if (loaderType === "neoforge") loadNeoforgeVersions(versionId)
    if (loaderType === "forge") loadForgeVersions(versionId)
  }

  function handleVersionSelect(versionId: string) {
    applyVersion(versionId)
  }

  function handleVersionFilterChange(filter: "release" | "snapshot") {
    versionFilter = filter
    const first = allVersions.find((v: MinecraftVersion) => v.type === filter)
    if (first) applyVersion(first.id)
  }

  function handleClose() {
    isClosing = true
    setTimeout(() => { onClose() }, 150)
  }

  async function handleImportFile() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Instance Files", extensions: ["mrpack", "zip"] }]
      })

      if (!selected) return

      const filePath = selected as string

      handleClose()

      let extractedName = ""
      try {
        extractedName = await invoke<string>("get_modpack_name_from_file", { filePath })
      } catch {
        extractedName = filePath.split(/[/\\]/).pop()?.replace(/\.(mrpack|zip)$/, "") || "Imported Instance"
      }

      let finalName = extractedName
      let counter = 1
      while (instances.some((i: Instance) => i.name.toLowerCase() === finalName.toLowerCase())) {
        finalName = `${extractedName} (${counter++})`
      }

      isCreating = true
      onStartCreating(finalName)
      await invoke("install_modpack_from_file", { filePath, instanceName: finalName, preferredGameVersion: null })
      onSuccess()
    } catch (error) {
      alertModal = { isOpen: true, title: "An error occurred", message: "Failed to import instance" + `: ${error}`, type: "danger" }
    } finally {
      isCreating = false
    }
  }

  async function handleCreateInstance() {
    if (!newInstanceName.trim() || instanceExists) return

    isCreating = true
    const finalName = newInstanceName.trim()

    onStartCreating(finalName)
    handleClose()

    try {
      await invoke<string>("create_instance", {
        instanceName: finalName,
        version: selectedVersion,
        loader: loaderType === "vanilla" ? null : loaderType,
        loaderVersion: loaderType === "fabric" ? selectedFabricVersion
          : loaderType === "neoforge" ? selectedNeoforgeVersion
          : loaderType === "forge" ? (forgeVersions.find((v: ForgeVersion) => v.forge_version === selectedForgeVersion)?.full_version ?? selectedForgeVersion)
          : null,
      })

      onSuccess()
    } catch (error) {
      alertModal = { isOpen: true, title: "An error occurred", message: "Failed to create instance" + `: ${error}`, type: "danger" }
    } finally {
      isCreating = false
    }
  }

  let isCreateDisabled = $derived(
    isCreating
    || !newInstanceName.trim()
    || instanceExists
    || isLoadingVersions
    || !selectedVersion
    || (loaderType === "fabric" && (isLoadingFabric || !selectedFabricVersion))
    || (loaderType === "neoforge" && (isLoadingNeoforge || !selectedNeoforgeVersion))
    || (loaderType === "forge" && (isLoadingForge || !selectedForgeVersion))
  )

  let canContinue = $derived(
    step === "name" ? !!newInstanceName.trim() && !instanceExists
    : step === "version" ? !!selectedVersion && !isLoadingVersions
    : !isCreateDisabled
  )

  function goTo(next: CreateStep) {
    if (next === step) return
    navDir = STEP_ORDER[next] > STEP_ORDER[step] ? 1 : -1
    step = next
  }

  function goNext() {
    if (!canContinue) return
    if (step === "name") goTo("version")
    else if (step === "version") goTo("loader")
    else handleCreateInstance()
  }

  function goBack() {
    if (step === "loader") goTo("version")
    else if (step === "version") goTo("name")
  }
</script>

{#snippet pageHeader()}
  <div class="flex items-center justify-between gap-3 px-5 pt-5">
    <h2 class="text-lg font-semibold text-[var(--text-primary)] tracking-tight leading-tight min-w-0 truncate">{newInstanceName.trim() ? `Creating ${newInstanceName.trim()}` : "New Instance"}</h2>
    <div class="flex items-center gap-4 shrink-0">
      <div class="flex items-center gap-1.5">
        {#each STEPS as s (s)}
          <div
            class="h-1 rounded-full transition-all duration-300 {step === s ? 'w-6 bg-[var(--accent-primary)]' : STEP_ORDER[s] < STEP_ORDER[step] ? 'w-2 bg-[var(--accent-primary)]/50' : 'w-2 bg-[var(--bg-hover)]'}"
          ></div>
        {/each}
      </div>
      <button onclick={handleClose} class="p-1.5 hover:bg-[var(--bg-hover)] rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer shrink-0">
        <X size={18} strokeWidth={2} />
      </button>
    </div>
  </div>
{/snippet}

{#snippet pageFooter()}
  <div class="flex items-center justify-between gap-2 px-5 pb-5 pt-3">
    {#if step === "name"}
      <button
        onclick={handleClose}
        disabled={isCreating}
        class="h-8 px-4 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        Cancel
      </button>
    {:else}
      <button
        onclick={goBack}
        disabled={isCreating}
        class="h-8 pl-3 pr-4 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md flex items-center gap-1.5 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        <ArrowLeft size={14} strokeWidth={3} />
        Back
      </button>
    {/if}

    <button
      onclick={goNext}
      disabled={!canContinue}
      class="h-8 px-4 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      {#if step === "loader"}
        {#if isCreating}
          <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          <span>Creating...</span>
        {:else}
          <span>Create Instance</span>
        {/if}
      {:else}
        <span>Continue</span>
        <ArrowRight size={14} strokeWidth={3} />
      {/if}
    </button>
  </div>
{/snippet}

<div
    class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-hidden modal-backdrop {isClosing ? 'closing' : ''}"
    class:closing={isClosing}
    role="presentation"
    onmousedown={(e) => { backdropArmed = e.target === e.currentTarget }}
    onmouseup={(e) => { backdropArmed = backdropArmed && e.target === e.currentTarget }}
    onclick={() => { if (backdropArmed) handleClose() }}
    onkeydown={(e) => { if (e.key === 'Escape') handleClose() }}
  >
    <div
      role="presentation"
      class="w-full max-w-lg h-[380px] flex flex-col overflow-x-clip bg-[var(--content-bg)] rounded-md border border-[var(--border-subtle)] shadow-md modal-content"
      class:closing={isClosing}
      onclick={(e) => e.stopPropagation()}
      style="pointer-events: auto"
    >
      {@render pageHeader()}

      <div class="flex-1 min-h-0 grid">
      {#if step === "name"}
        <div class="col-start-1 row-start-1 {pageClass}" in:fly={{ x: 72 * navDir, duration: 420, delay: 200, easing: cubicOut }} out:fly={{ x: -72 * navDir, duration: 300, easing: cubicIn }}>
          <NameStep bind:value={newInstanceName} {instanceExists} {isCreating} onImport={handleImportFile} onEnter={goNext} />
        </div>
      {:else if step === "version"}
        <div class="col-start-1 row-start-1 {pageClass}" in:fly={{ x: 72 * navDir, duration: 420, delay: 200, easing: cubicOut }} out:fly={{ x: -72 * navDir, duration: 300, easing: cubicIn }}>
          <VersionStep {filteredVersions} {selectedVersion} {versionFilter} {isLoadingVersions} {isCreating} onFilterChange={handleVersionFilterChange} onSelect={handleVersionSelect} />
        </div>
      {:else}
        <div class="col-start-1 row-start-1 {pageClass}" in:fly={{ x: 72 * navDir, duration: 420, delay: 200, easing: cubicOut }} out:fly={{ x: -72 * navDir, duration: 300, easing: cubicIn }}>
          <LoaderStep
            {loaderType}
            {selectedVersion}
            {isCreating}
            {loaderDir}
            {hasUnavailableLoaders}
            {isLoaderSupported}
            {isLoadingFabric}
            {isLoadingNeoforge}
            {isLoadingForge}
            {fabricVersions}
            {selectedFabricVersion}
            {neoforgeVersions}
            {selectedNeoforgeVersion}
            {forgeVersions}
            {selectedForgeVersion}
            onLoaderChange={handleLoaderChange}
            onFabricSelect={(v) => selectedFabricVersion = v}
            onNeoforgeSelect={(v) => selectedNeoforgeVersion = v}
            onForgeSelect={(v) => selectedForgeVersion = v}
          />
        </div>
      {/if}
      </div>

      {@render pageFooter()}
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