<script lang="ts">
  import { X, Trash2, Camera, ImagePlus, Loader2, Check, ChevronDown, ChevronUp } from "lucide-svelte"
  import { invoke } from "@tauri-apps/api/core"
  import ConfirmModal from "../../components/ui/ConfirmModal.svelte"
  import AlertModal from "../../components/ui/AlertModal.svelte"
  import type { Instance, FabricVersion, NeoForgeVersion, ForgeVersion, LauncherSettings, SystemInfo } from "../../types"
  import { instanceIconSrc, bumpInstanceIcon, clearInstanceIcon } from "../../lib/icons"
  import { store, handleInstanceRenamed, deleteInstanceOptimistically } from "../../lib/launcherStore.svelte"

  let { isOpen, instance, instanceIcon, onClose, onInstanceUpdated, onInstanceDeleted, onInstanceRenamed }: {
    isOpen: boolean
    instance: Instance
    instanceIcon: string | null
    onClose: () => void
    onInstanceUpdated: () => void
    onInstanceDeleted: () => void
    onInstanceRenamed?: (oldName: string, newName: string) => void
  } = $props()

  let newName = $state("")
  let renameError = $state<string | null>(null)
  let isRenamingInstance = $state(false)
  let isUploadingIcon = $state(false)
  let localIcon = $state<string | null>(null)
  let isClosing = $state(false)
  let fileInputEl: HTMLInputElement | undefined = $state()

  let isFabricInstance = $derived(instance.loader === "fabric")
  let isNeoforgeInstance = $derived(instance.loader === "neoforge")
  let isForgeInstance = $derived(instance.loader === "forge")

  function getMinecraftVersion(versionString: string): string {
    if (isFabricInstance) {
      const parts = versionString.split("-")
      return parts[parts.length - 1]
    }
    if (isNeoforgeInstance) {
      const versionPart = versionString.replace("neoforge-", "")
      const parts = versionPart.split("-")
      if (parts[0].startsWith("1.")) return parts[0]
      const versionNumbers = parts[0].split(".")
      if (versionNumbers.length >= 2) {
        const major = parseInt(versionNumbers[0])
        const minor = versionNumbers[1]
        const patch = versionNumbers[2]
        if (major >= 22) {
          if (patch && parseInt(patch) !== 0) return `${major}.${minor}.${patch}`
          return minor === "0" ? `${major}` : `${major}.${minor}`
        }
        if (major >= 20) return minor === "0" ? `1.${major}` : `1.${major}.${minor}`
      }
    }
    if (isForgeInstance) {
      return versionString.split("-forge-")[0] || versionString
    }
    return versionString
  }

  let fabricVersions = $state<FabricVersion[]>([])
  let selectedFabricVersion = $state("")
  let isLoadingFabric = $state(false)
  let isUpdatingFabric = $state(false)

  let neoforgeVersions = $state<NeoForgeVersion[]>([])
  let selectedNeoforgeVersion = $state("")
  let isLoadingNeoforge = $state(false)
  let isUpdatingNeoforge = $state(false)

  let forgeVersions = $state<ForgeVersion[]>([])
  let selectedForgeVersion = $state("")
  let isLoadingForge = $state(false)
  let isUpdatingForge = $state(false)

  let minecraftVersions = $state<string[]>([])
  let selectedMinecraftVersion = $state("")
  let isLoadingVersions = $state(false)
  let isUpdatingVersion = $state(false)
  let isVersionDropdownOpen = $state(false)
  let isFabricDropdownOpen = $state(false)
  let isNeoforgeDropdownOpen = $state(false)
  let isForgeDropdownOpen = $state(false)
  let versionDropdownRef = $state<HTMLDivElement | undefined>(undefined)
  let fabricDropdownRef = $state<HTMLDivElement | undefined>(undefined)
  let neoforgeDropdownRef = $state<HTMLDivElement | undefined>(undefined)
  let forgeDropdownRef = $state<HTMLDivElement | undefined>(undefined)

  let useCustomRam = $state(false)
  let instanceMemoryMb = $state(4096)
  let systemInfo = $state<SystemInfo | null>(null)
  let ramSaveTimeout: ReturnType<typeof setTimeout> | undefined
  let closeTimer: ReturnType<typeof setTimeout> | undefined

  $effect(() => {
    newName = instance.name
    localIcon = instanceIcon
    selectedFabricVersion = instance.loader_version || ""
    selectedNeoforgeVersion = instance.loader_version || ""
    selectedForgeVersion = instance.loader_version || ""
    selectedMinecraftVersion = getMinecraftVersion(instance.version)
  })

  let confirmModal = $state<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
    onConfirm: () => void
  } | null>(null)
  let alertModal = $state<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null>(null)

  $effect(() => {
    loadMinecraftVersions()
    loadInstanceRamSettings()
    loadSystemInfo()
    if (isFabricInstance) loadFabricVersions()
    if (isNeoforgeInstance) loadNeoforgeVersions()
    if (isForgeInstance) loadForgeVersions()

    return () => {
      if (ramSaveTimeout) clearTimeout(ramSaveTimeout)
    }
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

  async function loadInstanceRamSettings() {
    try {
      const settings = await invoke<LauncherSettings | null>("get_instance_settings", { instanceName: instance.name })
      if (settings?.memory_mb) {
        useCustomRam = true
        instanceMemoryMb = settings.memory_mb
      } else {
        useCustomRam = false
        instanceMemoryMb = 4096
      }
    } catch (error) {
      console.error("Failed to load instance RAM settings:", error)
      useCustomRam = false
      instanceMemoryMb = 4096
    }
  }

  async function loadSystemInfo() {
    try {
      const info = await invoke<SystemInfo>("get_system_info")
      systemInfo = info
    } catch (error) {
      console.error("Failed to load system info:", error)
    }
  }

  async function saveRamSettings(memoryMb: number, enabled: boolean) {
    try {
      if (enabled) {
        const currentSettings = await invoke<LauncherSettings | null>("get_instance_settings", { instanceName: instance.name })
        const newSettings: LauncherSettings = {
          memory_mb: memoryMb,
          java_path: currentSettings?.java_path ?? null,
          auto_navigate_to_console: currentSettings?.auto_navigate_to_console ?? true,
        }
        await invoke("save_instance_settings", { instanceName: instance.name, settings: newSettings })
      } else {
        await invoke("save_instance_settings", { instanceName: instance.name, settings: null })
      }
      onInstanceUpdated()
    } catch (error) {
      console.error("Failed to save RAM settings:", error)
      alertModal = { isOpen: true, title: "An error occurred", message: `Failed to save RAM settings: ${String(error)}`, type: "danger" }
    }
  }

  function handleRamChange() {
    if (ramSaveTimeout) clearTimeout(ramSaveTimeout)
    ramSaveTimeout = setTimeout(() => saveRamSettings(instanceMemoryMb, useCustomRam), 500)
  }

  async function loadMinecraftVersions() {
    isLoadingVersions = true
    try {
      const versions = await invoke<string[]>("get_minecraft_versions_by_type", { versionType: "release" })
      minecraftVersions = versions
    } catch (error) {
      console.error("Failed to load Minecraft versions:", error)
      alertModal = { isOpen: true, title: "An error occurred", message: `Failed to load Minecraft versions: ${String(error)}`, type: "danger" }
    } finally {
      isLoadingVersions = false
    }
  }

  async function loadFabricVersions() {
    isLoadingFabric = true
    try {
      const versions = await invoke<FabricVersion[]>("get_fabric_versions")
      fabricVersions = versions
    } catch (error) {
      console.error("Failed to load Fabric versions:", error)
      alertModal = { isOpen: true, title: "An error occurred", message: `Failed to load Fabric versions: ${String(error)}`, type: "danger" }
    } finally {
      isLoadingFabric = false
    }
  }

  function handleVersionSelect(newVersion: string) {
    if (!newVersion || newVersion === getMinecraftVersion(instance.version)) {
      isVersionDropdownOpen = false
      return
    }
    selectedMinecraftVersion = newVersion
    isVersionDropdownOpen = false

    confirmModal = {
      isOpen: true,
      title: "Update Minecraft Version",
      message: `Are you sure you want to update this instance to Minecraft ${newVersion}?\n\nThis will download the new version and update the instance. Your worlds and settings will be preserved.`,
      type: "warning",
      onConfirm: async () => {
        confirmModal = null
        isUpdatingVersion = true
        try {
          await invoke("update_instance_minecraft_version", { instanceName: instance.name, newMinecraftVersion: newVersion })
          onInstanceUpdated()
        } catch (error) {
          console.error("Failed to update Minecraft version:", error)
          alertModal = { isOpen: true, title: "An error occurred", message: `Failed to update Minecraft version: ${String(error)}`, type: "danger" }
          selectedMinecraftVersion = getMinecraftVersion(instance.version)
        } finally {
          isUpdatingVersion = false
        }
      }
    }
  }

  async function handleFabricSelect(newVersion: string) {
    if (!newVersion || newVersion === instance.loader_version) {
      isFabricDropdownOpen = false
      return
    }
    selectedFabricVersion = newVersion
    isFabricDropdownOpen = false
    isUpdatingFabric = true
    try {
      await invoke("update_instance_fabric_loader", { instanceName: instance.name, fabricVersion: newVersion })
      onInstanceUpdated()
    } catch (error) {
      console.error("Failed to update Fabric loader:", error)
      alertModal = { isOpen: true, title: "An error occurred", message: `Failed to update Fabric loader: ${String(error)}`, type: "danger" }
      selectedFabricVersion = instance.loader_version || ""
    } finally {
      isUpdatingFabric = false
    }
  }

  async function loadNeoforgeVersions() {
    isLoadingNeoforge = true
    try {
      const versions = await invoke<NeoForgeVersion[]>("get_neoforge_versions")
      neoforgeVersions = versions
    } catch (error) {
      console.error("Failed to load NeoForge versions:", error)
      alertModal = { isOpen: true, title: "An error occurred", message: `Failed to load NeoForge versions: ${String(error)}`, type: "danger" }
    } finally {
      isLoadingNeoforge = false
    }
  }

  async function handleNeoforgeSelect(newVersion: string) {
    if (!newVersion || newVersion === instance.loader_version) {
      isNeoforgeDropdownOpen = false
      return
    }
    selectedNeoforgeVersion = newVersion
    isNeoforgeDropdownOpen = false
    isUpdatingNeoforge = true
    try {
      await invoke("update_instance_neoforge_loader", { instanceName: instance.name, neoforgeVersion: newVersion })
      onInstanceUpdated()
    } catch (error) {
      console.error("Failed to update NeoForge loader:", error)
      alertModal = { isOpen: true, title: "An error occurred", message: `Failed to update NeoForge loader: ${String(error)}`, type: "danger" }
      selectedNeoforgeVersion = instance.loader_version || ""
    } finally {
      isUpdatingNeoforge = false
    }
  }

  async function loadForgeVersions() {
    isLoadingForge = true
    try {
      const versions = await invoke<ForgeVersion[]>("get_forge_versions")
      forgeVersions = versions
    } catch (error) {
      console.error("Failed to load Forge versions:", error)
      alertModal = { isOpen: true, title: "An error occurred", message: `Failed to load Forge versions: ${String(error)}`, type: "danger" }
    } finally {
      isLoadingForge = false
    }
  }

  async function handleForgeSelect(newVersion: string) {
    if (!newVersion || newVersion === instance.loader_version) {
      isForgeDropdownOpen = false
      return
    }
    selectedForgeVersion = newVersion
    isForgeDropdownOpen = false
    isUpdatingForge = true
    try {
      await invoke("update_instance_forge_loader", { instanceName: instance.name, forgeFullVersion: newVersion })
      onInstanceUpdated()
    } catch (error) {
      console.error("Failed to update Forge loader:", error)
      alertModal = { isOpen: true, title: "An error occurred", message: `Failed to update Forge loader: ${String(error)}`, type: "danger" }
      selectedForgeVersion = instance.loader_version || ""
    } finally {
      isUpdatingForge = false
    }
  }

  function handleIconClick() {
    fileInputEl?.click()
  }

  function handleIconChange(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      alertModal = { isOpen: true, title: "Invalid File", message: "Please select an image file (PNG, JPEG, WebP, or GIF)", type: "danger" }
      return
    }

    if (file.size > 25 * 1024 * 1024) {
      alertModal = { isOpen: true, title: "File Too Large", message: "Image must be smaller than 25MB", type: "danger" }
      return
    }

    isUploadingIcon = true

    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1]

        try {
          const iconPath = await invoke<string | null>("set_instance_icon", { instanceName: instance.name, imageData: base64 })
          bumpInstanceIcon(instance.name)
          localIcon = instanceIconSrc(iconPath, instance.name)
          onInstanceUpdated()
        } catch (error) {
          console.error("Failed to set icon:", error)
          alertModal = { isOpen: true, title: "An error occurred", message: `Failed to set icon: ${String(error)}`, type: "danger" }
        } finally {
          isUploadingIcon = false
        }
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error("Failed to read file:", error)
      isUploadingIcon = false
    }

    input.value = ""
  }

  function handleRemoveIcon() {
    confirmModal = {
      isOpen: true,
      title: "Remove Icon",
      message: "Are you sure you want to remove this instance icon?",
      type: "warning",
      onConfirm: async () => {
        confirmModal = null
        try {
          await invoke("remove_instance_icon", { instanceName: instance.name })
          clearInstanceIcon(instance.name)
          localIcon = null
          onInstanceUpdated()
        } catch (error) {
          console.error("Failed to remove icon:", error)
          alertModal = { isOpen: true, title: "An error occurred", message: `Failed to remove icon: ${String(error)}`, type: "danger" }
        }
      }
    }
  }

  function handleClose() {
    if (isClosing) return
    isClosing = true
    closeTimer = setTimeout(() => {
      isClosing = false
      onClose()
    }, 150)
  }

  $effect(() => {
    if (isOpen) {
      clearTimeout(closeTimer)
      isClosing = false
    }
  })

  async function handleRename(trimmedName: string) {
    if (!trimmedName) { renameError = "Instance name cannot be empty"; return }
    if (trimmedName === instance.name) { renameError = null; return }
    isRenamingInstance = true
    try {
      await invoke("rename_instance", { oldName: instance.name, newName: trimmedName })
      renameError = null
      if (onInstanceRenamed) onInstanceRenamed(instance.name, trimmedName)
      else handleInstanceRenamed(instance.name, trimmedName)
      onClose()
    } catch (error) {
      renameError = error as string
      newName = instance.name
    } finally {
      isRenamingInstance = false
    }
  }

  function handleDelete() {
    if (store.runningInstances.has(instance.name)) {
      alertModal = { isOpen: true, title: "Instance is running", message: `Stop "${instance.name}" before deleting it.`, type: "warning" }
      return
    }
    confirmModal = {
      isOpen: true,
      title: "Delete Instance",
      message: `Are you sure you want to delete "${instance.name}"?\n\nThis action cannot be undone.`,
      type: "danger",
      onConfirm: () => {
        confirmModal = null
        onClose()
        onInstanceDeleted()
        deleteInstanceOptimistically(instance.name, true)
      }
    }
  }

  let minMem = 1024
  let maxMem = $derived(systemInfo?.total_memory_mb || 32768)
  let ramPercent = $derived(((instanceMemoryMb - minMem) / (maxMem - minMem)) * 100)
