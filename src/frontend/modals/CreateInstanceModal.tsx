import { useState, useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { open } from '@tauri-apps/plugin-dialog'
import { X, Loader2, Package, AlertCircle, FileDown, Check } from "lucide-react"
import { AlertModal } from "./ConfirmModal"
import type { FabricVersion, Instance } from "../../types"

interface MinecraftVersion {
  id: string
  type: "release" | "snapshot" | "old_beta" | "old_alpha"
  url: string
  time: string
  releaseTime: string
}

interface CreateInstanceModalProps {
  versions: string[]
  instances: Instance[]
  onClose: () => void
  onSuccess: () => void
  onStartCreating: (instanceName: string) => void
}

export function CreateInstanceModal({ versions, instances, onClose, onSuccess, onStartCreating }: CreateInstanceModalProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState(versions[0] || "1.21.11")
  const [newInstanceName, setNewInstanceName] = useState("")
  const [loaderType, setLoaderType] = useState<"vanilla" | "fabric">("vanilla")
  const [fabricVersions, setFabricVersions] = useState<FabricVersion[]>([])
  const [selectedFabricVersion, setSelectedFabricVersion] = useState<string>("")
  const [isLoadingFabric, setIsLoadingFabric] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null>(null)

  const [versionFilter, setVersionFilter] = useState<"release" | "snapshot">("release")
  const [allVersions, setAllVersions] = useState<MinecraftVersion[]>([])
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [fabricSupportedVersions, setFabricSupportedVersions] = useState<string[]>([])
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false)
  const [isFabricDropdownOpen, setIsFabricDropdownOpen] = useState(false)
  const versionDropdownRef = useRef<HTMLDivElement>(null)
  const fabricDropdownRef = useRef<HTMLDivElement>(null)

  const instanceExists = instances.some(
    instance => instance.name.toLowerCase() === newInstanceName.trim().toLowerCase()
  )

  useEffect(() => {
    loadVersionsWithMetadata()
    loadFabricSupportedVersions()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (versionDropdownRef.current && !versionDropdownRef.current.contains(event.target as Node)) {
        setIsVersionDropdownOpen(false)
      }
      if (fabricDropdownRef.current && !fabricDropdownRef.current.contains(event.target as Node)) {
        setIsFabricDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadVersionsWithMetadata = async () => {
    setIsLoadingVersions(true)
    try {
      const versionsData = await invoke<MinecraftVersion[]>("get_minecraft_versions_with_metadata")
      setAllVersions(versionsData)
      
      const firstRelease = versionsData.find(v => v.type === "release")
      if (firstRelease) {
        setSelectedVersion(firstRelease.id)
      }
    } catch (error) {
      console.error("Failed to load versions:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to load versions: ${error}`,
        type: "danger"
      })
    } finally {
      setIsLoadingVersions(false)
    }
  }

  const loadFabricSupportedVersions = async () => {
    try {
      const supported = await invoke<string[]>("get_supported_game_versions")
      setFabricSupportedVersions(supported)
    } catch (error) {
      console.error("Failed to load Fabric supported versions:", error)
    }
  }

  const getFilteredVersions = () => {
    let filtered: MinecraftVersion[]
    
    if (versionFilter === "snapshot") {
      filtered = allVersions.filter(v => v.type === "snapshot")
    } else {
      filtered = allVersions.filter(v => v.type === "release" || v.type === "old_beta" || v.type === "old_alpha")
    }

    if (loaderType === "fabric" && versionFilter === "release") {
      filtered = filtered.filter(v => fabricSupportedVersions.includes(v.id))
    }

    return filtered
  }

  const filteredVersions = getFilteredVersions()

  useEffect(() => {
    if (loaderType === "fabric") {
      if (versionFilter === "snapshot") {
        setVersionFilter("release")
      }
      
      if (!fabricSupportedVersions.includes(selectedVersion)) {
        const firstSupported = allVersions.find(v => 
          (v.type === "release" || v.type === "old_beta" || v.type === "old_alpha") && 
          fabricSupportedVersions.includes(v.id)
        )
        if (firstSupported) {
          setSelectedVersion(firstSupported.id)
        }
      }
      
      if (fabricVersions.length === 0) {
        loadFabricVersions()
      }
    }
  }, [loaderType, fabricSupportedVersions, allVersions, versionFilter])

  const loadFabricVersions = async () => {
    setIsLoadingFabric(true)
    try {
      const versions = await invoke<FabricVersion[]>("get_fabric_versions")
      setFabricVersions(versions)
      const stableVersion = versions.find(v => v.stable)
      if (stableVersion) {
        setSelectedFabricVersion(stableVersion.version)
      } else if (versions.length > 0) {
        setSelectedFabricVersion(versions[0].version)
      }
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

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 150)
  }

  const handleImportFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Instance Files',
          extensions: ['mrpack', 'zip']
        }]
      })

      if (!selected) return

      const filePath = selected as string
      
      handleClose()

      let extractedName = ""
      try {
        extractedName = await invoke<string>("get_modpack_name_from_file", {
          filePath: filePath
        })
      } catch (error) {
        console.error("Failed to extract name from file:", error)
        const fileName = filePath.split(/[/\\]/).pop()?.replace(/\.(mrpack|zip)$/, '') || "Imported Instance"
        extractedName = fileName
      }

      let finalName = extractedName
      let counter = 1
      while (instances.some(i => i.name.toLowerCase() === finalName.toLowerCase())) {
        finalName = `${extractedName} (${counter})`
        counter++
      }

      setIsCreating(true)
      onStartCreating(finalName)

      await invoke("install_modpack_from_file", {
        filePath: filePath,
        instanceName: finalName,
        preferredGameVersion: null,
      })

      onSuccess()
    } catch (error) {
      console.error("Import error:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to import instance: ${error}`,
        type: "danger"
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim() || instanceExists) return

    setIsCreating(true)
    const finalName = newInstanceName.trim()

    onStartCreating(finalName)
    handleClose()
    
    try {
      await invoke<string>("create_instance", {
        instanceName: finalName,
        version: selectedVersion,
        loader: loaderType === "vanilla" ? null : loaderType,
        loaderVersion: loaderType === "fabric" ? selectedFabricVersion : null,
      })

      onSuccess()
    } catch (error) {
      console.error("Create instance error:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to create instance: ${error}`,
        type: "danger"
      })
    } finally {
      setIsCreating(false)
    }
  }

  const isCreateDisabled = isCreating || 
    !newInstanceName.trim() || 
    instanceExists ||
    (loaderType === "fabric" && !selectedFabricVersion) ||
    isLoadingVersions ||
    filteredVersions.length === 0

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
              <h2 className="text-xl font-semibold text-[#e6e6e6] tracking-tight">New Instance</h2>
            </div>
            <button 
              onClick={handleClose} 
              className="p-1.5 hover:bg-[#3a3f4b] rounded transition-colors text-gray-400 hover:text-[#e6e6e6] cursor-pointer"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="px-6 pb-4 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {}}
                disabled={isCreating}
                className="px-4 py-3 rounded text-sm font-medium transition-all cursor-pointer bg-[#4572e3] hover:bg-[#3461d1] text-white"
              >
                <div className="flex items-center justify-center gap-2">
                  <Package size={18} className="text-white" strokeWidth={2} />
                  <span>Custom</span>
                </div>
              </button>
              <button
                type="button"
                onClick={handleImportFile}
                disabled={isCreating}
                className="px-4 py-3 rounded text-sm font-medium transition-all cursor-pointer bg-[#22252b] hover:bg-[#3a3f4b] text-gray-300"
              >
                <div className="flex items-center justify-center gap-2">
                  <FileDown size={18} className="text-gray-400" strokeWidth={2} />
                  <span>Import File</span>
                </div>
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#e6e6e6] mb-2.5">Instance Name</label>
              <input
                type="text"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                placeholder="My Minecraft Instance"
                className={`w-full bg-[#22252b] rounded px-4 py-3.5 text-sm text-[#e6e6e6] placeholder-gray-500 focus:outline-none transition-all ${
                  instanceExists && newInstanceName.trim()
                    ? 'ring-2 ring-red-500'
                    : ''
                }`}
                disabled={isCreating}
              />
              {instanceExists && newInstanceName.trim() && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400">
                  <AlertCircle size={12} strokeWidth={2} />
                  <span>An instance with this name already exists</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#e6e6e6] mb-2.5">Minecraft Version</label>
              {isLoadingVersions ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-3.5 px-4 bg-[#22252b] rounded">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Loading versions...</span>
                </div>
              ) : filteredVersions.length === 0 ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-3.5 px-4 bg-[#22252b] rounded">
                  <AlertCircle size={16} />
                  <span>No compatible versions available</span>
                </div>
              ) : (
                <div className="relative" ref={versionDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
                    className={`w-full bg-[#22252b] px-4 py-3.5 pr-10 text-sm text-[#e6e6e6] focus:outline-none transition-all text-left cursor-pointer ${
                      isVersionDropdownOpen ? 'rounded-t' : 'rounded'
                    }`}
                    disabled={isCreating}
                  >
                    {selectedVersion}
                  </button>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    {isVersionDropdownOpen ? (
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
                      {filteredVersions.map((version) => (
                        <button
                          key={version.id}
                          type="button"
                          onClick={() => {
                            setSelectedVersion(version.id)
                            setIsVersionDropdownOpen(false)
                          }}
                          className="w-full px-4 py-3 text-sm text-left hover:bg-[#3a3f4b] transition-colors flex items-center justify-between cursor-pointer text-[#e6e6e6]"
                        >
                          <span>{version.id}</span>
                          {selectedVersion === version.id && (
                            <Check size={16} className="text-[#e6e6e6]" strokeWidth={2} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#e6e6e6] mb-2.5">Modloader</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setLoaderType("vanilla")}
                  disabled={isCreating}
                  className={`flex-1 px-4 py-3 rounded text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    loaderType === "vanilla"
                      ? "bg-[#4572e3] text-white"
                      : "bg-[#22252b] text-gray-400 hover:bg-[#3a3f4b]"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    loaderType === "vanilla" ? "border-white" : "border-gray-500"
                  }`}>
                    {loaderType === "vanilla" && (
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </div>
                  <span>Vanilla</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLoaderType("fabric")}
                  disabled={isCreating}
                  className={`flex-1 px-4 py-3 rounded text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    loaderType === "fabric"
                      ? "bg-[#4572e3] text-white"
                      : "bg-[#22252b] text-gray-400 hover:bg-[#3a3f4b]"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    loaderType === "fabric" ? "border-white" : "border-gray-500"
                  }`}>
                    {loaderType === "fabric" && (
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </div>
                  <span>Fabric</span>
                </button>
              </div>
            </div>

            {loaderType === "fabric" && (
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
                      disabled={isCreating}
                    >
                      {selectedFabricVersion} {fabricVersions.find(v => v.version === selectedFabricVersion)?.stable ? "(Stable)" : ""}
                    </button>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      {isFabricDropdownOpen ? (
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
          </div>

          <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-3">
            <button
              onClick={handleClose}
              disabled={isCreating}
              className="px-5 py-3 bg-[#22252b] hover:bg-[#3a3f4b] text-[#e6e6e6] rounded font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateInstance}
              disabled={isCreateDisabled}
              className="px-5 py-3 bg-[#4572e3] hover:bg-[#3461d1] text-white rounded font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Instance</span>
              )}
            </button>
          </div>
        </div>
      </div>

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