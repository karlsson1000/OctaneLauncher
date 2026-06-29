<script lang="ts">
  import { invoke } from "@tauri-apps/api/core"
  import { open } from "@tauri-apps/plugin-dialog"
  import { X, Loader2, AlertCircle, FileDown, Check, ChevronDown, ChevronUp } from "lucide-svelte"
  import AlertModal from "../../components/ui/AlertModal.svelte"
  import type { FabricVersion, NeoForgeVersion, ForgeVersion, Instance } from "../../types"

  interface MinecraftVersion {
    id: string
    type: "release" | "snapshot"
    url: string
    time: string
    releaseTime: string
  }

  let { instances, onClose, onSuccess, onStartCreating }: {
    instances: Instance[]
    onClose: () => void
    onSuccess: () => void
    onStartCreating: (instanceName: string) => void
  } = $props()

  let isCreating = $state(false)
  let selectedVersion = $state("")
  let newInstanceName = $state("")
  let loaderType = $state<"vanilla" | "fabric" | "neoforge" | "forge">("vanilla")
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
  let isVersionDropdownOpen = $state(false)
  let isFabricDropdownOpen = $state(false)
  let isNeoforgeDropdownOpen = $state(false)
  let isForgeDropdownOpen = $state(false)
  let versionDropdownRef = $state<HTMLDivElement | undefined>(undefined)
  let fabricDropdownRef = $state<HTMLDivElement | undefined>(undefined)
  let neoforgeDropdownRef = $state<HTMLDivElement | undefined>(undefined)
  let forgeDropdownRef = $state<HTMLDivElement | undefined>(undefined)

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
    versionDropdownRef;
    fabricDropdownRef;
    neoforgeDropdownRef;
    forgeDropdownRef;

    function handleClickOutside(event: MouseEvent) {
      if (versionDropdownRef && !versionDropdownRef.contains(event.target as Node)) isVersionDropdownOpen = false
      if (fabricDropdownRef && !fabricDropdownRef.contains(event.target as Node)) isFabricDropdownOpen = false
      if (neoforgeDropdownRef && !neoforgeDropdownRef.contains(event.target as Node)) isNeoforgeDropdownOpen = false
      if (forgeDropdownRef && !forgeDropdownRef.contains(event.target as Node)) isForgeDropdownOpen = false
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  })

  async function loadVersionsWithMetadata() {
    isLoadingVersions = true
    try {
      const versionsData = await invoke<MinecraftVersion[]>("get_minecraft_versions_with_metadata")
      allVersions = versionsData
      const firstRelease = versionsData.find((v: MinecraftVersion) => v.type === "release")
      if (firstRelease) selectedVersion = firstRelease.id
    } catch (error) {
      console.error("Failed to load versions:", error)
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
      console.error("Failed to load Fabric supported versions:", error)
    }
  }

  async function loadNeoforgeSupportedVersions() {
    try {
      const supported = await invoke<string[]>("get_neoforge_supported_game_versions")
      neoforgeSupportedVersions = supported
    } catch (error) {
      console.error("Failed to load NeoForge supported versions:", error)
    }
  }

  async function loadForgeSupportedVersions() {
    try {
      const supported = await invoke<string[]>("get_forge_supported_game_versions")
      forgeSupportedVersions = supported
    } catch (error) {
      console.error("Failed to load Forge supported versions:", error)
    }
  }

  function getFilteredVersions(): MinecraftVersion[] {
    let filtered = versionFilter === "snapshot"
      ? allVersions.filter((v: MinecraftVersion) => v.type === "snapshot")
      : allVersions.filter((v: MinecraftVersion) => v.type === "release")

    if (loaderType === "fabric" && versionFilter === "release") {
      filtered = filtered.filter((v: MinecraftVersion) => fabricSupportedVersions.includes(v.id))
    }
    if (loaderType === "neoforge" && versionFilter === "release") {
      filtered = filtered.filter((v: MinecraftVersion) => neoforgeSupportedVersions.includes(v.id))
    }
    if (loaderType === "forge" && versionFilter === "release") {
      filtered = filtered.filter((v: MinecraftVersion) => forgeSupportedVersions.includes(v.id))
    }

    return filtered
  }

  let filteredVersions = $derived(getFilteredVersions())

  async function loadForgeVersions(forVersion: string) {
    isLoadingForge = true
    try {
      const versions = await invoke<ForgeVersion[]>("get_forge_versions")
      const filtered = versions.filter((v: ForgeVersion) => v.minecraft_version === forVersion)
      forgeVersions = filtered
      if (filtered.length > 0) selectedForgeVersion = filtered[0].forge_version
    } catch (error) {
      console.error("Failed to load Forge versions:", error)
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
      console.error("Failed to load Fabric versions:", error)
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
      if (filtered.length > 0) selectedNeoforgeVersion = filtered[0].neoforge_version
    } catch (error) {
      console.error("Failed to load NeoForge versions:", error)
      alertModal = { isOpen: true, title: "An error occurred", message: "Failed to load NeoForge versions" + `: ${error}`, type: "danger" }
    } finally {
      isLoadingNeoforge = false
    }
  }

  function handleLoaderChange(newLoader: "vanilla" | "fabric" | "neoforge" | "forge") {
    loaderType = newLoader

    if (newLoader === "fabric") {
      if (versionFilter === "snapshot") versionFilter = "release"

      const currentIsUnsupported = !fabricSupportedVersions.includes(selectedVersion)
        || allVersions.find((v: MinecraftVersion) => v.id === selectedVersion)?.type === "snapshot"
      if (currentIsUnsupported && fabricSupportedVersions.length > 0 && allVersions.length > 0) {
        const firstSupported = allVersions.find((v: MinecraftVersion) =>
          v.type === "release" &&
          fabricSupportedVersions.includes(v.id)
        )
        if (firstSupported) selectedVersion = firstSupported.id
      }

      if (fabricVersions.length === 0) loadFabricVersions()
    }

    if (newLoader === "neoforge") {
      if (versionFilter === "snapshot") versionFilter = "release"

      const currentIsUnsupported = !neoforgeSupportedVersions.includes(selectedVersion)
        || allVersions.find((v: MinecraftVersion) => v.id === selectedVersion)?.type === "snapshot"
      if (currentIsUnsupported && neoforgeSupportedVersions.length > 0 && allVersions.length > 0) {
        const firstSupported = allVersions.find((v: MinecraftVersion) =>
          v.type === "release" &&
          neoforgeSupportedVersions.includes(v.id)
        )
        if (firstSupported) {
          selectedVersion = firstSupported.id
          loadNeoforgeVersions(firstSupported.id)
        }
      } else {
        loadNeoforgeVersions(selectedVersion)
      }
    }

    if (newLoader === "forge") {
      if (versionFilter === "snapshot") versionFilter = "release"

      const currentIsUnsupported = !forgeSupportedVersions.includes(selectedVersion)
        || allVersions.find((v: MinecraftVersion) => v.id === selectedVersion)?.type === "snapshot"
      if (currentIsUnsupported && forgeSupportedVersions.length > 0 && allVersions.length > 0) {
        const firstSupported = allVersions.find((v: MinecraftVersion) =>
          v.type === "release" &&
          forgeSupportedVersions.includes(v.id)
        )
        if (firstSupported) {
          selectedVersion = firstSupported.id
          loadForgeVersions(firstSupported.id)
        }
      } else {
        loadForgeVersions(selectedVersion)
      }
    }
  }

  function handleVersionSelect(versionId: string) {
    selectedVersion = versionId
    isVersionDropdownOpen = false
    if (loaderType === "neoforge") {
      loadNeoforgeVersions(versionId)
    }
    if (loaderType === "forge") {
      loadForgeVersions(versionId)
    }
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
      console.error("Import error:", error)
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
      console.error("Create instance error:", error)
      alertModal = { isOpen: true, title: "An error occurred", message: "Failed to create instance" + `: ${error}`, type: "danger" }
    } finally {
      isCreating = false
    }
  }

  function handleVersionFilterChange(filter: "release" | "snapshot") {
    versionFilter = filter
    const available = (filter === "snapshot"
      ? allVersions.filter((v: MinecraftVersion) => v.type === "snapshot")
      : allVersions.filter((v: MinecraftVersion) => v.type === "release")
    ).filter((v: MinecraftVersion) => {
      if (loaderType === "fabric" && filter === "release") return fabricSupportedVersions.includes(v.id)
      if (loaderType === "neoforge" && filter === "release") return neoforgeSupportedVersions.includes(v.id)
      if (loaderType === "forge" && filter === "release") return forgeSupportedVersions.includes(v.id)
      return true
    })

    if (available.length > 0) {
      selectedVersion = available[0].id
      if (loaderType === "neoforge") loadNeoforgeVersions(available[0].id)
      if (loaderType === "forge") loadForgeVersions(available[0].id)
    }
  }

  let isCreateDisabled = $derived(
    isCreating
    || !newInstanceName.trim()
    || instanceExists
    || (loaderType === "fabric" && !selectedFabricVersion)
    || (loaderType === "neoforge" && !selectedNeoforgeVersion)
    || (loaderType === "forge" && !selectedForgeVersion)
    || isLoadingVersions
    || filteredVersions.length === 0
  )