</script>

{#if isOpen}
  <div
    role="presentation"
    class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop"
    class:closing={isClosing}
    onclick={handleClose}
    onkeydown={(e) => { if (e.key === 'Escape') handleClose() }}
  >
    <div
      role="presentation"
      class="border border-[var(--border-subtle)] bg-[var(--content-bg)] rounded-md w-full max-w-2xl shadow-md modal-content"
      class:closing={isClosing}
      onclick={(e) => e.stopPropagation()}
      style="pointer-events: auto"
    >
      <div class="flex items-center justify-between px-5 pt-5 pb-4">
        <h2 class="text-lg font-semibold text-[var(--text-primary)] tracking-tight">Instance Settings</h2>
        <button onclick={handleClose} class="p-1.5 hover:bg-[var(--bg-hover)] rounded-sm transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div class="px-5 pb-5">
        <div class="grid grid-cols-2 gap-x-5 gap-y-5 items-start">

          <!-- Icon -->
          <div>
            <label for="instance-icon-input" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Instance Icon</label>
            <div class="flex items-center gap-4">
              <input id="instance-icon-input" bind:this={fileInputEl} type="file" accept="image/*" onchange={handleIconChange} class="hidden" />
              {#if localIcon}
                <button onclick={handleIconClick} disabled={isUploadingIcon} class="w-12 h-12 flex-shrink-0 rounded-sm overflow-hidden relative cursor-pointer group bg-[var(--bg-tertiary)]">
                  <img src={localIcon} alt={instance.name} class="w-full h-full object-cover" />
                  <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera size={16} class="text-[var(--text-muted)]" />
                  </div>
                </button>
              {:else}
                <button onclick={handleIconClick} disabled={isUploadingIcon} class="w-12 h-12 flex-shrink-0 border-2 border-dashed border-[var(--text-muted)] hover:border-[var(--accent-primary)]/50 rounded-sm flex items-center justify-center transition-all bg-[var(--bg-tertiary)] cursor-pointer">
                  {#if isUploadingIcon}
                    <Loader2 size={18} class="text-[var(--accent-primary)] animate-spin" />
                  {:else}
                    <ImagePlus size={18} class="text-[var(--text-muted)]" />
                  {/if}
                </button>
              {/if}

              {#if localIcon}
                <button onclick={handleRemoveIcon} disabled={isUploadingIcon} class="px-4 h-11 bg-[var(--bg-tertiary)] hover:bg-red-500/10 text-[var(--text-primary)] hover:text-red-400 rounded-sm text-sm font-medium transition-all disabled:opacity-50 cursor-pointer">
                  Remove Icon
                </button>
              {:else}
                <button onclick={handleIconClick} disabled={isUploadingIcon} class="px-4 h-11 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-sm text-sm font-medium transition-all disabled:opacity-50 cursor-pointer">
                  Upload Icon
                </button>
              {/if}
            </div>
          </div>

          <!-- Name -->
          <div>
            <label for="instance-name-input" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Instance Name</label>
            <div class="relative">
              <input
                id="instance-name-input"
                type="text"
                bind:value={newName}
                oninput={() => renameError = null}
                onblur={(e) => { const trimmed = (e.target as HTMLInputElement).value.trim(); if (trimmed && trimmed !== instance.name) handleRename(trimmed) }}
                onkeydown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                class="w-full bg-[var(--bg-tertiary)] rounded-sm px-4 py-3.5 pr-10 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none transition-all"
                placeholder="Enter instance name"
                disabled={isRenamingInstance}
              />
              {#if isRenamingInstance}
                <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Loader2 size={14} class="animate-spin text-[var(--accent-primary)]" />
                </div>
              {/if}
            </div>
            {#if renameError}
              <p class="text-xs text-red-400 mt-2">{renameError}</p>
            {/if}
          </div>

          <!-- Minecraft Version -->
          <div>
            <label for="minecraft-version-btn" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Minecraft Version</label>
            {#if isLoadingVersions}
              <div class="flex items-center gap-2 text-[var(--text-muted)] text-sm py-3.5 px-4 bg-[var(--bg-tertiary)] rounded-sm">
                <Loader2 size={16} class="animate-spin text-[var(--accent-primary)]" />
                <span>Loading...</span>
              </div>
            {:else}
              <div class="relative" bind:this={versionDropdownRef}>
                <button
                  id="minecraft-version-btn"
                  type="button"
                  onclick={() => isVersionDropdownOpen = !isVersionDropdownOpen}
                  class="w-full bg-[var(--bg-tertiary)] px-4 py-3.5 pr-10 text-sm text-[var(--text-primary)] focus:outline-none transition-all text-left cursor-pointer {isVersionDropdownOpen ? 'rounded-t-sm' : 'rounded-sm'}"
                  disabled={isUpdatingVersion}
                >
                  {selectedMinecraftVersion}
                </button>
                <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  {#if isUpdatingVersion}
                    <Loader2 size={16} class="animate-spin text-[var(--accent-primary)]" />
                  {:else if isVersionDropdownOpen}
                    <ChevronUp size={18} strokeWidth={3} />
                  {:else}
                    <ChevronDown size={18} strokeWidth={3} />
                  {/if}
                </div>
                {#if isVersionDropdownOpen}
                  <div class="absolute z-10 w-full bg-[var(--bg-tertiary)] rounded-b-sm shadow-md max-h-60 overflow-y-auto custom-scrollbar border-t border-[var(--bg-elevated)]">
                    {#each minecraftVersions as version (version)}
                      <button
                        type="button"
                        onclick={() => handleVersionSelect(version)}
                        class="w-full px-4 py-3 text-sm text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-between cursor-pointer text-[var(--text-primary)]"
                      >
                        <span>{version}</span>
                        {#if selectedMinecraftVersion === version}
                          <Check size={17} class="text-[var(--accent-primary)]" strokeWidth={3} />
                        {/if}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Loader version (Fabric / NeoForge / Forge) -->
          {#snippet loaderSelect(
            id: string,
            label: string,
            loading: boolean,
            open: boolean,
            toggle: () => void,
            disabled: boolean,
            updating: boolean,
            buttonText: string,
            items: Array<{ key: string; label: string }>,
            selectedKey: string,
            onSelect: (key: string) => void,
            setRef: (el: HTMLDivElement | undefined) => void
          )}
            <div>
              <label for={id} class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">{label}</label>
              {#if loading}
                <div class="flex items-center gap-2 text-[var(--text-muted)] text-sm py-3.5 px-4 bg-[var(--bg-tertiary)] rounded-sm">
                  <Loader2 size={16} class="animate-spin text-[var(--accent-primary)]" />
                  <span>Loading...</span>
                </div>
              {:else}
                <div
                  class="relative"
                  {@attach (node) => {
                    setRef(node as HTMLDivElement)
                    return () => setRef(undefined)
                  }}
                >
                  <button
                    {id}
                    type="button"
                    onclick={toggle}
                    class="w-full bg-[var(--bg-tertiary)] px-4 py-3.5 pr-10 text-sm text-[var(--text-primary)] focus:outline-none transition-all text-left cursor-pointer {open ? 'rounded-t-sm' : 'rounded-sm'}"
                    {disabled}
                  >
                    {buttonText}
                  </button>
                  <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    {#if updating}
                      <Loader2 size={16} class="animate-spin text-[var(--accent-primary)]" />
                    {:else if open}
                      <ChevronUp size={18} strokeWidth={3} />
                    {:else}
                      <ChevronDown size={18} strokeWidth={3} />
                    {/if}
                  </div>
                  {#if open}
                    <div class="absolute z-10 w-full bg-[var(--bg-tertiary)] rounded-b-sm shadow-md max-h-60 overflow-y-auto custom-scrollbar border-t border-[var(--bg-elevated)]">
                      {#each items as item (item.key)}
                        <button
                          type="button"
                          onclick={() => onSelect(item.key)}
                          class="w-full px-4 py-3 text-sm text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-between cursor-pointer text-[var(--text-primary)]"
                        >
                          <span>{item.label}</span>
                          {#if selectedKey === item.key}
                            <Check size={17} class="text-[var(--accent-primary)]" strokeWidth={3} />
                          {/if}
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/snippet}
          <div>
            {#if isFabricInstance}
              {@render loaderSelect("fabric-loader-btn", "Fabric Loader Version", isLoadingFabric, isFabricDropdownOpen, () => isFabricDropdownOpen = !isFabricDropdownOpen, isUpdatingFabric, isUpdatingFabric, `${selectedFabricVersion}${fabricVersions.find((v: FabricVersion) => v.version === selectedFabricVersion)?.stable ? " (Stable)" : ""}`, fabricVersions.map((v: FabricVersion) => ({ key: v.version, label: `${v.version}${v.stable ? " (Stable)" : ""}` })), selectedFabricVersion, (key) => handleFabricSelect(key), (el) => { fabricDropdownRef = el })}
            {:else if isNeoforgeInstance}
              {@render loaderSelect("neoforge-loader-btn", "NeoForge Loader Version", isLoadingNeoforge, isNeoforgeDropdownOpen, () => isNeoforgeDropdownOpen = !isNeoforgeDropdownOpen, isUpdatingNeoforge, isUpdatingNeoforge, selectedNeoforgeVersion, neoforgeVersions.map((v: NeoForgeVersion) => ({ key: v.full_version, label: v.full_version })), selectedNeoforgeVersion, (key) => handleNeoforgeSelect(key), (el) => { neoforgeDropdownRef = el })}
            {:else if isForgeInstance}
              {@render loaderSelect("forge-loader-btn", "Forge Loader Version", isLoadingForge, isForgeDropdownOpen, () => isForgeDropdownOpen = !isForgeDropdownOpen, isUpdatingForge, isUpdatingForge, selectedForgeVersion, forgeVersions.map((v: ForgeVersion) => ({ key: v.full_version, label: v.full_version })), selectedForgeVersion, (key) => handleForgeSelect(key), (el) => { forgeDropdownRef = el })}
            {/if}
          </div>

          <!-- RAM Allocation -->
          <div class="col-span-2">
            <div class="flex items-center justify-between mb-2.5">
              <div class="flex items-center gap-2 text-[var(--text-primary)]">
                <span class="text-sm font-medium">RAM Allocation</span>
              </div>
                <button
                  onclick={() => { const next = !useCustomRam; useCustomRam = next; saveRamSettings(instanceMemoryMb, next) }}
                  class="relative w-9 h-[22px] rounded-full transition-colors shrink-0 cursor-pointer {useCustomRam ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-hover-strong)]'}"
                  aria-label="Toggle custom RAM"
                >
                  <span class="absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform {useCustomRam ? 'translate-x-[14px]' : ''}"></span>
                </button>
            </div>
            <div class="transition-opacity {useCustomRam ? 'opacity-100' : 'opacity-40 pointer-events-none'}">
              <div class="bg-[var(--bg-tertiary)] rounded p-4 space-y-3">
                <div class="flex items-baseline justify-between">
                  <span class="text-2xl font-bold text-[var(--text-primary)]">{(instanceMemoryMb / 1024).toFixed(1)} GB</span>
                  <span class="text-xs text-[var(--text-muted)]">{systemInfo ? `of ${(systemInfo.total_memory_mb / 1024).toFixed(0)} GB total` : ""}</span>
                </div>
                <div class="relative h-6 flex items-center">
                  <div class="absolute inset-x-0 h-2 bg-[var(--content-bg)] rounded-full"></div>
                  <div class="absolute h-2 rounded-full" style="width: {ramPercent}%; background: var(--accent-primary)"></div>
                  <div class="absolute w-4 h-4 rounded-full bg-[var(--accent-primary)] -translate-x-1/2 shadow-md top-1/2 -mt-2" style="left: {ramPercent}%"></div>
                  <input
                    type="range" min={minMem} max={maxMem} step="512"
                    bind:value={instanceMemoryMb}
                    oninput={handleRamChange}
                    class="absolute inset-0 w-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Delete -->
          <div class="col-span-2 pt-3">
            <button
              onclick={handleDelete}
              class="w-full px-4 h-11 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-sm font-medium text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Trash2 size={16} />
              <span>Delete Instance</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if confirmModal}
  <ConfirmModal
    isOpen={confirmModal.isOpen}
    title={confirmModal.title}
    message={confirmModal.message}
    type={confirmModal.type}
    confirmText={confirmModal.type === "danger" ? "Delete" : "Confirm"}
    onConfirm={confirmModal.onConfirm}
    onCancel={() => confirmModal = null}
  />
{/if}

{#if alertModal}
  <AlertModal
    isOpen={alertModal.isOpen}
    title={alertModal.title}
    message={alertModal.message}
    type={alertModal.type}
    onClose={() => alertModal = null}
  />
{/if}
