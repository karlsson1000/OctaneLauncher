<script lang="ts">
  import { invoke } from "@tauri-apps/api/core"
  import { open } from "@tauri-apps/plugin-dialog"
  import { fly, slide } from "svelte/transition"
  import { cubicIn, cubicOut } from "svelte/easing"
  import { X, Loader2, AlertCircle, FileDown, Check, ChevronDown, ChevronUp, ArrowLeft, ArrowRight } from "lucide-svelte"
  import AlertModal from "../../components/ui/AlertModal.svelte"
  import type { FabricVersion, NeoForgeVersion, ForgeVersion, Instance } from "../../types"

  interface MinecraftVersion {
    id: string
    type: "release" | "snapshot"
    url: string
    time: string
    releaseTime: string
  }

  type LoaderType = "vanilla" | "fabric" | "neoforge" | "forge"
  type CreateStep = "name" | "version" | "loader"

  const STEPS: CreateStep[] = ["name", "version", "loader"]
  const STEP_ORDER: Record<CreateStep, number> = { name: 0, version: 1, loader: 2 }

  const LOADERS: { id: LoaderType; label: string; bg: string }[] = [
    { id: "vanilla", label: "Vanilla", bg: "bg-[#16a34a]" },
    { id: "fabric", label: "Fabric", bg: "bg-[#3b82f6]" },
    { id: "neoforge", label: "NeoForge", bg: "bg-[#f97316]" },
    { id: "forge", label: "Forge", bg: "bg-[#e05d2e]" },
  ]

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
  let openDropdown = $state<"mc" | "fabric" | "neoforge" | "forge" | null>(null)

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

  $effect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!(event.target as HTMLElement | null)?.closest("[data-dropdown]")) openDropdown = null
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  })

  function autofocus(node: HTMLElement) {
    node.focus({ preventScroll: true })
  }

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
    } catch (error) {
    }
  }

  async function loadNeoforgeSupportedVersions() {
    try {
      const supported = await invoke<string[]>("get_neoforge_supported_game_versions")
      neoforgeSupportedVersions = supported
    } catch (error) {
    }
  }

  async function loadForgeSupportedVersions() {
    try {
      const supported = await invoke<string[]>("get_forge_supported_game_versions")
      forgeSupportedVersions = supported
    } catch (error) {
    }
  }

  let filteredVersions = $derived(
    allVersions.filter((v: MinecraftVersion) => v.type === versionFilter)
  )
  let mcOptions = $derived(filteredVersions.map((v: MinecraftVersion) => ({ value: v.id, label: v.id })))

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
    openDropdown = null

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
    openDropdown = null
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
    openDropdown = null
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

  let activeLoader = $derived(LOADERS.find((l) => l.id === loaderType) ?? LOADERS[0])
</script>

