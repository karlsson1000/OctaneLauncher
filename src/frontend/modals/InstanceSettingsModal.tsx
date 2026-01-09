import { useState, useRef, useEffect } from "react"
import { X, Trash2, Camera, ImagePlus, Loader2, Settings } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { ConfirmModal, AlertModal } from "./ConfirmModal"
import type { Instance, FabricVersion } from "../../types"

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

  useEffect(() => {
    if (isOpen) {
      setLocalIcon(instanceIcon)
      setNewName(instance.name)
      setSelectedFabricVersion(instance.loader_version || "")
      
      if (isFabricInstance && fabricVersions.length === 0) {
        loadFabricVersions()
      }
    }
  }, [isOpen, instanceIcon, instance.name, instance.loader_version, isFabricInstance])

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
        `}</style>
        <div 
          className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop ${isClosing ? 'closing' : ''}`}
          onClick={handleClose}
        >
          <div 
            className={`bg-[#141414] border border-[#2a2a2a] rounded-md w-full max-w-md shadow-2xl modal-content ${isClosing ? 'closing' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
          <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
            <div className="flex items-center gap-3">
              <Settings size={32} className="text-[#4572e3]" strokeWidth={1.5} />
              <div>
                <h2 className="text-base font-semibold text-[#e6edf3] tracking-tight">Instance Settings</h2>
                <p className="text-xs text-[#7d8590] mt-0.5">Manage your instance configuration</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-[#1a1a1a] rounded transition-colors text-[#7d8590] hover:text-[#e6edf3] cursor-pointer"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#7d8590] mb-2">Instance Icon</label>
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
                      className="w-20 h-20 rounded-md overflow-hidden relative cursor-pointer bg-transparent border border-[#2a2a2a]"
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
                    className="w-20 h-20 border-2 border-dashed border-[#2a2a2a] hover:border-[#238636]/50 rounded-md flex items-center justify-center transition-all bg-[#0f0f0f] cursor-pointer"
                  >
                    {isUploadingIcon ? (
                      <Loader2 size={28} className="text-[#238636] animate-spin" />
                    ) : (
                      <ImagePlus size={28} className="text-[#3a3a3a] group-hover:text-[#238636] transition-colors" />
                    )}
                  </button>
                )}
                
                <div className="flex-1 flex flex-col gap-2 h-20">
                  <button
                    onClick={handleIconClick}
                    disabled={isUploadingIcon}
                    className="flex-1 w-full px-4 bg-[#1a1a1a] hover:bg-[#1f1f1f] border border-[#2a2a2a] text-[#e6edf3] rounded-md text-sm font-medium transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {localIcon ? "Change Icon" : "Upload Icon"}
                  </button>
                  {localIcon && (
                    <button
                      onClick={handleRemoveIcon}
                      disabled={isUploadingIcon}
                      className="flex-1 w-full px-4 bg-[#1a1a1a] hover:bg-red-500/10 border border-[#2a2a2a] text-[#7d8590] hover:text-red-400 rounded-md text-sm font-medium transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Remove Icon
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#7d8590] mb-2">Instance Name</label>
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
                  className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-md px-3 py-2.5 pr-10 text-sm text-[#e6edf3] placeholder-[#3a3a3a] focus:outline-none focus:ring-1 focus:ring-[#238636] transition-colors"
                  placeholder="Enter instance name"
                  disabled={isRenamingInstance}
                />
                {isRenamingInstance && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Loader2 size={14} className="animate-spin text-[#238636]" />
                  </div>
                )}
              </div>
              {renameError && (
                <p className="text-xs text-red-400 mt-2">{renameError}</p>
              )}
            </div>

            {isFabricInstance && (
              <div>
                <label className="block text-xs font-medium text-[#7d8590] mb-2">Fabric Loader Version</label>
                {isLoadingFabric ? (
                  <div className="flex items-center gap-2 text-[#7d8590] text-xs py-2 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-md">
                    <Loader2 size={14} className="animate-spin text-[#3b82f6]" />
                    <span>Loading versions...</span>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <select
                        value={selectedFabricVersion}
                        onChange={(e) => {
                          const newVersion = e.target.value
                          setSelectedFabricVersion(newVersion)
                          handleUpdateFabricLoader(newVersion)
                        }}
                        className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-md px-3 py-2.5 pr-10 text-sm text-[#e6edf3] focus:outline-none focus:ring-1 focus:ring-[#3b82f6] transition-colors appearance-none cursor-pointer"
                        disabled={isUpdatingFabric}
                      >
                        {fabricVersions.map((version) => (
                          <option key={version.version} value={version.version}>
                            {version.version} {version.stable ? "(Stable)" : ""}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        {isUpdatingFabric ? (
                          <Loader2 size={14} className="animate-spin text-[#3b82f6]" />
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7d8590" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-[#2a2a2a]">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
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