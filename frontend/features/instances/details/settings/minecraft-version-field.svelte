<script lang="ts">
  import { invoke } from "@tauri-apps/api/core"
  import type { Instance } from "../../../../types"
  import VersionDropdown from "./version-dropdown.svelte"

  let { instance, onInstanceUpdated, onAlert, onConfirm }: {
    instance: Instance
    onInstanceUpdated: () => void
    onAlert: (alert: { isOpen: boolean; title: string; message: string; type: "warning" | "danger" | "success" | "info" }) => void
    onConfirm: (confirm: { isOpen: boolean; title: string; message: string; type: "warning" | "danger" | "success" | "info"; onConfirm: () => void }) => void
  } = $props()

  let minecraftVersions = $state<string[]>([])
  let selectedMinecraftVersion = $state("")
  let isLoadingVersions = $state(false)
  let isUpdatingVersion = $state(false)

  function getMinecraftVersion(versionString: string): string {
    if (instance.loader === "fabric") {
      const parts = versionString.split("-")
      return parts[parts.length - 1]
    }
    if (instance.loader === "neoforge") {
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
    if (instance.loader === "forge") {
      return versionString.split("-forge-")[0] || versionString
    }
    return versionString
  }

  async function loadMinecraftVersions() {
    isLoadingVersions = true
    try {
      const versions = await invoke<string[]>("get_minecraft_versions_by_type", { versionType: "release" })
      minecraftVersions = versions
    } catch (error) {
      onAlert({ isOpen: true, title: "An error occurred", message: `Failed to load Minecraft versions: ${String(error)}`, type: "danger" })
    } finally {
      isLoadingVersions = false
    }
  }

  function handleVersionSelect(newVersion: string) {
    if (!newVersion || newVersion === getMinecraftVersion(instance.version)) {
      return
    }

    onConfirm({
      isOpen: true,
      title: "Update Minecraft Version",
      message: `Are you sure you want to update this instance to Minecraft ${newVersion}?\n\nThis will download the new version and update the instance. Your worlds and settings will be preserved.`,
      type: "warning",
      onConfirm: async () => {
        selectedMinecraftVersion = newVersion
        isUpdatingVersion = true
        try {
          await invoke("update_instance_minecraft_version", { instanceName: instance.name, newMinecraftVersion: newVersion })
          onInstanceUpdated()
        } catch (error) {
          onAlert({ isOpen: true, title: "An error occurred", message: `Failed to update Minecraft version: ${String(error)}`, type: "danger" })
          selectedMinecraftVersion = getMinecraftVersion(instance.version)
        } finally {
          isUpdatingVersion = false
        }
      }
    })
  }

  $effect(() => {
    selectedMinecraftVersion = getMinecraftVersion(instance.version)
    loadMinecraftVersions()
  })
</script>

<VersionDropdown
  id="minecraft-version-btn"
  label="Minecraft Version"
  loading={isLoadingVersions}
  updating={isUpdatingVersion}
  disabled={isUpdatingVersion}
  buttonText={selectedMinecraftVersion}
  items={minecraftVersions.map((v) => ({ key: v, label: v }))}
  selectedKey={selectedMinecraftVersion}
  onSelect={handleVersionSelect}
/>
