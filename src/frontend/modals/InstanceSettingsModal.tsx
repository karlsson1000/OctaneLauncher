import { useState, useRef, useEffect } from "react"
import { X, Trash2, Camera, ImagePlus, Loader2, Check } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { ConfirmModal, AlertModal } from "./ConfirmModal"
import type { Instance, FabricVersion, NeoForgeVersion } from "../../types"

interface InstanceSettingsModalProps {
  isOpen: boolean
  instance: Instance
  instanceIcon: string | null
  onClose: () => void
  onInstanceUpdated: () => void
  onInstanceDeleted: () => void
}

export function InstanceSettingsModal({
  isOpen,
  instance,
  instanceIcon,
  onClose,
  onInstanceUpdated,
  onInstanceDeleted,
}: InstanceSettingsModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [newName, setNewName] = useState(instance.name)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [isRenamingInstance, setIsRenamingInstance] = useState(false)
  const [isUploadingIcon, setIsUploadingIcon] = useState(false)
  const [localIcon, setLocalIcon] = useState<string | null>(instanceIcon)
  const [isClosing, setIsClosing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [fabricVersions, setFabricVersions] = useState<FabricVersion[]>([])
  const [selectedFabricVersion, setSelectedFabricVersion] = useState<string>(instance.loader_version || "")
  const [isLoadingFabric, setIsLoadingFabric] = useState(false)
  const [isUpdatingFabric, setIsUpdatingFabric] = useState(false)
  
  const [neoforgeVersions, setNeoforgeVersions] = useState<NeoForgeVersion[]>([])
  const [selectedNeoforgeVersion, setSelectedNeoforgeVersion] = useState<string>(instance.loader_version || "")
  const [isLoadingNeoforge, setIsLoadingNeoforge] = useState(false)
  const [isUpdatingNeoforge, setIsUpdatingNeoforge] = useState(false)
  
  const [minecraftVersions, setMinecraftVersions] = useState<string[]>([])
  const [selectedMinecraftVersion, setSelectedMinecraftVersion] = useState<string>("")
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [isUpdatingVersion, setIsUpdatingVersion] = useState(false)
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false)
  const [isFabricDropdownOpen, setIsFabricDropdownOpen] = useState(false)
  const [isNeoforgeDropdownOpen, setIsNeoforgeDropdownOpen] = useState(false)
  const versionDropdownRef = useRef<HTMLDivElement>(null)
  const fabricDropdownRef = useRef<HTMLDivElement>(null)
  const neoforgeDropdownRef = useRef<HTMLDivElement>(null)
  
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

  const isFabricInstance = instance.loader === "fabric"
  const isNeoforgeInstance = instance.loader === "neoforge"
  
  const getMinecraftVersion = (versionString: string): string => {
    if (isFabricInstance) {
      const parts = versionString.split('-')
      return parts[parts.length - 1]
    }
    if (isNeoforgeInstance) {
      const versionPart = versionString.replace('neoforge-', '')
      const parts = versionPart.split('-')
      if (parts[0].startsWith('1.')) {
        return parts[0]
      }
      
      const versionNumbers = parts[0].split('.')
      if (versionNumbers.length >= 2) {
        const major = versionNumbers[0]
        const minor = versionNumbers[1]
        const patch = versionNumbers[2] || '0'
        const majorNum = parseInt(major)
        if (majorNum >= 20) {
          if (patch === '0') {
            return `1.${major}`
          }
          return `1.${major}.${minor}`
        }
      }
    }
    return versionString
  }

  useEffect(() => {
    if (isOpen) {
      setLocalIcon(instanceIcon)
      setNewName(instance.name)
      setSelectedFabricVersion(instance.loader_version || "")
      setSelectedNeoforgeVersion(instance.loader_version || "")
      setSelectedMinecraftVersion(getMinecraftVersion(instance.version))
      
      if (isFabricInstance && fabricVersions.length === 0) {
        loadFabricVersions()
      }
      
      if (isNeoforgeInstance && neoforgeVersions.length === 0) {
        loadNeoforgeVersions()
      }
      
      if (minecraftVersions.length === 0) {
        loadMinecraftVersions()
      }
    }
  }, [isOpen, instanceIcon, instance.name, instance.loader_version, instance.version, isFabricInstance, isNeoforgeInstance])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (versionDropdownRef.current && !versionDropdownRef.current.contains(event.target as Node)) {
        setIsVersionDropdownOpen(false)
      }
      if (fabricDropdownRef.current && !fabricDropdownRef.current.contains(event.target as Node)) {
        setIsFabricDropdownOpen(false)
      }
      if (neoforgeDropdownRef.current && !neoforgeDropdownRef.current.contains(event.target as Node)) {
        setIsNeoforgeDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadMinecraftVersions = async () => {
    setIsLoadingVersions(true)
    try {
      const versions = await invoke<string[]>("get_minecraft_versions_by_type", {
        versionType: "release"
      })
      setMinecraftVersions(versions)
    } catch (error) {
      console.error("Failed to load Minecraft versions:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to load Minecraft versions: ${error}`,
        type: "danger"
      })
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
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to load Fabric versions: ${error}`,
        type: "danger"
      })
    } finally {
      setIsLoadingFabric(false)
    }
  }

  const loadNeoforgeVersions = async () => {
    setIsLoadingNeoforge(true)
    try {
      const mcVersion = getMinecraftVersion(instance.version)
      const versions = await invoke<NeoForgeVersion[]>("get_neoforge_versions", {
        minecraftVersion: mcVersion
      })
      setNeoforgeVersions(versions)
    } catch (error) {
      console.error("Failed to load NeoForge versions:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to load NeoForge versions: ${error}`,
        type: "danger"
      })
    } finally {
      setIsLoadingNeoforge(false)
    }
  }

  const handleUpdateMinecraftVersion = async (newVersion: string) => {
    if (!newVersion || newVersion === getMinecraftVersion(instance.version)) {
      return
    }

    setConfirmModal({
      isOpen: true,
      title: "Update Minecraft Version",
      message: `Are you sure you want to update this instance to Minecraft ${newVersion}?\n\nThis will download the new version and update the instance. Your worlds and settings will be preserved.`,
      type: "warning",
      onConfirm: async () => {
        setConfirmModal(null)
        setIsUpdatingVersion(true)
        try {
          await invoke("update_instance_minecraft_version", {
            instanceName: instance.name,
            newMinecraftVersion: newVersion
          })
          
          if (isNeoforgeInstance) {
            await loadNeoforgeVersions()
          }
          
          onInstanceUpdated()
        } catch (error) {
          console.error("Failed to update Minecraft version:", error)
          setAlertModal({
            isOpen: true,
            title: "Error",
            message: `Failed to update Minecraft version: ${error}`,
            type: "danger"
          })
          setSelectedMinecraftVersion(getMinecraftVersion(instance.version))
        } finally {
          setIsUpdatingVersion(false)
        }
      }
    })
  }

  const handleUpdateFabricLoader = async (newVersion: string) => {
    if (!newVersion || newVersion === instance.loader_version) {
      return
    }

    setIsUpdatingFabric(true)
    try {
      await invoke("update_instance_fabric_loader", {
        instanceName: instance.name,
        fabricVersion: newVersion
      })
      
      onInstanceUpdated()
    } catch (error) {
      console.error("Failed to update Fabric loader:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to update Fabric loader: ${error}`,
        type: "danger"
      })
      setSelectedFabricVersion(instance.loader_version || "")
    } finally {
      setIsUpdatingFabric(false)
    }
  }

  const handleUpdateNeoforgeLoader = async (newVersion: string) => {
    if (!newVersion || newVersion === instance.loader_version) {
      return
    }

    setIsUpdatingNeoforge(true)
    try {
      await invoke("update_instance_neoforge_loader", {
        instanceName: instance.name,
        neoforgeVersion: newVersion
      })
      
      onInstanceUpdated()
    } catch (error) {
      console.error("Failed to update NeoForge loader:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to update NeoForge loader: ${error}`,
        type: "danger"
      })
      setSelectedNeoforgeVersion(instance.loader_version || "")
    } finally {
      setIsUpdatingNeoforge(false)
    }
  }

  if (!isOpen) return null

  const handleIconClick = () => {
    fileInputRef.current?.click()
  }

  const handleIconChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setAlertModal({
        isOpen: true,
        title: "Invalid File",
        message: "Please select an image file (PNG, JPEG, or WebP)",
        type: "danger"
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setAlertModal({
        isOpen: true,
        title: "File Too Large",
        message: "Image must be smaller than 5MB",
        type: "danger"
      })
      return
    }

    setIsUploadingIcon(true)

    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]
        
        try {
          await invoke("set_instance_icon", {
            instanceName: instance.name,
            imageData: base64
          })
          
          const newIcon = await invoke<string | null>("get_instance_icon", {
            instanceName: instance.name
          })
          setLocalIcon(newIcon)
          onInstanceUpdated()
        } catch (error) {
          console.error("Failed to set icon:", error)
          setAlertModal({
            isOpen: true,
            title: "Error",
            message: `Failed to set icon: ${error}`,
            type: "danger"
          })
        } finally {
          setIsUploadingIcon(false)
        }
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error("Failed to read file:", error)
      setIsUploadingIcon(false)
    }

    if (event.target) {
      event.target.value = ''
    }
  }

  const handleRemoveIcon = async () => {
    setConfirmModal({
      isOpen: true,
      title: "Remove Icon",
      message: "Are you sure you want to remove this instance icon?",
      type: "warning",
      onConfirm: async () => {
        setConfirmModal(null)
        try {
          await invoke("remove_instance_icon", {
            instanceName: instance.name
          })
          setLocalIcon(null)
          onInstanceUpdated()
        } catch (error) {
          console.error("Failed to remove icon:", error)
          setAlertModal({
            isOpen: true,
            title: "Error",
            message: `Failed to remove icon: ${error}`,
            type: "danger"
          })
        }
      }
    })
  }

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 150)
  }

  const handleRename = async (trimmedName: string) => {
    if (!trimmedName) {
      setRenameError("Instance name cannot be empty")
      return
    }

    if (trimmedName === instance.name) {
      setRenameError(null)
      return
    }

    setIsRenamingInstance(true)
    try {
      await invoke("rename_instance", {
        oldName: instance.name,
        newName: trimmedName
      })
      setRenameError(null)
      onInstanceUpdated()
      onClose()
    } catch (error) {
      setRenameError(error as string)
      setNewName(instance.name)
    } finally {
      setIsRenamingInstance(false)
    }
  }

  const handleDelete = async () => {
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
          setAlertModal({
            isOpen: true,
            title: "Error",
            message: `Failed to delete instance: ${error}`,
            type: "danger"
          })
        } finally {
          setIsDeleting(false)
        }
      }
    })
  }

  return (
      <>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
          }
          @keyframes scaleIn {
            from { 
              opacity: 0;
              transform: scale(0.95);
            }
            to { 
              opacity: 1;
              transform: scale(1);
            }
          }
          @keyframes scaleOut {
            from { 
              opacity: 1;
              transform: scale(1);
            }
            to { 
              opacity: 0;
              transform: scale(0.95);
            }
          }
          .modal-backdrop {
            animation: fadeIn 0.15s ease-out forwards;
          }
          .modal-backdrop.closing {
            animation: fadeOut 0.15s ease-in forwards;
          }
          .modal-content {
            animation: scaleIn 0.15s ease-out forwards;
          }
          .modal-content.closing {
            animation: scaleOut 0.15s ease-in forwards;
          }
          
          .blur-border {
            position: relative;
          }

          .blur-border::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            padding: 2px;
            background: linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.08),
              rgba(255, 255, 255, 0.04)
            );
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            pointer-events: none;
            backdrop-filter: blur(8px);
            z-index: 10;
            transition: none !important;
          }
          
          .blur-border:hover::before {
            background: linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.08),
              rgba(255, 255, 255, 0.04)
            );
          }
          
          .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #3a3f4b;
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #454a58;
          }
        `}</style>
        <div 
          className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop ${isClosing ? 'closing' : ''}`}
          onClick={handleClose}
        >
          <div 
            className={`blur-border bg-[#181a1f] rounded w-full max-w-md shadow-2xl modal-content ${isClosing ? 'closing' : ''}`}
            onClick={(e) => e.stopPropagation()}
            style={{ pointerEvents: 'auto' }}
          >
          <div className="flex items-center justify-between px-6 pt-6 pb-5">
            <div>
              <h2 className="text-xl font-semibold text-[#e6e6e6] tracking-tight">Instance Settings</h2>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-[#3a3f4b] rounded transition-colors text-gray-400 hover:text-[#e6e6e6] cursor-pointer"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="px-6 pb-4 space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#e6e6e6] mb-2.5">Instance Icon</label>
              <div className="flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleIconChange}
                  className="hidden"
                />
                
                {localIcon ? (
                  <div className="relative group">
                    <button
                      onClick={handleIconClick}
                      disabled={isUploadingIcon}
                      className="w-20 h-20 rounded overflow-hidden relative cursor-pointer bg-transparent"
                    >
                      <img
                        src={localIcon}
                        alt={instance.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera size={24} className="text-white" />
                      </div>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleIconClick}
                    disabled={isUploadingIcon}
                    className="w-20 h-20 border-2 border-dashed border-[#3a3f4b] hover:border-[#4572e3]/50 rounded flex items-center justify-center transition-all bg-[#22252b] cursor-pointer"
                  >
                    {isUploadingIcon ? (
                      <Loader2 size={28} className="text-[#4572e3] animate-spin" />
                    ) : (
                      <ImagePlus size={28} className="text-[#3a3f4b] group-hover:text-[#4572e3] transition-colors" />
                    )}
                  </button>
                )}
                
                <div className="flex-1 flex flex-col gap-2 h-20">
                  <button
                    onClick={handleIconClick}
                    disabled={isUploadingIcon}
                    className="flex-1 w-full px-4 bg-[#22252b] hover:bg-[#3a3f4b] text-[#e6e6e6] rounded text-sm font-medium transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {localIcon ? "Change Icon" : "Upload Icon"}
                  </button>
                  {localIcon && (
                    <button
                      onClick={handleRemoveIcon}
                      disabled={isUploadingIcon}
                      className="flex-1 w-full px-4 bg-[#22252b] hover:bg-red-500/10 text-[#e6e6e6] hover:text-red-400 rounded text-sm font-medium transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Remove Icon
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#e6e6e6] mb-2.5">Instance Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value)
                    setRenameError(null)
                  }}
                  onBlur={(e) => {
                    const trimmedName = e.target.value.trim()
                    if (trimmedName && trimmedName !== instance.name) {
                      handleRename(trimmedName)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur()
                    }
                  }}
                  className="w-full bg-[#22252b] rounded px-4 py-3.5 pr-10 text-sm text-[#e6e6e6] placeholder-gray-500 focus:outline-none transition-all"
                  placeholder="Enter instance name"
                  disabled={isRenamingInstance}
                />
                {isRenamingInstance && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Loader2 size={14} className="animate-spin text-[#4572e3]" />
                  </div>
                )}
              </div>
              {renameError && (
                <p className="text-xs text-red-400 mt-2">{renameError}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#e6e6e6] mb-2.5">Minecraft Version</label>
              {isLoadingVersions ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-3.5 px-4 bg-[#22252b] rounded">
                  <Loader2 size={16} className="animate-spin text-[#4572e3]" />
                  <span>Loading versions...</span>
                </div>
              ) : (
                <div className="relative" ref={versionDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
                    className={`w-full bg-[#22252b] px-4 py-3.5 pr-10 text-sm text-[#e6e6e6] focus:outline-none transition-all text-left cursor-pointer ${
                      isVersionDropdownOpen ? 'rounded-t' : 'rounded'
                    }`}
                    disabled={isUpdatingVersion}
                  >
                    {selectedMinecraftVersion}
                  </button>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    {isUpdatingVersion ? (
                      <Loader2 size={16} className="animate-spin text-[#4572e3]" />
                    ) : isVersionDropdownOpen ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e6e6e6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="18 15 12 9 6 15"></polyline>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e6e6e6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    )}
                  </div>
                  
                  {isVersionDropdownOpen && (
                    <div className="absolute z-10 w-full bg-[#22252b] rounded-b shadow-lg max-h-60 overflow-y-auto custom-scrollbar border-t border-[#181a1f]">
                      {minecraftVersions.map((version) => (
                        <button
                          key={version}
                          type="button"
                          onClick={() => {
                            setSelectedMinecraftVersion(version)
                            setIsVersionDropdownOpen(false)
                            handleUpdateMinecraftVersion(version)
                          }}
                          className="w-full px-4 py-3 text-sm text-left hover:bg-[#3a3f4b] transition-colors flex items-center justify-between cursor-pointer text-[#e6e6e6]"
                        >
                          <span>{version}</span>
                          {selectedMinecraftVersion === version && (
                            <Check size={16} className="text-[#e6e6e6]" strokeWidth={2} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {isFabricInstance && (
              <div>
                <label className="block text-sm font-medium text-[#e6e6e6] mb-2.5">Fabric Loader Version</label>
                {isLoadingFabric ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm py-3.5 px-4 bg-[#22252b] rounded">
                    <Loader2 size={16} className="animate-spin text-[#4572e3]" />
                    <span>Loading versions...</span>
                  </div>
                ) : (
                  <div className="relative" ref={fabricDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsFabricDropdownOpen(!isFabricDropdownOpen)}
                      className={`w-full bg-[#22252b] px-4 py-3.5 pr-10 text-sm text-[#e6e6e6] focus:outline-none transition-all text-left cursor-pointer ${
                        isFabricDropdownOpen ? 'rounded-t' : 'rounded'
                      }`}
                      disabled={isUpdatingFabric}
                    >
                      {selectedFabricVersion} {fabricVersions.find(v => v.version === selectedFabricVersion)?.stable ? "(Stable)" : ""}
                    </button>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      {isUpdatingFabric ? (
                        <Loader2 size={16} className="animate-spin text-[#4572e3]" />
                      ) : isFabricDropdownOpen ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e6e6e6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="18 15 12 9 6 15"></polyline>
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e6e6e6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      )}
                    </div>
                    
                    {isFabricDropdownOpen && (
                      <div className="absolute z-10 w-full bg-[#22252b] rounded-b shadow-lg max-h-60 overflow-y-auto custom-scrollbar border-t border-[#181a1f]">
                        {fabricVersions.map((version) => (
                          <button
                            key={version.version}
                            type="button"
                            onClick={() => {
                              setSelectedFabricVersion(version.version)
                              setIsFabricDropdownOpen(false)
                              handleUpdateFabricLoader(version.version)
                            }}
                            className="w-full px-4 py-3 text-sm text-left hover:bg-[#3a3f4b] transition-colors flex items-center justify-between cursor-pointer text-[#e6e6e6]"
                          >
                            <span>{version.version} {version.stable ? "(Stable)" : ""}</span>
                            {selectedFabricVersion === version.version && (
                              <Check size={16} className="text-[#e6e6e6]" strokeWidth={2} />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {isNeoforgeInstance && false && (
              <div>
                <label className="block text-sm font-medium text-[#e6e6e6] mb-2.5">NeoForge Loader Version</label>
                {isLoadingNeoforge ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm py-3.5 px-4 bg-[#22252b] rounded">
                    <Loader2 size={16} className="animate-spin text-[#4572e3]" />
                    <span>Loading versions...</span>
                  </div>
                ) : (
                  <div className="relative" ref={neoforgeDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsNeoforgeDropdownOpen(!isNeoforgeDropdownOpen)}
                      className={`w-full bg-[#22252b] px-4 py-3.5 pr-10 text-sm text-[#e6e6e6] focus:outline-none transition-all text-left cursor-pointer ${
                        isNeoforgeDropdownOpen ? 'rounded-t' : 'rounded'
                      }`}
                      disabled={isUpdatingNeoforge}
                    >
                      {selectedNeoforgeVersion}
                    </button>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      {isUpdatingNeoforge ? (
                        <Loader2 size={16} className="animate-spin text-[#4572e3]" />
                      ) : isNeoforgeDropdownOpen ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e6e6e6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="18 15 12 9 6 15"></polyline>
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e6e6e6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      )}
                    </div>
                    
                    {isNeoforgeDropdownOpen && (
                      <div className="absolute z-10 w-full bg-[#22252b] rounded-b shadow-lg max-h-60 overflow-y-auto custom-scrollbar border-t border-[#181a1f]">
                        {neoforgeVersions.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-[#7d8590]">
                            No versions available
                          </div>
                        ) : (
                          neoforgeVersions.map((version) => (
                            <button
                              key={version.version}
                              type="button"
                              onClick={() => {
                                setSelectedNeoforgeVersion(version.version)
                                setIsNeoforgeDropdownOpen(false)
                                handleUpdateNeoforgeLoader(version.version)
                              }}
                              className="w-full px-4 py-3 text-sm text-left hover:bg-[#3a3f4b] transition-colors flex items-center justify-between cursor-pointer text-[#e6e6e6]"
                            >
                              <span>{version.version}</span>
                              {selectedNeoforgeVersion === version.version && (
                                <Check size={16} className="text-[#e6e6e6]" strokeWidth={2} />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-[#3a3f4b]">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete Instance</span>
                  </>
                )}
              </button>
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
        <AlertModal
          isOpen={alertModal.isOpen}
          title={alertModal.title}
          message={alertModal.message}
          type={alertModal.type}
          onClose={() => setAlertModal(null)}
        />
      )}
    </>
  )
}