<script lang="ts">
  import { invoke } from "@tauri-apps/api/core"
  import type { Instance, FabricVersion, NeoForgeVersion, ForgeVersion } from "../../../../types"
  import VersionDropdown from "./version-dropdown.svelte"

  let { instance, onInstanceUpdated, onAlert }: {
    instance: Instance
    onInstanceUpdated: () => void
    onAlert: (alert: { isOpen: boolean; title: string; message: string; type: "warning" | "danger" | "success" | "info" }) => void
  } = $props()

  let isFabricInstance = $derived(instance.loader === "fabric")
  let isNeoforgeInstance = $derived(instance.loader === "neoforge")
  let isForgeInstance = $derived(instance.loader === "forge")

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

  async function loadFabricVersions() {
    isLoadingFabric = true
    try {
      const versions = await invoke<FabricVersion[]>("get_fabric_versions")
      fabricVersions = versions
    } catch (error) {
      onAlert({ isOpen: true, title: "An error occurred", message: `Failed to load Fabric versions: ${String(error)}`, type: "danger" })
    } finally {
      isLoadingFabric = false
    }
  }

  async function handleFabricSelect(newVersion: string) {
    if (!newVersion || newVersion === instance.loader_version) return
    selectedFabricVersion = newVersion
    isUpdatingFabric = true
    try {
      await invoke("update_instance_fabric_loader", { instanceName: instance.name, fabricVersion: newVersion })
      onInstanceUpdated()
    } catch (error) {
      onAlert({ isOpen: true, title: "An error occurred", message: `Failed to update Fabric loader: ${String(error)}`, type: "danger" })
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
      onAlert({ isOpen: true, title: "An error occurred", message: `Failed to load NeoForge versions: ${String(error)}`, type: "danger" })
    } finally {
      isLoadingNeoforge = false
    }
  }

  async function handleNeoforgeSelect(newVersion: string) {
    if (!newVersion || newVersion === instance.loader_version) return
    selectedNeoforgeVersion = newVersion
    isUpdatingNeoforge = true
    try {
      await invoke("update_instance_neoforge_loader", { instanceName: instance.name, neoforgeVersion: newVersion })
      onInstanceUpdated()
    } catch (error) {
      onAlert({ isOpen: true, title: "An error occurred", message: `Failed to update NeoForge loader: ${String(error)}`, type: "danger" })
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
      onAlert({ isOpen: true, title: "An error occurred", message: `Failed to load Forge versions: ${String(error)}`, type: "danger" })
    } finally {
      isLoadingForge = false
    }
  }

  async function handleForgeSelect(newVersion: string) {
    if (!newVersion || newVersion === instance.loader_version) return
    selectedForgeVersion = newVersion
    isUpdatingForge = true
    try {
      await invoke("update_instance_forge_loader", { instanceName: instance.name, forgeFullVersion: newVersion })
      onInstanceUpdated()
    } catch (error) {
      onAlert({ isOpen: true, title: "An error occurred", message: `Failed to update Forge loader: ${String(error)}`, type: "danger" })
      selectedForgeVersion = instance.loader_version || ""
    } finally {
      isUpdatingForge = false
    }
  }

  $effect(() => {
    selectedFabricVersion = instance.loader_version || ""
    selectedNeoforgeVersion = instance.loader_version || ""
    selectedForgeVersion = instance.loader_version || ""
    if (isFabricInstance) loadFabricVersions()
    if (isNeoforgeInstance) loadNeoforgeVersions()
    if (isForgeInstance) loadForgeVersions()
  })
</script>

<div>
  {#if isFabricInstance}
    <VersionDropdown
      id="fabric-loader-btn"
      label="Fabric Loader Version"
      loading={isLoadingFabric}
      updating={isUpdatingFabric}
      disabled={isUpdatingFabric}
      buttonText={`${selectedFabricVersion}${fabricVersions.find((v) => v.version === selectedFabricVersion)?.stable ? " (Stable)" : ""}`}
      items={fabricVersions.map((v) => ({ key: v.version, label: `${v.version}${v.stable ? " (Stable)" : ""}` }))}
      selectedKey={selectedFabricVersion}
      onSelect={handleFabricSelect}
    />
  {:else if isNeoforgeInstance}
    <VersionDropdown
      id="neoforge-loader-btn"
      label="NeoForge Loader Version"
      loading={isLoadingNeoforge}
      updating={isUpdatingNeoforge}
      disabled={isUpdatingNeoforge}
      buttonText={selectedNeoforgeVersion}
      items={neoforgeVersions.map((v) => ({ key: v.full_version, label: v.full_version }))}
      selectedKey={selectedNeoforgeVersion}
      onSelect={handleNeoforgeSelect}
    />
  {:else if isForgeInstance}
    <VersionDropdown
      id="forge-loader-btn"
      label="Forge Loader Version"
      loading={isLoadingForge}
      updating={isUpdatingForge}
      disabled={isUpdatingForge}
      buttonText={selectedForgeVersion}
      items={forgeVersions.map((v) => ({ key: v.full_version, label: v.full_version }))}
      selectedKey={selectedForgeVersion}
      onSelect={handleForgeSelect}
    />
  {/if}
</div>