{#snippet dropdown(
  id: "mc" | "fabric" | "neoforge" | "forge",
  options: { value: string; label: string }[],
  selected: string,
  display: string,
  onPick: (value: string) => void,
  listHeight: string = "max-h-48"
)}
  <div class="relative" data-dropdown>
    <button
      id="create-{id}-btn"
      type="button"
      onclick={() => (openDropdown = openDropdown === id ? null : id)}
      class="w-full bg-[var(--bg-tertiary)] px-4 py-3.5 pr-10 text-sm text-[var(--text-primary)] focus:outline-none text-left cursor-pointer {openDropdown === id ? 'rounded-t-sm' : 'rounded-sm'}"
      disabled={isCreating}
    >
      {display}
    </button>
    <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
      {#if openDropdown === id}
        <ChevronUp size={18} strokeWidth={3} />
      {:else}
        <ChevronDown size={18} strokeWidth={3} />
      {/if}
    </div>

    {#if openDropdown === id}
      <div class="absolute z-10 w-full bg-[var(--bg-tertiary)] rounded-b-sm shadow-md {listHeight} overflow-y-auto custom-scrollbar border-t border-[var(--bg-elevated)]">
        {#each options as option (option.value)}
          <button
            type="button"
            onclick={() => onPick(option.value)}
            class="w-full px-4 py-3 text-sm text-left hover:bg-[var(--bg-hover)] flex items-center justify-between cursor-pointer text-[var(--text-primary)]"
          >
            <span>{option.label}</span>
            {#if selected === option.value}
              <Check size={17} class="text-[var(--accent-primary)]" strokeWidth={3} />
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet statusBox(kind: "loading" | "empty", text: string, color?: string)}
  <div class="flex items-center gap-2 text-[var(--text-muted)] text-sm py-3.5 px-4 bg-[var(--bg-tertiary)] rounded-sm">
    {#if kind === "loading"}
      <Loader2 size={16} class="animate-spin" style={color ? `color: ${color}` : undefined} />
    {:else}
      <AlertCircle size={16} />
    {/if}
    <span>{text}</span>
  </div>
{/snippet}

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
          <div class="flex-1 min-h-0 flex flex-col">
            <h3 class="text-sm font-semibold text-[var(--text-primary)]">Name your instance</h3>

            <div class="mt-3">
              <label for="create-instance-name" class="sr-only">Instance Name</label>
              <input
                id="create-instance-name"
                type="text"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                bind:value={newInstanceName}
                use:autofocus
                onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); goNext() } }}
                placeholder="My Minecraft Instance"
                class="w-full bg-[var(--bg-tertiary)] rounded-sm px-4 py-3.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none border transition-colors {instanceExists && newInstanceName.trim() ? 'border-red-500/60' : 'border-transparent'}"
                disabled={isCreating}
              />
              {#if instanceExists && newInstanceName.trim()}
                <div class="flex items-center gap-1.5 mt-2 text-xs text-red-400">
                  <AlertCircle size={12} strokeWidth={2} />
                  <span>An instance with this name already exists</span>
                </div>
              {/if}
            </div>

            <p class="text-[13px] text-[var(--text-secondary)] mt-5">Or upload a custom .mrpack or .zip instead</p>
            <button
              type="button"
              onclick={handleImportFile}
              disabled={isCreating}
              class="mt-1.5 self-start h-7.5 px-3 rounded-sm text-sm font-medium cursor-pointer bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FileDown size={16} strokeWidth={2} />
              <span>Import from file</span>
            </button>
          </div>
        </div>
      {:else if step === "version"}
        <div class="col-start-1 row-start-1 {pageClass}" in:fly={{ x: 72 * navDir, duration: 420, delay: 200, easing: cubicOut }} out:fly={{ x: -72 * navDir, duration: 300, easing: cubicIn }}>
          <div class="flex-1 min-h-0 flex flex-col">
            <div>
              <label for="create-mc-btn" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Choose a Minecraft version</label>
              <div class="grid grid-cols-2 gap-1 p-1 rounded-md bg-[var(--bg-tertiary)] mb-3">
                <button
                  type="button"
                  onclick={() => handleVersionFilterChange("release")}
                  disabled={isCreating}
                  class="h-8 rounded-sm text-sm font-medium cursor-pointer disabled:cursor-not-allowed {versionFilter === 'release' ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
                >
                  Releases
                </button>
                <button
                  type="button"
                  onclick={() => handleVersionFilterChange("snapshot")}
                  disabled={isCreating}
                  class="h-8 rounded-sm text-sm font-medium cursor-pointer disabled:cursor-not-allowed {versionFilter === 'snapshot' ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
                >
                  Snapshots
                </button>
              </div>

              {#if isLoadingVersions}
                {@render statusBox("loading", "Loading versions...")}
              {:else if filteredVersions.length === 0}
                {@render statusBox("empty", "No versions available")}
              {:else}
                {@render dropdown("mc", mcOptions, selectedVersion, selectedVersion, handleVersionSelect, "max-h-64")}
              {/if}
            </div>
          </div>
        </div>
      {:else}
        <div class="col-start-1 row-start-1 {pageClass}" in:fly={{ x: 72 * navDir, duration: 420, delay: 200, easing: cubicOut }} out:fly={{ x: -72 * navDir, duration: 300, easing: cubicIn }}>
          <div class="flex-1 min-h-0 flex flex-col">
            <h3 class="text-sm font-semibold text-[var(--text-primary)]">Choose a modloader</h3>
            {#if hasUnavailableLoaders}
              <p class="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">Greyed-out loaders don't support this version.</p>
            {/if}

            <div class="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Modloader">
              {#each LOADERS as loader (loader.id)}
                {@const isActive = loaderType === loader.id}
                {@const supported = isLoaderSupported(loader.id, selectedVersion)}
                <button
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  title={supported ? undefined : `${loader.label} isn't available for Minecraft ${selectedVersion}`}
                  onclick={() => handleLoaderChange(loader.id)}
                  disabled={isCreating || !supported}
                  class="px-3 h-9 rounded-sm text-[13px] font-medium flex items-center justify-center gap-2 {!supported ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] opacity-40 cursor-not-allowed' : isActive ? `${loader.bg} text-white cursor-pointer` : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] cursor-pointer'}"
                >
                  <div class="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center {isActive ? 'border-white' : 'border-gray-500'}">
                    {#if isActive}
                      <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
                    {/if}
                  </div>
                  <span>{loader.label}</span>
                </button>
              {/each}
            </div>

            {#if loaderType !== "vanilla"}
            <div class="mt-5 grid" transition:slide={{ duration: 250, easing: cubicOut }}>
            {#key loaderType}
            <div class="col-start-1 row-start-1" in:fly={{ x: 20 * loaderDir, duration: 250, delay: 120, easing: cubicOut }} out:fly={{ x: -20 * loaderDir, duration: 150, easing: cubicIn }}>
            {#if loaderType === "fabric"}
              <div>
                <label for="create-fabric-btn" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Fabric Loader</label>
                {#if isLoadingFabric}
                  {@render statusBox("loading", "Loading versions...", "#3b82f6")}
                {:else}
                  {@render dropdown(
                    "fabric",
                    fabricVersions.map((v: FabricVersion) => ({ value: v.version, label: `${v.version}${v.stable ? " (Stable)" : ""}` })),
                    selectedFabricVersion,
                    `${selectedFabricVersion} ${fabricVersions.find((v: FabricVersion) => v.version === selectedFabricVersion)?.stable ? "(Stable)" : ""}`,
                    (v) => { selectedFabricVersion = v; openDropdown = null }
                  )}
                {/if}
              </div>
            {/if}

            {#if loaderType === "neoforge"}
              <div>
                <label for="create-neoforge-btn" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">NeoForge Version</label>
                {#if isLoadingNeoforge}
                  {@render statusBox("loading", "Loading NeoForge versions...", "#f97316")}
                {:else if neoforgeVersions.length === 0}
                  {@render statusBox("empty", `No NeoForge versions available for Minecraft ${selectedVersion}`)}
                {:else}
                  {@render dropdown(
                    "neoforge",
                    neoforgeVersions.map((v: NeoForgeVersion) => ({ value: v.neoforge_version, label: v.neoforge_version })),
                    selectedNeoforgeVersion,
                    selectedNeoforgeVersion,
                    (v) => { selectedNeoforgeVersion = v; openDropdown = null }
                  )}
                {/if}
              </div>
            {/if}

            {#if loaderType === "forge"}
              <div>
                <label for="create-forge-btn" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Forge Version</label>
                {#if isLoadingForge}
                  {@render statusBox("loading", "Loading Forge versions...", "#e05d2e")}
                {:else if forgeVersions.length === 0}
                  {@render statusBox("empty", `No Forge versions available for Minecraft ${selectedVersion}`)}
                {:else}
                  {@render dropdown(
                    "forge",
                    forgeVersions.map((v: ForgeVersion) => ({ value: v.forge_version, label: v.forge_version })),
                    selectedForgeVersion,
                    selectedForgeVersion,
                    (v) => { selectedForgeVersion = v; openDropdown = null }
                  )}
                {/if}
              </div>
            {/if}
            </div>
            {/key}
            </div>
            {/if}
          </div>
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