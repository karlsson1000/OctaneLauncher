import { useState, useEffect, useMemo } from "react"
import { Play, FolderOpen, Package, Loader2, ExternalLink, Globe, Settings, Trash2, RefreshCw, Search, X, Image, Palette } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { ConfirmModal, AlertModal } from "../../components/ui/ConfirmModal"
import { InstanceSettingsModal } from "./InstanceSettingsModal"
import type { Instance, ModFileWithMetadata, ModrinthVersion, ModrinthFile } from "../../types"

type InstalledMod = ModFileWithMetadata

interface ModUpdate {
  filename: string
  projectId: string
  currentVersionId: string
  latestVersion: {
    id: string
    name: string
    version_number: string
    downloadUrl: string
    filename: string
  }
}

interface World {
  name: string
  folder_name: string
  size: number
  last_played?: number
  game_mode?: string
  version?: string
  icon?: string
  created?: number
}

interface InstanceDetailsTabProps {
  instance: Instance
  isAuthenticated: boolean
  isLaunching: boolean
  isRunning: boolean
  onLaunch: () => void
  onWorldLaunch?: (worldName: string) => void
  onBack: () => void
  onInstanceUpdated: () => void
  onInstanceRenamed?: (oldName: string, newName: string) => void
}

export function InstanceDetailsTab({
  instance,
  isAuthenticated,
  isLaunching,
  isRunning,
  onLaunch,
  onWorldLaunch,
  onBack,
  onInstanceUpdated,
  onInstanceRenamed,
}: InstanceDetailsTabProps) {
  const [installedMods, setInstalledMods] = useState<InstalledMod[]>([])
  const [worlds, setWorlds] = useState<World[]>([])
  const [isLoadingMods, setIsLoadingMods] = useState(true)
  const [isLoadingWorlds, setIsLoadingWorlds] = useState(true)
  const [instanceIcon, setInstanceIcon] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [availableUpdates, setAvailableUpdates] = useState<ModUpdate[]>([])
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)
  const [isUpdatingMods, setIsUpdatingMods] = useState(false)
  const [modSearchQuery, setModSearchQuery] = useState("")
  const [worldSearchQuery, setWorldSearchQuery] = useState("")
  const [launchingWorld, setLaunchingWorld] = useState<string | null>(null)
  const [resourcePacks, setResourcePacks] = useState<ModFileWithMetadata[]>([])
  const [shaderPacks, setShaderPacks] = useState<ModFileWithMetadata[]>([])
  const [isLoadingResourcePacks, setIsLoadingResourcePacks] = useState(true)
  const [isLoadingShaderPacks, setIsLoadingShaderPacks] = useState(true)
  const [resourcePackSearchQuery, setResourcePackSearchQuery] = useState("")
  const [shaderPackSearchQuery, setShaderPackSearchQuery] = useState("")
  const [detailSection, setDetailSection] = useState<"mods" | "worlds" | "resourcepacks" | "shaderpacks">("mods")
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
    onConfirm: () => void
  } | null>(null)
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null>(null)

  useEffect(() => {
    loadInstalledMods()
    loadWorlds()
    loadResourcePacks()
    loadShaderPacks()
    loadInstanceIcon()
  }, [instance.name])

  useEffect(() => {
    loadInstanceIcon()
  }, [instance])

  const loadInstanceIcon = async () => {
    try {
      const icon = await invoke<string | null>("get_instance_icon", { instanceName: instance.name })
      setInstanceIcon(icon)
    } catch (error) {
      console.error("Failed to load instance icon:", error)
      setInstanceIcon(null)
    }
  }

  const loadWorlds = async () => {
    setIsLoadingWorlds(true)
    try {
      const worldsList = await invoke<World[]>("get_instance_worlds", { instanceName: instance.name })
      setWorlds(worldsList)
    } catch (error) {
      console.error("Failed to load worlds:", error)
      setWorlds([])
    } finally {
      setIsLoadingWorlds(false)
    }
  }

  const loadInstalledMods = async () => {
    setIsLoadingMods(true)
    try {
      const mods = await invoke<InstalledMod[]>("get_installed_mods_with_metadata", { instanceName: instance.name })
      setInstalledMods(mods)
    } catch (error) {
      console.error("Failed to load installed mods:", error)
      setInstalledMods([])
    } finally {
      setIsLoadingMods(false)
    }
  }

  const loadResourcePacks = async () => {
    setIsLoadingResourcePacks(true)
    try {
      const packs = await invoke<ModFileWithMetadata[]>("get_installed_resourcepacks_with_metadata", { instanceName: instance.name })
      setResourcePacks(packs)
    } catch (error) {
      console.error("Failed to load resource packs:", error)
      setResourcePacks([])
    } finally {
      setIsLoadingResourcePacks(false)
    }
  }

  const loadShaderPacks = async () => {
    setIsLoadingShaderPacks(true)
    try {
      const packs = await invoke<ModFileWithMetadata[]>("get_installed_shaderpacks_with_metadata", { instanceName: instance.name })
      setShaderPacks(packs)
    } catch (error) {
      console.error("Failed to load shader packs:", error)
      setShaderPacks([])
    } finally {
      setIsLoadingShaderPacks(false)
    }
  }

  const checkForUpdates = async () => {
    if (!instance || (instance.loader !== "fabric" && instance.loader !== "neoforge" && instance.loader !== "forge")) return

    setIsCheckingUpdates(true)
    const updates: ModUpdate[] = []

    try {
      const mcVersion = getMinecraftVersion(instance)

      for (const mod of installedMods) {
        if (!mod.project_id || !mod.current_version_id || mod.disabled) continue

        try {
          const versions = await invoke<ModrinthVersion[]>("get_mod_versions", {
            idOrSlug: mod.project_id,
            loaders: [instance.loader],
            gameVersions: [mcVersion],
          })

          if (versions && versions.length > 0) {
            const latestVersion = versions[0]

            if (latestVersion.id !== mod.current_version_id) {
              const primaryFile = latestVersion.files.find((f: ModrinthFile) => f.primary) || latestVersion.files[0]

              if (primaryFile) {
                updates.push({
                  filename: mod.filename,
                  projectId: mod.project_id,
                  currentVersionId: mod.current_version_id,
                  latestVersion: { id: latestVersion.id, name: latestVersion.name, version_number: latestVersion.version_number, downloadUrl: primaryFile.url, filename: primaryFile.filename },
                })
              }
            }
          }
        } catch (error) {
          console.error(`Failed to check updates for ${mod.name || mod.filename}:`, error)
        }
      }

      setAvailableUpdates(updates)
    } catch (error) {
      console.error("Failed to check for updates:", error)
      setAlertModal({ isOpen: true, title: "Error", message: `Failed to check for updates: ${String(error)}`, type: "danger" })
    } finally {
      setIsCheckingUpdates(false)
    }
  }

  const updateAllMods = async () => {
    if (availableUpdates.length === 0) return

    setIsUpdatingMods(true)

    for (const update of availableUpdates) {
      try {
        await invoke("download_mod", { instanceName: instance.name, downloadUrl: update.latestVersion.downloadUrl, filename: update.latestVersion.filename })
        if (update.filename !== update.latestVersion.filename) {
          await invoke("delete_mod", { instanceName: instance.name, filename: update.filename }).catch(err =>
            console.error(`Failed to delete old version ${update.filename}:`, err)
          )
        }
      } catch (error) {
        console.error(`Failed to update mod ${update.filename}:`, error)
      }
    }

    setIsUpdatingMods(false)
    setAvailableUpdates([])

    await loadInstalledMods()
  }

  const updateSingleMod = async (update: ModUpdate) => {
    try {
      await invoke("download_mod", { instanceName: instance.name, downloadUrl: update.latestVersion.downloadUrl, filename: update.latestVersion.filename })
      if (update.filename !== update.latestVersion.filename) {
        await invoke("delete_mod", { instanceName: instance.name, filename: update.filename }).catch(err =>
          console.error(`Failed to delete old version ${update.filename}:`, err)
        )
      }
      setAvailableUpdates(prev => prev.filter(u => u.filename !== update.filename))
      await loadInstalledMods()
    } catch (error) {
      console.error(`Failed to update mod ${update.filename}:`, error)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${bytes} B`
  }

  const formatPlaytime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}m played`
    if (minutes > 0) return `${minutes}m played`
    return `${seconds}s played`
  }

  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return "Unknown"
    const date = new Date(timestamp * 1000)

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    let hours = date.getHours()
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12 || 12
    return `${year}-${month}-${day} at ${hours}:${minutes} ${ampm}`
  }

  const getMinecraftVersion = (instance: Instance): string => {
    if (instance.loader === "fabric") {
      const parts = instance.version.split('-')
      return parts[parts.length - 1]
    }
    if (instance.loader === "neoforge") {
      const versionPart = instance.version.replace('neoforge-', '')
      const parts = versionPart.split('-')
      if (parts[0].startsWith('1.')) return parts[0]
      const versionNumbers = parts[0].split('.')
      if (versionNumbers.length >= 2) {
        const major = parseInt(versionNumbers[0])
        const minor = versionNumbers[1]
        const patch = versionNumbers[2]
        if (major >= 22) {
          if (patch && parseInt(patch) !== 0) return `${major}.${minor}.${patch}`
          return minor === '0' ? `${major}` : `${major}.${minor}`
        }
        if (major >= 20) return minor === '0' ? `1.${major}` : `1.${major}.${minor}`
      }
    }
    if (instance.loader === "forge") {
      return instance.version.split('-forge-')[0] || instance.version
    }
    return instance.version
  }

  const getFabricLoaderVersion = (instance: Instance): string | null => {
    if (instance.loader === "fabric") {
      const parts = instance.version.split('-')
      if (parts.length >= 2) return parts[parts.length - 2]
    }
    return null
  }

  const getNeoForgeVersion = (instance: Instance): string | null => {
    if (instance.loader === "neoforge") {
      const versionPart = instance.version.replace('neoforge-', '')
      const parts = versionPart.split('-')

      const mcVersion = getMinecraftVersion(instance)
      const neoforgeVersionParts = parts.filter(part => part !== mcVersion)
      if (neoforgeVersionParts.length > 0) return neoforgeVersionParts.join('-')
    }
    return null
  }

  const getForgeVersion = (instance: Instance): string | null => {
    if (instance.loader === "forge") {
      const parts = instance.version.split('-forge-')
      if (parts.length > 1) return parts[1]
    }
    return null
  }

  const handleOpenFolder = async () => {
    try {
      await invoke("open_instance_folder", { instanceName: instance.name })
    } catch (error) {
      console.error("Failed to open folder:", error)
    }
  }

  const handleDeleteMod = async (filename: string) => {
    try {
      await invoke("delete_mod", { instanceName: instance.name, filename })
      await loadInstalledMods()
      setAvailableUpdates([])
    } catch (error) {
      console.error("Failed to delete mod:", error)
      setAlertModal({ isOpen: true, title: "Error", message: `Failed to delete mod: ${String(error)}`, type: "danger" })
    }
  }

  const handleDeleteWorld = async (folderName: string, worldName: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete World",
      message: `Are you sure you want to delete "${worldName}"?\n\nThis action cannot be undone.`,
      type: "danger",
      onConfirm: async () => {
        setConfirmModal(null)
        try {
          await invoke("delete_world", { instanceName: instance.name, folderName })
          await loadWorlds()
        } catch (error) {
          console.error("Failed to delete world:", error)
          setAlertModal({ isOpen: true, title: "Error", message: `Failed to delete world: ${String(error)}`, type: "danger" })
        }
      }
    })
  }

  const handleDeleteResourcePack = async (filename: string) => {
    try {
      await invoke("delete_resourcepack", { instanceName: instance.name, filename })
      await loadResourcePacks()
    } catch (error) {
      console.error("Failed to delete resource pack:", error)
      setAlertModal({ isOpen: true, title: "Error", message: `Failed to delete resource pack: ${String(error)}`, type: "danger" })
    }
  }

  const handleDeleteShaderPack = async (filename: string) => {
    try {
      await invoke("delete_shaderpack", { instanceName: instance.name, filename })
      await loadShaderPacks()
    } catch (error) {
      console.error("Failed to delete shader pack:", error)
      setAlertModal({ isOpen: true, title: "Error", message: `Failed to delete shader pack: ${String(error)}`, type: "danger" })
    }
  }

  const handleToggleMod = async (mod: InstalledMod) => {
    setInstalledMods(prev => prev.map(m => m.filename === mod.filename ? { ...m, disabled: !m.disabled } : m))
    try {
      await invoke("toggle_mod", { instanceName: instance.name, filename: mod.filename, disable: !mod.disabled })
    } catch (error) {
      setInstalledMods(prev => prev.map(m => m.filename === mod.filename ? { ...m, disabled: !m.disabled } : m))
      console.error("Failed to toggle mod:", error)
      setAlertModal({ isOpen: true, title: "Error", message: `Failed to ${mod.disabled ? 'enable' : 'disable'} mod: ${String(error)}`, type: "danger" })
    }
  }

  const handleOpenWorldsFolder = async () => {
    try {
      await invoke("open_worlds_folder", { instanceName: instance.name })
    } catch (error) {
      console.error("Failed to open worlds folder:", error)
      setAlertModal({ isOpen: true, title: "Error", message: `Failed to open worlds folder: ${String(error)}`, type: "danger" })
    }
  }

  const handleOpenWorldFolder = async (folderName: string) => {
    try {
      await invoke("open_world_folder", { instanceName: instance.name, folderName })
    } catch (error) {
      console.error("Failed to open world folder:", error)
      setAlertModal({ isOpen: true, title: "Error", message: `Failed to open world folder: ${String(error)}`, type: "danger" })
    }
  }

  const handleLaunchWorld = async (worldName: string) => {
    if (onWorldLaunch) {
      onWorldLaunch(worldName)
    } else {
      setLaunchingWorld(worldName)
      try {
        await invoke("launch_world", { instanceName: instance.name, worldName })
      } catch (error) {
        console.error("Failed to launch world:", error)
        setAlertModal({ isOpen: true, title: "Error", message: `Failed to launch world: ${String(error)}`, type: "danger" })
      }
    }
  }

  const handleOpenResourcePacksFolder = async () => {
    try {
      await invoke("open_resourcepacks_folder", { instanceName: instance.name })
    } catch (error) {
      console.error("Failed to open resourcepacks folder:", error)
    }
  }

  const handleOpenShaderPacksFolder = async () => {
    try {
      await invoke("open_shaderpacks_folder", { instanceName: instance.name })
    } catch (error) {
      console.error("Failed to open shaderpacks folder:", error)
    }
  }

  const handleInstanceUpdated = () => {
    loadInstanceIcon()
    onInstanceUpdated()
  }

  const handleInstanceDeleted = () => {
    onBack()
    onInstanceUpdated()
  }

  const fabricLoaderVersion = getFabricLoaderVersion(instance)
  const neoforgeVersion = getNeoForgeVersion(instance)
  const modsWithProjectId = useMemo(() =>
    installedMods.filter(mod => mod.project_id && !mod.disabled).length
  , [installedMods])
  const filteredMods = useMemo(() =>
    installedMods.filter(mod => {
      if (!modSearchQuery.trim()) return true
      const query = modSearchQuery.toLowerCase()
      return (mod.name || mod.filename).toLowerCase().includes(query) || mod.filename.toLowerCase().includes(query)
    })
  , [installedMods, modSearchQuery])
  const filteredWorlds = useMemo(() =>
    worlds.filter(world => {
      if (!worldSearchQuery.trim()) return true
      return world.name.toLowerCase().includes(worldSearchQuery.toLowerCase())
    })
  , [worlds, worldSearchQuery])
  const filteredResourcePacks = useMemo(() =>
    resourcePacks.filter(pack => {
      if (!resourcePackSearchQuery.trim()) return true
      const query = resourcePackSearchQuery.toLowerCase()
      return (pack.name || pack.filename).toLowerCase().includes(query) || pack.filename.toLowerCase().includes(query)
    })
  , [resourcePacks, resourcePackSearchQuery])
  const filteredShaderPacks = useMemo(() =>
    shaderPacks.filter(pack => {
      if (!shaderPackSearchQuery.trim()) return true
      const query = shaderPackSearchQuery.toLowerCase()
      return (pack.name || pack.filename).toLowerCase().includes(query) || pack.filename.toLowerCase().includes(query)
    })
  , [shaderPacks, shaderPackSearchQuery])

  return (
    <>
          <div className="flex flex-col h-full overflow-hidden">

        <div className="flex-shrink-0 px-8 pt-8 pb-6">
          <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              {instanceIcon ? (
                <div className="w-16 h-16 rounded-md overflow-hidden bg-[var(--bg-secondary)]">
                  <img src={instanceIcon} alt={instance.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-md flex items-center justify-center bg-[var(--bg-secondary)]">
                  <Package size={48} className="text-[var(--text-muted)]" strokeWidth={1.5} />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight leading-tight">{instance.name}</h1>
                    {(instance.total_playtime_seconds ?? 0) > 0 && (
                      <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-xs rounded">
                        {formatPlaytime(instance.total_playtime_seconds ?? 0)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    {`Minecraft ${getMinecraftVersion(instance)}`}
                    {" • "}
                    {instance.loader === "fabric" ? (
                      <><span className="text-[#3b82f6]">Fabric Loader</span>{fabricLoaderVersion && <span className="text-[var(--text-muted)]"> {fabricLoaderVersion}</span>}</>
                    ) : instance.loader === "neoforge" ? (
                      <><span className="text-[#f97316]">NeoForge</span>{neoforgeVersion && <span className="text-[var(--text-muted)]"> {neoforgeVersion}</span>}</>
                    ) : instance.loader === "forge" ? (
                      <><span className="text-[#e05d2e]">Forge</span>{getForgeVersion(instance) && <span className="text-[var(--text-muted)]"> {getForgeVersion(instance)}</span>}</>
                    ) : (
                      <span className="text-[#16a34a]">Vanilla</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={onLaunch}
                    disabled={!isAuthenticated || isLaunching || isRunning}
                    className={`px-6 py-2 rounded-md font-semibold text-base flex items-center gap-2 transition-all active:scale-95 cursor-pointer ${isLaunching || isRunning ? "bg-red-500/10 text-red-400" : "bg-[#16a34a] hover:bg-[#15803d] text-[#181a1f]"} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isLaunching || isRunning ? (
                      <><div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /><span>Running...</span></>
                    ) : (
                      <><Play size={20} fill="currentColor" strokeWidth={0} /><span>Play</span></>
                    )}
                  </button>
                  <button onClick={handleOpenFolder} className="px-4 py-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover-strong)] text-[var(--text-primary)] rounded-md font-medium text-sm flex items-center gap-2 transition-all cursor-pointer">
                    <FolderOpen size={18} strokeWidth={2.5} /><span>Open Folder</span>
                  </button>
                  <button onClick={() => setIsSettingsOpen(true)} className="px-4 py-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover-strong)] text-[var(--text-primary)] rounded-md font-medium text-sm flex items-center gap-2 transition-all cursor-pointer" title="Instance Settings">
                    <Settings size={19} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>

        <div className="flex-1 overflow-hidden px-8">
          <div className="max-w-7xl mx-auto flex flex-col h-full">

            {/* Section tabs */}
            <div className="flex-shrink-0 flex gap-1 mb-4">
              <button onClick={() => setDetailSection("mods")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${detailSection === "mods" ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"}`}>
                Mods
              </button>
              <button onClick={() => setDetailSection("worlds")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${detailSection === "worlds" ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"}`}>
                Worlds
              </button>
              <button onClick={() => setDetailSection("resourcepacks")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${detailSection === "resourcepacks" ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"}`}>
                Resource Packs
              </button>
              <button onClick={() => setDetailSection("shaderpacks")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${detailSection === "shaderpacks" ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"}`}>
                Shader Packs
              </button>
            </div>

            {detailSection === "mods" ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">Installed Mods</h2>
                      <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-xs rounded">{installedMods.length} mod{installedMods.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(instance.loader === "fabric" || instance.loader === "neoforge") && modsWithProjectId > 0 && (
                        availableUpdates.length > 0 ? (
                          <button onClick={updateAllMods} disabled={isUpdatingMods} className="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium transition-colors cursor-pointer">
                            {isUpdatingMods ? <><Loader2 size={14} className="animate-spin" /><span>Updating...</span></> : <><RefreshCw size={14} /><span>Update All ({availableUpdates.length})</span></>}
                          </button>
                        ) : (
                          <button onClick={checkForUpdates} disabled={isCheckingUpdates} className="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover-strong)] disabled:opacity-50 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded text-xs transition-colors cursor-pointer">
                            {isCheckingUpdates ? <><Loader2 size={14} className="animate-spin" /><span>Checking...</span></> : <><RefreshCw size={14} /><span>Check for Updates</span></>}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="relative mb-3">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                    <input type="text" value={modSearchQuery} onChange={(e) => setModSearchQuery(e.target.value)} placeholder="Search mods..." className="w-full bg-[var(--bg-tertiary)] rounded-md pl-8 pr-8 py-1.5 text-sm text-[var(--text-muted)] placeholder-[var(--text-muted)] focus:outline-none transition-colors" />
                    {modSearchQuery && <button onClick={() => setModSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-muted)] transition-colors cursor-pointer"><X size={14} /></button>}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                  {isLoadingMods ? (
                    <div className="text-center py-16"><Loader2 size={32} className="animate-spin text-[#16a34a] mx-auto" /></div>
                  ) : installedMods.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Package size={48} className="text-[#16a34a] mb-3" strokeWidth={1.5} />
                      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">No mods installed</h3>
                      <p className="text-sm text-[var(--text-muted)]">Browse the mods tab to add mods</p>
                    </div>
                  ) : filteredMods.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Search size={32} className="text-[var(--text-muted)] mb-3" strokeWidth={1.5} />
                      <p className="text-sm text-[var(--text-muted)]">No mods match your search</p>
                    </div>
                  ) : (
                    <div className="space-y-3 pr-1">
                      {filteredMods.map((mod) => {
                        const hasUpdate = availableUpdates.some(u => u.filename === mod.filename)

                        return (
                          <div key={mod.filename} className={`bg-[var(--bg-tertiary)] rounded-md overflow-hidden transition-all ${mod.disabled ? 'opacity-60' : ''}`}>
                            <div className="flex min-h-0">
                              {mod.icon_url ? (
                                <div className="w-22 bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0 self-stretch">
                                  <img src={mod.icon_url} alt={mod.name || mod.filename} className={`w-full h-full object-contain ${mod.disabled ? 'grayscale' : ''}`} />
                                </div>
                              ) : (
                                <div className="w-22 flex items-center justify-center flex-shrink-0 self-stretch">
                                  <Package size={36} className="text-[var(--text-muted)]" strokeWidth={2} />
                                </div>
                              )}
                              <div className="flex-1 min-w-0 py-2 px-4 flex items-center gap-3 relative z-0">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-base text-[var(--text-primary)] truncate">{mod.name || mod.filename}</h3>
                                    {hasUpdate && <button onClick={() => { const u = availableUpdates.find(up => up.filename === mod.filename); if (u) updateSingleMod(u) }} className="px-1.5 py-0.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs rounded font-medium transition-colors cursor-pointer">Update</button>}
                                  </div>
                                  <p className="text-sm text-[var(--text-muted)] truncate">{mod.filename}{mod.disabled && !mod.filename.endsWith('.disabled') ? '.disabled' : ''}</p>
                                  <p className="text-sm text-[var(--text-muted)] mt-0.5">{formatFileSize(mod.size)}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <button onClick={() => handleToggleMod(mod)} className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${mod.disabled ? 'bg-[var(--bg-hover-strong)] border-[var(--text-muted)]' : 'bg-[#16a34a] border-[#16a34a]'}`}>
                                    <svg width="16" height="16" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M10 3L4.5 8.5L2 6" stroke={mod.disabled ? '#7d8590' : '#0f1115'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </button>
                                  <button onClick={() => handleDeleteMod(mod.filename)} className="p-1 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 rounded transition-all cursor-pointer">
                                    <Trash2 size={20} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : detailSection === "worlds" ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">Worlds</h2>
                      <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-xs rounded">{worlds.length} world{worlds.length === 1 ? '' : 's'}</span>
                    </div>
                    <button onClick={handleOpenWorldsFolder} className="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover-strong)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded text-xs transition-colors cursor-pointer">
                      <ExternalLink size={14} /><span>Open Folder</span>
                    </button>
                  </div>

                  <div className="relative mb-3">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                    <input type="text" value={worldSearchQuery} onChange={(e) => setWorldSearchQuery(e.target.value)} placeholder="Search worlds..." className="w-full bg-[var(--bg-tertiary)] rounded-md pl-8 pr-8 py-1.5 text-sm text-[var(--text-muted)] placeholder-[var(--text-muted)] focus:outline-none transition-colors" />
                    {worldSearchQuery && <button onClick={() => setWorldSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-muted)] transition-colors cursor-pointer"><X size={14} /></button>}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                  {isLoadingWorlds ? (
                    <div className="text-center py-16"><Loader2 size={32} className="animate-spin text-[#16a34a] mx-auto" /></div>
                  ) : worlds.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Globe size={48} className="text-[#16a34a] mb-3" strokeWidth={1.5} />
                      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">No worlds yet</h3>
                      <p className="text-sm text-[var(--text-muted)]">Launch the game to create a world</p>
                    </div>
                  ) : filteredWorlds.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Search size={32} className="text-[var(--text-muted)] mb-3" strokeWidth={1.5} />
                      <p className="text-sm text-[var(--text-muted)]">No worlds match your search</p>
                    </div>
                  ) : (
                    <div className="space-y-3 pr-1">
                      {filteredWorlds.map((world) => (
                        <div key={world.folder_name} className="bg-[var(--bg-tertiary)] rounded-md overflow-hidden transition-all">
                          <div className="flex min-h-0">
                            {world.icon ? (
                              <div className="w-22 bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0 self-stretch">
                                <img src={world.icon} alt={world.name} className="w-full h-full object-contain" />
                              </div>
                            ) : (
                              <div className="w-22 flex items-center justify-center flex-shrink-0 self-stretch">
                                <Globe size={32} className="text-[var(--text-muted)]" strokeWidth={1.5} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 py-2 px-4 flex items-center gap-3 relative z-0">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-base text-[var(--text-primary)] truncate">{world.name}</h3>
                                <p className="text-xs text-[var(--text-muted)] mt-0.5">Created {formatDate(world.created)}</p>
                                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mt-0.5">
                                  <span>{formatFileSize(world.size)}</span>
                                  {world.game_mode && <><span>•</span><span className="capitalize">{world.game_mode}</span></>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleLaunchWorld(world.folder_name)} disabled={!isAuthenticated || isLaunching || isRunning || launchingWorld !== null} className={`p-2.5 rounded-md transition-all cursor-pointer ${isLaunching || launchingWorld === world.folder_name ? "bg-red-500/10 text-red-400" : "bg-[#16a34a] hover:bg-[#15803d] text-[#181a1f]"} disabled:opacity-40 disabled:cursor-not-allowed`} title="Play this world">
                                  {isLaunching || launchingWorld === world.folder_name ? <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <Play size={20} fill="currentColor" strokeWidth={0} />}
                                </button>
                                <button onClick={() => handleOpenWorldFolder(world.folder_name)} className="p-2.5 hover:bg-[var(--bg-hover-strong)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-md transition-all cursor-pointer" title="Open world folder"><FolderOpen size={20} /></button>
                                <button onClick={() => handleDeleteWorld(world.folder_name, world.name)} className="p-2.5 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 rounded-md transition-all cursor-pointer" title="Delete world"><Trash2 size={20} /></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : detailSection === "resourcepacks" ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">Resource Packs</h2>
                      <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-xs rounded">{resourcePacks.length} pack{resourcePacks.length === 1 ? '' : 's'}</span>
                    </div>
                    <button onClick={handleOpenResourcePacksFolder} className="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover-strong)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded text-xs transition-colors cursor-pointer">
                      <ExternalLink size={14} /><span>Open Folder</span>
                    </button>
                  </div>
                  <div className="relative mb-3">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                    <input type="text" value={resourcePackSearchQuery} onChange={(e) => setResourcePackSearchQuery(e.target.value)} placeholder="Search resource packs..." className="w-full bg-[var(--bg-tertiary)] rounded-md pl-8 pr-8 py-1.5 text-sm text-[var(--text-muted)] placeholder-[var(--text-muted)] focus:outline-none transition-colors" />
                    {resourcePackSearchQuery && <button onClick={() => setResourcePackSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-muted)] transition-colors cursor-pointer"><X size={14} /></button>}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0">
                  {isLoadingResourcePacks ? (
                    <div className="text-center py-16"><Loader2 size={32} className="animate-spin text-[#16a34a] mx-auto" /></div>
                  ) : resourcePacks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Image size={48} className="text-[#f97316] mb-3" strokeWidth={1.5} />
                      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">No resource packs</h3>
                      <p className="text-sm text-[var(--text-muted)]">Browse the addons tab to add resource packs</p>
                    </div>
                  ) : filteredResourcePacks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Search size={32} className="text-[var(--text-muted)] mb-3" strokeWidth={1.5} />
                      <p className="text-sm text-[var(--text-muted)]">No resource packs match your search</p>
                    </div>
                  ) : (
                    <div className="space-y-3 pr-1">
                      {filteredResourcePacks.map((pack) => (
                        <div key={pack.filename} className="bg-[var(--bg-tertiary)] rounded-md overflow-hidden transition-all">
                          <div className="flex min-h-0">
                            {pack.icon_url ? (
                              <div className="w-22 bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0 self-stretch">
                                <img src={pack.icon_url} alt={pack.name || pack.filename} className="w-full h-full object-contain" />
                              </div>
                            ) : (
                              <div className="w-22 flex items-center justify-center flex-shrink-0 self-stretch">
                                <Image size={36} className="text-[#f97316]" strokeWidth={1.5} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 py-2 px-4 flex items-center gap-3 relative z-0">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-base text-[var(--text-primary)] truncate">{pack.name || pack.filename}</h3>
                                <p className="text-sm text-[var(--text-muted)] truncate">{pack.filename}</p>
                                <p className="text-sm text-[var(--text-muted)] mt-0.5">{formatFileSize(pack.size)}</p>
                              </div>
                              <div className="flex flex-col items-center gap-1 self-center">
                                <button onClick={() => handleDeleteResourcePack(pack.filename)} className="p-1.5 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 rounded-md transition-all cursor-pointer">
                                  <Trash2 size={20} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">Shader Packs</h2>
                      <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-xs rounded">{shaderPacks.length} pack{shaderPacks.length === 1 ? '' : 's'}</span>
                    </div>
                    <button onClick={handleOpenShaderPacksFolder} className="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover-strong)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded text-xs transition-colors cursor-pointer">
                      <ExternalLink size={14} /><span>Open Folder</span>
                    </button>
                  </div>
                  <div className="relative mb-3">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                    <input type="text" value={shaderPackSearchQuery} onChange={(e) => setShaderPackSearchQuery(e.target.value)} placeholder="Search shader packs..." className="w-full bg-[var(--bg-tertiary)] rounded-md pl-8 pr-8 py-1.5 text-sm text-[var(--text-muted)] placeholder-[var(--text-muted)] focus:outline-none transition-colors" />
                    {shaderPackSearchQuery && <button onClick={() => setShaderPackSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-muted)] transition-colors cursor-pointer"><X size={14} /></button>}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0">
                  {isLoadingShaderPacks ? (
                    <div className="text-center py-16"><Loader2 size={32} className="animate-spin text-[#16a34a] mx-auto" /></div>
                  ) : shaderPacks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Palette size={48} className="text-[#8b5cf6] mb-3" strokeWidth={1.5} />
                      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">No shader packs</h3>
                      <p className="text-sm text-[var(--text-muted)]">Browse the addons tab to add shader packs</p>
                    </div>
                  ) : filteredShaderPacks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Search size={32} className="text-[var(--text-muted)] mb-3" strokeWidth={1.5} />
                      <p className="text-sm text-[var(--text-muted)]">No shader packs match your search</p>
                    </div>
                  ) : (
                    <div className="space-y-3 pr-1">
                      {filteredShaderPacks.map((pack) => (
                        <div key={pack.filename} className="bg-[var(--bg-tertiary)] rounded-md overflow-hidden transition-all">
                          <div className="flex min-h-0">
                            {pack.icon_url ? (
                              <div className="w-22 bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0 self-stretch">
                                <img src={pack.icon_url} alt={pack.name || pack.filename} className="w-full h-full object-contain" />
                              </div>
                            ) : (
                              <div className="w-22 flex items-center justify-center flex-shrink-0 self-stretch">
                                <Palette size={36} className="text-[#8b5cf6]" strokeWidth={1.5} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 py-2 px-4 flex items-center gap-3 relative z-0">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-base text-[var(--text-primary)] truncate">{pack.name || pack.filename}</h3>
                                <p className="text-sm text-[var(--text-muted)] truncate">{pack.filename}</p>
                                <p className="text-sm text-[var(--text-muted)] mt-0.5">{formatFileSize(pack.size)}</p>
                              </div>
                              <div className="flex flex-col items-center gap-1 self-center">
                                <button onClick={() => handleDeleteShaderPack(pack.filename)} className="p-1.5 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 rounded-md transition-all cursor-pointer">
                                  <Trash2 size={20} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <InstanceSettingsModal isOpen={isSettingsOpen} instance={instance} instanceIcon={instanceIcon} onClose={() => setIsSettingsOpen(false)} onInstanceUpdated={handleInstanceUpdated} onInstanceDeleted={handleInstanceDeleted} onInstanceRenamed={onInstanceRenamed} />

      {confirmModal && (
        <ConfirmModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} type={confirmModal.type} confirmText={confirmModal.type === "danger" ? "Delete" : "Confirm"} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(null)} />
      )}

      {alertModal && (
        <AlertModal isOpen={alertModal.isOpen} title={alertModal.title} message={alertModal.message} type={alertModal.type} onClose={() => setAlertModal(null)} />
      )}
    </>
  )
}