</script>

<div
    class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop {isClosing ? 'closing' : ''}"
    class:closing={isClosing}
    role="presentation"
    onclick={handleClose}
    onkeydown={(e) => { if (e.key === 'Escape') handleClose() }}
  >
    <div
      role="presentation"
      class="blur-border bg-[var(--bg-secondary)] rounded w-full max-w-md shadow-2xl modal-content"
      class:closing={isClosing}
      onclick={(e) => e.stopPropagation()}
      style="pointer-events: auto"
    >
      <div class="flex items-center justify-between px-6 pt-6 pb-5">
        <h2 class="text-xl font-semibold text-[var(--text-primary)] tracking-tight">New Instance</h2>
        <button onclick={handleClose} class="p-1.5 hover:bg-[var(--bg-hover-strong)] rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div class="px-6 pb-4 space-y-5">
        <div class="flex">
          <button type="button" onclick={handleImportFile} disabled={isCreating} class="w-full px-4 py-3 rounded text-sm font-medium transition-all cursor-pointer bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover-strong)] text-[var(--text-muted)]">
            <div class="flex items-center justify-center gap-2">
              <FileDown size={18} class="text-[var(--text-muted)]" strokeWidth={2} />
              <span>Import File</span>
            </div>
          </button>
        </div>

        <div>
          <label for="create-instance-name" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Instance Name</label>
          <input
            id="create-instance-name"
            type="text"
            bind:value={newInstanceName}
            placeholder="My Minecraft Instance"
            class="w-full bg-[var(--bg-tertiary)] rounded px-4 py-3.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none transition-all {instanceExists && newInstanceName.trim() ? 'ring-2 ring-red-500' : ''}"
            disabled={isCreating}
          />
          {#if instanceExists && newInstanceName.trim()}
            <div class="flex items-center gap-1.5 mt-2 text-xs text-red-400">
              <AlertCircle size={12} strokeWidth={2} />
              <span>An instance with this name already exists</span>
            </div>
          {/if}
        </div>

        <div>
          <div class="flex items-center justify-between mb-2.5">
            <label for="create-mc-version-btn" class="text-sm font-medium text-[var(--text-primary)]">Minecraft Version</label>
            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick={() => handleVersionFilterChange("release")}
                disabled={isCreating}
                class="text-xs font-medium transition-colors cursor-pointer {versionFilter === 'release' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-muted)]'}"
              >
                Releases
              </button>
              <span class="text-gray-600">|</span>
              <button
                type="button"
                onclick={() => handleVersionFilterChange("snapshot")}
                disabled={isCreating || loaderType === "fabric" || loaderType === "neoforge" || loaderType === "forge"}
                class="text-xs font-medium transition-colors {loaderType === 'fabric' || loaderType === 'neoforge' || loaderType === 'forge' ? 'text-gray-600 cursor-not-allowed' : versionFilter === 'snapshot' ? 'text-[var(--text-primary)] cursor-pointer' : 'text-[var(--text-muted)] hover:text-[var(--text-muted)] cursor-pointer'}"
              >
                Snapshots
              </button>
            </div>
          </div>
          {#if isLoadingVersions}
            <div class="flex items-center gap-2 text-[var(--text-muted)] text-sm py-3.5 px-4 bg-[var(--bg-tertiary)] rounded">
              <Loader2 size={16} class="animate-spin" />
              <span>Loading versions...</span>
            </div>
          {:else if filteredVersions.length === 0}
            <div class="flex items-center gap-2 text-[var(--text-muted)] text-sm py-3.5 px-4 bg-[var(--bg-tertiary)] rounded">
              <AlertCircle size={16} />
              <span>No compatible versions available</span>
            </div>
          {:else}
            <div class="relative" bind:this={versionDropdownRef}>
              <button
                id="create-mc-version-btn"
                type="button"
                onclick={() => isVersionDropdownOpen = !isVersionDropdownOpen}
                class="w-full bg-[var(--bg-tertiary)] px-4 py-3.5 pr-10 text-sm text-[var(--text-primary)] focus:outline-none transition-all text-left cursor-pointer {isVersionDropdownOpen ? 'rounded-t' : 'rounded'}"
                disabled={isCreating}
              >
                {selectedVersion}
              </button>
              <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                {#if isVersionDropdownOpen}
                  <ChevronUp size={18} strokeWidth={3} />
                {:else}
                  <ChevronDown size={18} strokeWidth={3} />
                {/if}
              </div>

              {#if isVersionDropdownOpen}
                <div class="absolute z-10 w-full bg-[var(--bg-tertiary)] rounded-b shadow-lg max-h-60 overflow-y-auto custom-scrollbar border-t border-[var(--bg-elevated)]">
                  {#each filteredVersions as version (version.id)}
                    <button
                      type="button"
                      onclick={() => handleVersionSelect(version.id)}
                      class="w-full px-4 py-3 text-sm text-left hover:bg-[var(--bg-hover-strong)] transition-colors flex items-center justify-between cursor-pointer text-[var(--text-primary)]"
                    >
                      <span>{version.id}</span>
                      {#if selectedVersion === version.id}
                        <Check size={16} class="text-[var(--text-primary)]" strokeWidth={2} />
                      {/if}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <div>
          <label for="loader-vanilla" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Modloader</label>
          <div class="grid grid-cols-2 gap-2" role="group" aria-labelledby="modloader-label">
            {#each ["vanilla", "fabric", "neoforge", "forge"] as const as loader}
              {@const colors: Record<string, string> = { vanilla: "bg-[#16a34a]", fabric: "bg-[#3b82f6]", neoforge: "bg-[#f97316]", forge: "bg-[#e05d2e]" }}
              {@const labels: Record<string, string> = { vanilla: "Vanilla", fabric: "Fabric", neoforge: "NeoForge", forge: "Forge" }}
              {@const isActive = loaderType === loader}
              <button
                id={loader === "vanilla" ? "loader-vanilla" : undefined}
                type="button"
                onclick={() => handleLoaderChange(loader)}
                disabled={isCreating}
                class="px-4 py-3 rounded text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 {isActive ? `${colors[loader]} text-white` : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--bg-hover-strong)]'}"
              >
                <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center {isActive ? 'border-white' : 'border-gray-500'}">
                  {#if isActive}
                    <div class="w-2 h-2 rounded-full bg-white"></div>
                  {/if}
                </div>
                <span>{labels[loader]}</span>
              </button>
            {/each}
          </div>
        </div>

        {#if loaderType === "fabric"}
          <div>
            <label for="create-fabric-loader-btn" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Fabric Loader Version</label>
            {#if isLoadingFabric}
              <div class="flex items-center gap-2 text-[var(--text-muted)] text-sm py-3.5 px-4 bg-[var(--bg-tertiary)] rounded">
                <Loader2 size={16} class="animate-spin text-[#3b82f6]" />
                <span>Loading versions...</span>
              </div>
            {:else}
              <div class="relative" bind:this={fabricDropdownRef}>
                <button
                  id="create-fabric-loader-btn"
                  type="button"
                  onclick={() => isFabricDropdownOpen = !isFabricDropdownOpen}
                  class="w-full bg-[var(--bg-tertiary)] px-4 py-3.5 pr-10 text-sm text-[var(--text-primary)] focus:outline-none transition-all text-left cursor-pointer {isFabricDropdownOpen ? 'rounded-t' : 'rounded'}"
                  disabled={isCreating}
                >
                  {selectedFabricVersion} {fabricVersions.find((v: FabricVersion) => v.version === selectedFabricVersion)?.stable ? "(Stable)" : ""}
                </button>
                <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  {#if isFabricDropdownOpen}
                    <ChevronUp size={18} strokeWidth={3} />
                  {:else}
                    <ChevronDown size={18} strokeWidth={3} />
                  {/if}
                </div>

                {#if isFabricDropdownOpen}
                  <div class="absolute z-10 w-full bg-[var(--bg-tertiary)] rounded-b shadow-lg max-h-60 overflow-y-auto custom-scrollbar border-t border-[var(--bg-elevated)]">
                    {#each fabricVersions as version (version.version)}
                      <button
                        type="button"
                        onclick={() => { selectedFabricVersion = version.version; isFabricDropdownOpen = false }}
                        class="w-full px-4 py-3 text-sm text-left hover:bg-[var(--bg-hover-strong)] transition-colors flex items-center justify-between cursor-pointer text-[var(--text-primary)]"
                      >
                        <span>{version.version} {version.stable ? "(Stable)" : ""}</span>
                        {#if selectedFabricVersion === version.version}
                          <Check size={16} class="text-[var(--text-primary)]" strokeWidth={2} />
                        {/if}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/if}

        {#if loaderType === "neoforge"}
          <div>
            <label for="create-neoforge-btn" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">NeoForge Version</label>
            {#if isLoadingNeoforge}
              <div class="flex items-center gap-2 text-[var(--text-muted)] text-sm py-3.5 px-4 bg-[var(--bg-tertiary)] rounded">
                <Loader2 size={16} class="animate-spin text-[#f97316]" />
                <span>Loading NeoForge versions...</span>
              </div>
            {:else if neoforgeVersions.length === 0}
              <div class="flex items-center gap-2 text-[var(--text-muted)] text-sm py-3.5 px-4 bg-[var(--bg-tertiary)] rounded">
                <AlertCircle size={16} />
                <span>No NeoForge versions available for Minecraft {selectedVersion}</span>
              </div>
            {:else}
              <div class="relative" bind:this={neoforgeDropdownRef}>
                <button
                  id="create-neoforge-btn"
                  type="button"
                  onclick={() => isNeoforgeDropdownOpen = !isNeoforgeDropdownOpen}
                  class="w-full bg-[var(--bg-tertiary)] px-4 py-3.5 pr-10 text-sm text-[var(--text-primary)] focus:outline-none transition-all text-left cursor-pointer {isNeoforgeDropdownOpen ? 'rounded-t' : 'rounded'}"
                  disabled={isCreating}
                >
                  {selectedNeoforgeVersion}
                </button>
                <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  {#if isNeoforgeDropdownOpen}
                    <ChevronUp size={18} strokeWidth={3} />
                  {:else}
                    <ChevronDown size={18} strokeWidth={3} />
                  {/if}
                </div>

                {#if isNeoforgeDropdownOpen}
                  <div class="absolute z-10 w-full bg-[var(--bg-tertiary)] rounded-b shadow-lg max-h-60 overflow-y-auto custom-scrollbar border-t border-[var(--bg-elevated)]">
                    {#each neoforgeVersions as version (version.neoforge_version)}
                      <button
                        type="button"
                        onclick={() => { selectedNeoforgeVersion = version.neoforge_version; isNeoforgeDropdownOpen = false }}
                        class="w-full px-4 py-3 text-sm text-left hover:bg-[var(--bg-hover-strong)] transition-colors flex items-center justify-between cursor-pointer text-[var(--text-primary)]"
                      >
                        <span>{version.neoforge_version}</span>
                        {#if selectedNeoforgeVersion === version.neoforge_version}
                          <Check size={16} class="text-[var(--text-primary)]" strokeWidth={2} />
                        {/if}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/if}

        {#if loaderType === "forge"}
          <div>
            <label for="create-forge-btn" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Forge Version</label>
            {#if isLoadingForge}
              <div class="flex items-center gap-2 text-[var(--text-muted)] text-sm py-3.5 px-4 bg-[var(--bg-tertiary)] rounded">
                <Loader2 size={16} class="animate-spin text-[#e05d2e]" />
                <span>Loading Forge versions...</span>
              </div>
            {:else if forgeVersions.length === 0}
              <div class="flex items-center gap-2 text-[var(--text-muted)] text-sm py-3.5 px-4 bg-[var(--bg-tertiary)] rounded">
                <AlertCircle size={16} />
                <span>No Forge versions available for Minecraft {selectedVersion}</span>
              </div>
            {:else}
              <div class="relative" bind:this={forgeDropdownRef}>
                <button
                  id="create-forge-btn"
                  type="button"
                  onclick={() => isForgeDropdownOpen = !isForgeDropdownOpen}
                  class="w-full bg-[var(--bg-tertiary)] px-4 py-3.5 pr-10 text-sm text-[var(--text-primary)] focus:outline-none transition-all text-left cursor-pointer {isForgeDropdownOpen ? 'rounded-t' : 'rounded'}"
                  disabled={isCreating}
                >
                  {selectedForgeVersion}
                </button>
                <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  {#if isForgeDropdownOpen}
                    <ChevronUp size={18} strokeWidth={3} />
                  {:else}
                    <ChevronDown size={18} strokeWidth={3} />
                  {/if}
                </div>

                {#if isForgeDropdownOpen}
                  <div class="absolute z-10 w-full bg-[var(--bg-tertiary)] rounded-b shadow-lg max-h-60 overflow-y-auto custom-scrollbar border-t border-[var(--bg-elevated)]">
                    {#each forgeVersions as version (version.forge_version)}
                      <button
                        type="button"
                        onclick={() => { selectedForgeVersion = version.forge_version; isForgeDropdownOpen = false }}
                        class="w-full px-4 py-3 text-sm text-left hover:bg-[var(--bg-hover-strong)] transition-colors flex items-center justify-between cursor-pointer text-[var(--text-primary)]"
                      >
                        <span>{version.forge_version}</span>
                        {#if selectedForgeVersion === version.forge_version}
                          <Check size={16} class="text-[var(--text-primary)]" strokeWidth={2} />
                        {/if}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="flex items-center justify-end gap-3 px-6 pb-6 pt-3">
        <button onclick={handleClose} disabled={isCreating} class="px-5 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover-strong)] text-[var(--text-primary)] rounded font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
          Cancel
        </button>
        <button onclick={handleCreateInstance} disabled={isCreateDisabled} class="px-5 py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
          {#if isCreating}
            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span>Creating...</span>
          {:else}
            <span>Create Instance</span>
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
