import { useState, useRef, useEffect } from "react"
import { X, Trash2, Camera, ImagePlus, Loader2, Check, Cpu } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { ConfirmModal, AlertModal } from "../../components/ui/ConfirmModal"
import type { Instance, FabricVersion, NeoForgeVersion, ForgeVersion, LauncherSettings } from "../../types"

interface SystemInfo {
  total_memory_mb: number
  available_memory_mb: number
  recommended_max_memory_mb: number
}

interface InstanceSettingsModalProps {
  isOpen: boolean
  instance: Instance
  instanceIcon: string | null
  onClose: () => void
  onInstanceUpdated: () => void
  onInstanceDeleted: () => void
  onInstanceRenamed?: (oldName: string, newName: string) => void
}

export function InstanceSettingsModal(props: InstanceSettingsModalProps) {
  if (!props.isOpen) return null
  return <InnerModal {...props} />
}

function InnerModal({
  instance,
  instanceIcon,
  onClose,
  onInstanceUpdated,
  onInstanceDeleted,
  onInstanceRenamed,
}: InstanceSettingsModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [newName, setNewName] = useState(instance.name)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [isRenamingInstance, setIsRenamingInstance] = useState(false)
  const [isUploadingIcon, setIsUploadingIcon] = useState(false)
  const [localIcon, setLocalIcon] = useState<string | null>(instanceIcon)
  const [isClosing, setIsClosing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isFabricInstance = instance.loader === "fabric"
  const isNeoforgeInstance = instance.loader === "neoforge"
  const isForgeInstance = instance.loader === "forge"

  const getMinecraftVersion = (versionString: string): string => {
    if (isFabricInstance) {
      const parts = versionString.split('-')
      return parts[parts.length - 1]
    }
    if (isNeoforgeInstance) {
      const versionPart = versionString.replace('neoforge-', '')
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
    if (isForgeInstance) {
      return versionString.split('-forge-')[0] || versionString
    }
    return versionString
  }

  const [fabricVersions, setFabricVersions] = useState<FabricVersion[]>([])
  const [selectedFabricVersion, setSelectedFabricVersion] = useState<string>(instance.loader_version || "")
  const [isLoadingFabric, setIsLoadingFabric] = useState(false)
  const [isUpdatingFabric, setIsUpdatingFabric] = useState(false)

  const [neoforgeVersions, setNeoforgeVersions] = useState<NeoForgeVersion[]>([])
  const [selectedNeoforgeVersion, setSelectedNeoforgeVersion] = useState<string>(instance.loader_version || "")
  const [isLoadingNeoforge, setIsLoadingNeoforge] = useState(false)
  const [isUpdatingNeoforge, setIsUpdatingNeoforge] = useState(false)

  const [forgeVersions, setForgeVersions] = useState<ForgeVersion[]>([])
  const [selectedForgeVersion, setSelectedForgeVersion] = useState<string>(instance.loader_version || "")
  const [isLoadingForge, setIsLoadingForge] = useState(false)
  const [isUpdatingForge, setIsUpdatingForge] = useState(false)

  const [minecraftVersions, setMinecraftVersions] = useState<string[]>([])
  const [selectedMinecraftVersion, setSelectedMinecraftVersion] = useState<string>(
    getMinecraftVersion(instance.version)
  )
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [isUpdatingVersion, setIsUpdatingVersion] = useState(false)
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false)
  const [isFabricDropdownOpen, setIsFabricDropdownOpen] = useState(false)
  const [isNeoforgeDropdownOpen, setIsNeoforgeDropdownOpen] = useState(false)
  const [isForgeDropdownOpen, setIsForgeDropdownOpen] = useState(false)
  const versionDropdownRef = useRef<HTMLDivElement>(null)
  const fabricDropdownRef = useRef<HTMLDivElement>(null)
  const neoforgeDropdownRef = useRef<HTMLDivElement>(null)
  const forgeDropdownRef = useRef<HTMLDivElement>(null)

  const [useCustomRam, setUseCustomRam] = useState(false)
  const [instanceMemoryMb, setInstanceMemoryMb] = useState(2048)
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)

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
    loadMinecraftVersions()
    loadInstanceRamSettings()
    loadSystemInfo()
    if (isFabricInstance) loadFabricVersions()
    if (isNeoforgeInstance) loadNeoforgeVersions()
    if (isForgeInstance) loadForgeVersions()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (versionDropdownRef.current && !versionDropdownRef.current.contains(event.target as Node)) setIsVersionDropdownOpen(false)
      if (fabricDropdownRef.current && !fabricDropdownRef.current.contains(event.target as Node)) setIsFabricDropdownOpen(false)
      if (neoforgeDropdownRef.current && !neoforgeDropdownRef.current.contains(event.target as Node)) setIsNeoforgeDropdownOpen(false)
      if (forgeDropdownRef.current && !forgeDropdownRef.current.contains(event.target as Node)) setIsForgeDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadInstanceRamSettings = async () => {
    try {
      const settings = await invoke<LauncherSettings | null>("get_instance_settings", { instanceName: instance.name })
      if (settings?.memory_mb) {
        setUseCustomRam(true)
        setInstanceMemoryMb(settings.memory_mb)
      } else {
        setUseCustomRam(false)
        setInstanceMemoryMb(2048)
      }
    } catch (error) {
      console.error("Failed to load instance RAM settings:", error)
      setUseCustomRam(false)
      setInstanceMemoryMb(2048)
    }
  }

  const loadSystemInfo = async () => {
    try {
      const info = await invoke<SystemInfo>("get_system_info")
      setSystemInfo(info)
    } catch (error) {
      console.error("Failed to load system info:", error)
    }
  }

  const handleSaveRam = async (memoryMb: number, enabled: boolean) => {
    try {
      if (enabled) {
        const currentSettings = await invoke<LauncherSettings | null>("get_instance_settings", { instanceName: instance.name })
        const newSettings: LauncherSettings = {
          memory_mb: memoryMb,
          java_path: currentSettings?.java_path ?? null,
          language: currentSettings?.language,
          auto_navigate_to_console: currentSettings?.auto_navigate_to_console ?? true,
        }
        await invoke("save_instance_settings", { instanceName: instance.name, settings: newSettings })
      } else {
        await invoke("save_instance_settings", { instanceName: instance.name, settings: null })
      }
      onInstanceUpdated()
    } catch (error) {
      console.error("Failed to save RAM settings:", error)
      setAlertModal({ isOpen: true, title: "An error occurred", message: `Failed to save RAM settings: ${String(error)}`, type: "danger" })
    }
  }

  const loadMinecraftVersions = async () => {
    setIsLoadingVersions(true)
    try {
      const versions = await invoke<string[]>("get_minecraft_versions_by_type", { versionType: "release" })
      setMinecraftVersions(versions)
    } catch (error) {
      console.error("Failed to load Minecraft versions:", error)
      setAlertModal({ isOpen: true, title: "An error occurred", message: `Failed to load Minecraft versions: ${String(error)}`, type: "danger" })
    } finally {
      setIsLoadingVersions(false)
    }
  }

  const loadFabricVersions = async () => {
    setIsLoadingFabric(true)
    try {
      const versions = await invoke<FabricVersion[]>("get_fabric_versions")
      setFabricVersions(versions)
    } catch (error) {
      console.error("Failed to load Fabric versions:", error)
      setAlertModal({ isOpen: true, title: "An error occurred", message: `Failed to load Fabric versions: ${String(error)}`, type: "danger" })
    } finally {
      setIsLoadingFabric(false)
    }
  }

  const handleVersionSelect = (newVersion: string) => {
    if (!newVersion || newVersion === getMinecraftVersion(instance.version)) {
      setIsVersionDropdownOpen(false)
      return
    }
    setSelectedMinecraftVersion(newVersion)
    setIsVersionDropdownOpen(false)

    setConfirmModal({
      isOpen: true,
      title: "Update Minecraft Version",
      message: `Are you sure you want to update this instance to Minecraft ${newVersion}?\n\nThis will download the new version and update the instance. Your worlds and settings will be preserved.`,
      type: "warning",
      onConfirm: async () => {
        setConfirmModal(null)
        setIsUpdatingVersion(true)
        try {
          await invoke("update_instance_minecraft_version", { instanceName: instance.name, newMinecraftVersion: newVersion })
          onInstanceUpdated()
        } catch (error) {
          console.error("Failed to update Minecraft version:", error)
          setAlertModal({ isOpen: true, title: "An error occurred", message: `Failed to update Minecraft version: ${String(error)}`, type: "danger" })
          setSelectedMinecraftVersion(getMinecraftVersion(instance.version))
        } finally {
          setIsUpdatingVersion(false)
        }
      }
    })
  }

  const handleFabricSelect = async (newVersion: string) => {
    if (!newVersion || newVersion === instance.loader_version) {
      setIsFabricDropdownOpen(false)
      return
    }
    setSelectedFabricVersion(newVersion)
    setIsFabricDropdownOpen(false)
    setIsUpdatingFabric(true)
    try {
      await invoke("update_instance_fabric_loader", { instanceName: instance.name, fabricVersion: newVersion })
      onInstanceUpdated()
    } catch (error) {
      console.error("Failed to update Fabric loader:", error)
      setAlertModal({ isOpen: true, title: "An error occurred", message: `Failed to update Fabric loader: ${String(error)}`, type: "danger" })
      setSelectedFabricVersion(instance.loader_version || "")
    } finally {
      setIsUpdatingFabric(false)
    }
  }

  const loadNeoforgeVersions = async () => {
    setIsLoadingNeoforge(true)
    try {
      const versions = await invoke<NeoForgeVersion[]>("get_neoforge_versions")
      setNeoforgeVersions(versions)
    } catch (error) {
      console.error("Failed to load NeoForge versions:", error)
      setAlertModal({ isOpen: true, title: "An error occurred", message: `Failed to load NeoForge versions: ${String(error)}`, type: "danger" })
    } finally {
      setIsLoadingNeoforge(false)
    }
  }

  const handleNeoforgeSelect = async (newVersion: string) => {
    if (!newVersion || newVersion === instance.loader_version) {
      setIsNeoforgeDropdownOpen(false)
      return
    }
    setSelectedNeoforgeVersion(newVersion)
    setIsNeoforgeDropdownOpen(false)
    setIsUpdatingNeoforge(true)
    try {
      await invoke("update_instance_neoforge_loader", { instanceName: instance.name, neoforgeVersion: newVersion })
      onInstanceUpdated()
    } catch (error) {
      console.error("Failed to update NeoForge loader:", error)
      setAlertModal({ isOpen: true, title: "An error occurred", message: `Failed to update NeoForge loader: ${String(error)}`, type: "danger" })
      setSelectedNeoforgeVersion(instance.loader_version || "")
    } finally {
      setIsUpdatingNeoforge(false)
    }
  }

  const loadForgeVersions = async () => {
    setIsLoadingForge(true)
    try {
      const versions = await invoke<ForgeVersion[]>("get_forge_versions")
      setForgeVersions(versions)
    } catch (error) {
      console.error("Failed to load Forge versions:", error)
      setAlertModal({ isOpen: true, title: "An error occurred", message: `Failed to load Forge versions: ${String(error)}`, type: "danger" })
    } finally {
      setIsLoadingForge(false)
    }
  }

  const handleForgeSelect = async (newVersion: string) => {
    if (!newVersion || newVersion === instance.loader_version) {
      setIsForgeDropdownOpen(false)
      return
    }
    setSelectedForgeVersion(newVersion)
    setIsForgeDropdownOpen(false)
    setIsUpdatingForge(true)
    try {
      await invoke("update_instance_forge_loader", { instanceName: instance.name, forgeFullVersion: newVersion })
      onInstanceUpdated()
    } catch (error) {
      console.error("Failed to update Forge loader:", error)
      setAlertModal({ isOpen: true, title: "An error occurred", message: `Failed to update Forge loader: ${String(error)}`, type: "danger" })
      setSelectedForgeVersion(instance.loader_version || "")
    } finally {
      setIsUpdatingForge(false)
    }
  }

  const handleIconClick = () => fileInputRef.current?.click()

  const handleIconChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setAlertModal({ isOpen: true, title: "Invalid File", message: "Please select an image file (PNG, JPEG, or WebP)", type: "danger" })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setAlertModal({ isOpen: true, title: "File Too Large", message: "Image must be smaller than 5MB", type: "danger" })
      return
    }

    setIsUploadingIcon(true)

    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]
        
        try {
          await invoke("set_instance_icon", { instanceName: instance.name, imageData: base64 })
          const newIcon = await invoke<string | null>("get_instance_icon", { instanceName: instance.name })
          setLocalIcon(newIcon)
          onInstanceUpdated()
        } catch (error) {
          console.error("Failed to set icon:", error)
          setAlertModal({ isOpen: true, title: "An error occurred", message: `Failed to set icon: ${String(error)}`, type: "danger" })
        } finally {
          setIsUploadingIcon(false)
        }
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error("Failed to read file:", error)
      setIsUploadingIcon(false)
    }

    if (event.target) event.target.value = ''
  }

  const handleRemoveIcon = () => {
    setConfirmModal({
      isOpen: true,
      title: "Remove Icon",
      message: "Are you sure you want to remove this instance icon?",
      type: "warning",
      onConfirm: async () => {
        setConfirmModal(null)
        try {
          await invoke("remove_instance_icon", { instanceName: instance.name })
          setLocalIcon(null)
          onInstanceUpdated()
        } catch (error) {
          console.error("Failed to remove icon:", error)
          setAlertModal({ isOpen: true, title: "An error occurred", message: `Failed to remove icon: ${String(error)}`, type: "danger" })
        }
      }
    })
  }

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => { setIsClosing(false); onClose() }, 150)
  }

  const handleRename = async (trimmedName: string) => {
    if (!trimmedName) { setRenameError("Instance name cannot be empty"); return }
    if (trimmedName === instance.name) { setRenameError(null); return }
    setIsRenamingInstance(true)
    try {
      await invoke("rename_instance", { oldName: instance.name, newName: trimmedName })
      setRenameError(null)
      onInstanceRenamed?.(instance.name, trimmedName)
      onClose()
    } catch (error) {
      setRenameError(error as string)
      setNewName(instance.name)
    } finally {
      setIsRenamingInstance(false)
    }
  }

  const handleDelete = () => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Instance",
      message: `Are you sure you want to delete "${instance.name}"?\n\nThis action cannot be undone.`,
      type: "danger",
      onConfirm: async () => {
        setIsDeleting(true)
        setConfirmModal(null)
        try {
          await invoke("delete_instance", { instanceName: instance.name })
          onInstanceDeleted()
          onClose()
        } catch (error) {
          console.error("Failed to delete instance:", error)
          setAlertModal({ isOpen: true, title: "An error occurred", message: `Failed to delete instance: ${String(error)}`, type: "danger" })
        } finally {
          setIsDeleting(false)
        }
      }
    })
  }

  const minMem = 1024
  const maxMem = systemInfo?.total_memory_mb || 32768
  const ramPercent = ((instanceMemoryMb - minMem) / (maxMem - minMem)) * 100

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop ${isClosing ? 'closing' : ''}`}
        onClick={handleClose}
      >
        <div
          className={`blur-border bg-[var(--bg-secondary)] rounded w-full max-w-2xl shadow-2xl modal-content ${isClosing ? 'closing' : ''}`}
          onClick={(e) => e.stopPropagation()}
          style={{ pointerEvents: 'auto' }}
        >
          <div className="flex items-center justify-between px-6 pt-6 pb-5">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Instance Settings</h2>
            <button onClick={handleClose} className="p-1.5 hover:bg-[var(--bg-hover-strong)] rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="px-6 pb-6">
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">

              {/* Icon */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Instance Icon</label>
                <div className="flex items-center gap-4">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleIconChange} className="hidden" />
                  {localIcon ? (
                    <button onClick={handleIconClick} disabled={isUploadingIcon} className="w-12 h-12 flex-shrink-0 rounded overflow-hidden relative cursor-pointer group bg-[var(--bg-tertiary)]">
                      <img src={localIcon} alt={instance.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera size={16} className="text-[var(--text-muted)]" />
                      </div>
                    </button>
                  ) : (
                    <button onClick={handleIconClick} disabled={isUploadingIcon} className="w-12 h-12 flex-shrink-0 border-2 border-dashed border-[var(--text-muted)] hover:border-[var(--accent-primary)]/50 rounded flex items-center justify-center transition-all bg-[var(--bg-tertiary)] cursor-pointer">
                      {isUploadingIcon ? <Loader2 size={18} className="text-[var(--accent-primary)] animate-spin" /> : <ImagePlus size={18} className="text-[var(--text-muted)]" />}
                    </button>
                  )}
                  
                  {localIcon ? (
                    <button onClick={handleRemoveIcon} disabled={isUploadingIcon} className="px-4 py-3.5 bg-[var(--bg-tertiary)] hover:bg-red-500/10 text-[var(--text-primary)] hover:text-red-400 rounded text-sm font-medium transition-all disabled:opacity-50 cursor-pointer">
                      Remove Icon
                    </button>
                  ) : (
                    <button onClick={handleIconClick} disabled={isUploadingIcon} className="px-4 py-3.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover-strong)] text-[var(--text-primary)] rounded text-sm font-medium transition-all disabled:opacity-50 cursor-pointer">
                      Upload Icon
                    </button>
                  )}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Instance Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => { setNewName(e.target.value); setRenameError(null) }}
                    onBlur={(e) => { const trimmed = e.target.value.trim(); if (trimmed && trimmed !== instance.name) handleRename(trimmed) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    className="w-full bg-[var(--bg-tertiary)] rounded px-4 py-3.5 pr-10 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none transition-all"
                    placeholder="Enter instance name"
                    disabled={isRenamingInstance}
                  />
                  {isRenamingInstance && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Loader2 size={14} className="animate-spin text-[var(--accent-primary)]" />
                    </div>
                  )}
                </div>
                {renameError && <p className="text-xs text-red-400 mt-2">{renameError}</p>}
              </div>

              {/* Minecraft Version */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Minecraft Version</label>
                {isLoadingVersions ? (
                  <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm py-3.5 px-4 bg-[var(--bg-tertiary)] rounded">
                    <Loader2 size={16} className="animate-spin text-[var(--accent-primary)]" />
                    <span>Loading...</span>
                  </div>
                ) : (
                  <div className="relative" ref={versionDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
                      className={`w-full bg-[var(--bg-tertiary)] px-4 py-3.5 pr-10 text-sm text-[var(--text-primary)] focus:outline-none transition-all text-left cursor-pointer ${isVersionDropdownOpen ? 'rounded-t' : 'rounded'}`}
                      disabled={isUpdatingVersion}
                    >
                      {selectedMinecraftVersion}
                    </button>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      {isUpdatingVersion
                        ? <Loader2 size={16} className="animate-spin text-[var(--accent-primary)]" />
                        : isVersionDropdownOpen
                          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                      }
                    </div>
                    {isVersionDropdownOpen && (
                      <div className="absolute z-10 w-full bg-[var(--bg-tertiary)] rounded-b shadow-lg max-h-60 overflow-y-auto custom-scrollbar border-t border-[var(--bg-elevated)]">
                        {minecraftVersions.map((version) => (
                          <button
                            key={version}
                            type="button"
                            onClick={() => handleVersionSelect(version)}
                            className="w-full px-4 py-3 text-sm text-left hover:bg-[var(--bg-hover-strong)] transition-colors flex items-center justify-between cursor-pointer text-[var(--text-primary)]"
                          >
                            <span>{version}</span>
                            {selectedMinecraftVersion === version && <Check size={16} className="text-[var(--text-primary)]" strokeWidth={2} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Loader version (Fabric / NeoForge / Forge) */}
              <div>
                {isFabricInstance && (
                  <>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Fabric Loader Version</label>
                    {isLoadingFabric ? (
                      <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm py-3.5 px-4 bg-[var(--bg-tertiary)] rounded">
                        <Loader2 size={16} className="animate-spin text-[var(--accent-primary)]" />
                    <span>Loading...</span>
                      </div>
                    ) : (
                      <div className="relative" ref={fabricDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsFabricDropdownOpen(!isFabricDropdownOpen)}
                          className={`w-full bg-[var(--bg-tertiary)] px-4 py-3.5 pr-10 text-sm text-[var(--text-primary)] focus:outline-none transition-all text-left cursor-pointer ${isFabricDropdownOpen ? 'rounded-t' : 'rounded'}`}
                          disabled={isUpdatingFabric}
                        >
                          {selectedFabricVersion} {fabricVersions.find(v => v.version === selectedFabricVersion)?.stable ? "(Stable)" : ""}
                        </button>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          {isUpdatingFabric
                            ? <Loader2 size={16} className="animate-spin text-[var(--accent-primary)]" />
                            : isFabricDropdownOpen
                              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                          }
                        </div>
                        {isFabricDropdownOpen && (
                          <div className="absolute z-10 w-full bg-[var(--bg-tertiary)] rounded-b shadow-lg max-h-60 overflow-y-auto custom-scrollbar border-t border-[var(--bg-elevated)]">
                            {fabricVersions.map((version) => (
                              <button
                                key={version.version}
                                type="button"
                                onClick={() => handleFabricSelect(version.version)}
                                className="w-full px-4 py-3 text-sm text-left hover:bg-[var(--bg-hover-strong)] transition-colors flex items-center justify-between cursor-pointer text-[var(--text-primary)]"
                              >
                                <span>{version.version} {version.stable ? "(Stable)" : ""}</span>
                                {selectedFabricVersion === version.version && <Check size={16} className="text-[var(--text-primary)]" strokeWidth={2} />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
                {isNeoforgeInstance && (
                  <>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2.5">NeoForge Loader Version</label>
                    {isLoadingNeoforge ? (
                      <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm py-3.5 px-4 bg-[var(--bg-tertiary)] rounded">
                        <Loader2 size={16} className="animate-spin text-[var(--accent-primary)]" />
                    <span>Loading...</span>
                      </div>
                    ) : (
                      <div className="relative" ref={neoforgeDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsNeoforgeDropdownOpen(!isNeoforgeDropdownOpen)}
                          className={`w-full bg-[var(--bg-tertiary)] px-4 py-3.5 pr-10 text-sm text-[var(--text-primary)] focus:outline-none transition-all text-left cursor-pointer ${isNeoforgeDropdownOpen ? 'rounded-t' : 'rounded'}`}
                          disabled={isUpdatingNeoforge}
                        >
                          {selectedNeoforgeVersion}
                        </button>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          {isUpdatingNeoforge
                            ? <Loader2 size={16} className="animate-spin text-[var(--accent-primary)]" />
                            : isNeoforgeDropdownOpen
                              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                          }
                        </div>
                        {isNeoforgeDropdownOpen && (
                          <div className="absolute z-10 w-full bg-[var(--bg-tertiary)] rounded-b shadow-lg max-h-60 overflow-y-auto custom-scrollbar border-t border-[var(--bg-elevated)]">
                            {neoforgeVersions.map((version) => (
                              <button
                                key={version.full_version}
                                type="button"
                                onClick={() => handleNeoforgeSelect(version.full_version)}
                                className="w-full px-4 py-3 text-sm text-left hover:bg-[var(--bg-hover-strong)] transition-colors flex items-center justify-between cursor-pointer text-[var(--text-primary)]"
                              >
                                <span>{version.full_version}</span>
                                {selectedNeoforgeVersion === version.full_version && <Check size={16} className="text-[var(--text-primary)]" strokeWidth={2} />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
                {isForgeInstance && (
                  <>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Forge Loader Version</label>
                    {isLoadingForge ? (
                      <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm py-3.5 px-4 bg-[var(--bg-tertiary)] rounded">
                        <Loader2 size={16} className="animate-spin text-[var(--accent-primary)]" />
                    <span>Loading...</span>
                      </div>
                    ) : (
                      <div className="relative" ref={forgeDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsForgeDropdownOpen(!isForgeDropdownOpen)}
                          className={`w-full bg-[var(--bg-tertiary)] px-4 py-3.5 pr-10 text-sm text-[var(--text-primary)] focus:outline-none transition-all text-left cursor-pointer ${isForgeDropdownOpen ? 'rounded-t' : 'rounded'}`}
                          disabled={isUpdatingForge}
                        >
                          {selectedForgeVersion}
                        </button>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          {isUpdatingForge
                            ? <Loader2 size={16} className="animate-spin text-[var(--accent-primary)]" />
                            : isForgeDropdownOpen
                              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                          }
                        </div>
                        {isForgeDropdownOpen && (
                          <div className="absolute z-10 w-full bg-[var(--bg-tertiary)] rounded-b shadow-lg max-h-60 overflow-y-auto custom-scrollbar border-t border-[var(--bg-elevated)]">
                            {forgeVersions.map((version) => (
                              <button
                                key={version.full_version}
                                type="button"
                                onClick={() => handleForgeSelect(version.full_version)}
                                className="w-full px-4 py-3 text-sm text-left hover:bg-[var(--bg-hover-strong)] transition-colors flex items-center justify-between cursor-pointer text-[var(--text-primary)]"
                              >
                                <span>{version.full_version}</span>
                                {selectedForgeVersion === version.full_version && <Check size={16} className="text-[var(--text-primary)]" strokeWidth={2} />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* RAM Allocation */}
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2 text-[var(--text-primary)]">
                    <Cpu size={18} className="text-[var(--accent-primary)]" />
                    <span className="text-sm font-medium">RAM Allocation</span>
                  </div>
                  <button
                    onClick={() => { const next = !useCustomRam; setUseCustomRam(next); handleSaveRam(instanceMemoryMb, next) }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${useCustomRam ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-hover)]'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useCustomRam ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div className={`transition-opacity ${useCustomRam ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <div className="bg-[var(--bg-tertiary)] rounded p-4 space-y-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-[var(--text-primary)]">{(instanceMemoryMb / 1024).toFixed(1)} GB</span>
                      <span className="text-xs text-[var(--text-muted)]">{systemInfo ? `of ${(systemInfo.total_memory_mb / 1024).toFixed(0)} GB total` : ''}</span>
                    </div>
                    <input
                      type="range" min={minMem} max={maxMem} step="512"
                      value={instanceMemoryMb}
                      onChange={(e) => setInstanceMemoryMb(parseInt(e.target.value))}
                      onMouseUp={(e) => { if (useCustomRam) handleSaveRam(parseInt((e.target as HTMLInputElement).value), true) }}
                      onTouchEnd={(e) => { if (useCustomRam) handleSaveRam(parseInt((e.target as HTMLInputElement).value), true) }}
                      className="w-full h-2 bg-[var(--bg-secondary)] rounded-full appearance-none cursor-pointer"
                      style={{ background: `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${ramPercent}%, var(--bg-elevated) ${ramPercent}%, var(--bg-elevated) 100%)` }}
                    />
                  </div>
                </div>
              </div>

              {/* Delete */}
              <div className="col-span-2 pt-3">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isDeleting
                    ? <><Loader2 size={16} className="animate-spin" /><span>Deleting...</span></>
                    : <><Trash2 size={16} /><span>Delete Instance</span></>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          confirmText={confirmModal.type === "danger" ? "Delete" : "Confirm"}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {alertModal && (
        <AlertModal isOpen={alertModal.isOpen} title={alertModal.title} message={alertModal.message} type={alertModal.type} onClose={() => setAlertModal(null)} />
      )}
    </>
  )
}