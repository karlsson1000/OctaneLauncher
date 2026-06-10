import { useState, useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { open } from '@tauri-apps/plugin-dialog'
import { X, Loader2, AlertCircle, FileDown, Check } from "lucide-react"
import { AlertModal } from "../../components/ui/ConfirmModal"
import type { FabricVersion, NeoForgeVersion, Instance } from "../../types"

interface MinecraftVersion {
  id: string
  type: "release" | "snapshot"
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
  const [loaderType, setLoaderType] = useState<"vanilla" | "fabric" | "neoforge">("vanilla")
  const [fabricVersions, setFabricVersions] = useState<FabricVersion[]>([])
  const [selectedFabricVersion, setSelectedFabricVersion] = useState<string>("")
  const [neoforgeVersions, setNeoforgeVersions] = useState<NeoForgeVersion[]>([])
  const [selectedNeoforgeVersion, setSelectedNeoforgeVersion] = useState<string>("")
  const [isLoadingFabric, setIsLoadingFabric] = useState(false)
  const [isLoadingNeoforge, setIsLoadingNeoforge] = useState(false)
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
  const [neoforgeSupportedVersions, setNeoforgeSupportedVersions] = useState<string[]>([])
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false)
  const [isFabricDropdownOpen, setIsFabricDropdownOpen] = useState(false)
  const [isNeoforgeDropdownOpen, setIsNeoforgeDropdownOpen] = useState(false)
  const versionDropdownRef = useRef<HTMLDivElement>(null)
  const fabricDropdownRef = useRef<HTMLDivElement>(null)
  const neoforgeDropdownRef = useRef<HTMLDivElement>(null)

  const instanceExists = instances.some(
    instance => instance.name.toLowerCase() === newInstanceName.trim().toLowerCase()
  )

  // Initial data load
  useEffect(() => {
    loadVersionsWithMetadata()
    loadFabricSupportedVersions()
    loadNeoforgeSupportedVersions()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (versionDropdownRef.current && !versionDropdownRef.current.contains(event.target as Node)) setIsVersionDropdownOpen(false)
      if (fabricDropdownRef.current && !fabricDropdownRef.current.contains(event.target as Node)) setIsFabricDropdownOpen(false)
      if (neoforgeDropdownRef.current && !neoforgeDropdownRef.current.contains(event.target as Node)) setIsNeoforgeDropdownOpen(false)
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
      if (firstRelease) setSelectedVersion(firstRelease.id)
    } catch (error) {
      console.error("Failed to load versions:", error)
      setAlertModal({ isOpen: true, title: "An error occurred", message: "Failed to load versions" + `: ${error}`, type: "danger" })
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

  const loadNeoforgeSupportedVersions = async () => {
    try {
      const supported = await invoke<string[]>("get_neoforge_supported_game_versions")
      setNeoforgeSupportedVersions(supported)
    } catch (error) {
      console.error("Failed to load NeoForge supported versions:", error)
    }
  }

  const getFilteredVersions = (): MinecraftVersion[] => {
    let filtered = versionFilter === "snapshot"
      ? allVersions.filter(v => v.type === "snapshot")
      : allVersions.filter(v => v.type === "release")

    if (loaderType === "fabric" && versionFilter === "release") {
      filtered = filtered.filter(v => fabricSupportedVersions.includes(v.id))
    }
    if (loaderType === "neoforge" && versionFilter === "release") {
      filtered = filtered.filter(v => neoforgeSupportedVersions.includes(v.id))
    }

    return filtered
  }

  const filteredVersions = getFilteredVersions()

  const loadFabricVersions = async () => {
    setIsLoadingFabric(true)
    try {
      const versions = await invoke<FabricVersion[]>("get_fabric_versions")
      setFabricVersions(versions)
      const stableVersion = versions.find(v => v.stable)
      if (stableVersion) setSelectedFabricVersion(stableVersion.version)
      else if (versions.length > 0) setSelectedFabricVersion(versions[0].version)
    } catch (error) {
      console.error("Failed to load Fabric versions:", error)
      setAlertModal({ isOpen: true, title: "An error occurred", message: "Failed to load Fabric versions" + `: ${error}`, type: "danger" })
    } finally {
      setIsLoadingFabric(false)
    }
  }

  const loadNeoforgeVersions = async (forVersion: string) => {
    setIsLoadingNeoforge(true)
    try {
      const versions = await invoke<NeoForgeVersion[]>("get_neoforge_versions")
      const filtered = versions.filter(v => v.minecraft_version === forVersion)
      setNeoforgeVersions(filtered)
      if (filtered.length > 0) setSelectedNeoforgeVersion(filtered[0].neoforge_version)
    } catch (error) {
      console.error("Failed to load NeoForge versions:", error)
      setAlertModal({ isOpen: true, title: "An error occurred", message: "Failed to load NeoForge versions" + `: ${error}`, type: "danger" })
    } finally {
      setIsLoadingNeoforge(false)
    }
  }

  const handleLoaderChange = (newLoader: "vanilla" | "fabric" | "neoforge") => {
    setLoaderType(newLoader)

    if (newLoader === "fabric") {
      // Snapshots not supported by fabric
      if (versionFilter === "snapshot") setVersionFilter("release")

      // If current version is unsupported, jump to first supported release
      const currentIsUnsupported = !fabricSupportedVersions.includes(selectedVersion)
        || allVersions.find(v => v.id === selectedVersion)?.type === "snapshot"
      if (currentIsUnsupported && fabricSupportedVersions.length > 0 && allVersions.length > 0) {
        const firstSupported = allVersions.find(v =>
          v.type === "release" &&
          fabricSupportedVersions.includes(v.id)
        )
        if (firstSupported) setSelectedVersion(firstSupported.id)
      }

      if (fabricVersions.length === 0) loadFabricVersions()
    }

    if (newLoader === "neoforge") {
      if (versionFilter === "snapshot") setVersionFilter("release")

      const currentIsUnsupported = !neoforgeSupportedVersions.includes(selectedVersion)
        || allVersions.find(v => v.id === selectedVersion)?.type === "snapshot"
      if (currentIsUnsupported && neoforgeSupportedVersions.length > 0 && allVersions.length > 0) {
        const firstSupported = allVersions.find(v =>
          v.type === "release" &&
          neoforgeSupportedVersions.includes(v.id)
        )
        if (firstSupported) {
          setSelectedVersion(firstSupported.id)
          loadNeoforgeVersions(firstSupported.id)
        }
      } else {
        loadNeoforgeVersions(selectedVersion)
      }
    }
  }

  const handleVersionSelect = (versionId: string) => {
    setSelectedVersion(versionId)
    setIsVersionDropdownOpen(false)
    if (loaderType === "neoforge") {
      loadNeoforgeVersions(versionId)
    }
  }

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => { setIsClosing(false); onClose() }, 150)
  }

  const handleImportFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Instance Files", extensions: ['mrpack', 'zip'] }]
      })

      if (!selected) return

      const filePath = selected as string
      
      handleClose()

      let extractedName = ""
      try {
        extractedName = await invoke<string>("get_modpack_name_from_file", { filePath })
      } catch {
        extractedName = filePath.split(/[/\\]/).pop()?.replace(/\.(mrpack|zip)$/, '') || "Imported Instance"
      }

      let finalName = extractedName
      let counter = 1
      while (instances.some(i => i.name.toLowerCase() === finalName.toLowerCase())) {
        finalName = `${extractedName} (${counter++})`
      }

      setIsCreating(true)
      onStartCreating(finalName)
      await invoke("install_modpack_from_file", { filePath, instanceName: finalName, preferredGameVersion: null })
      onSuccess()
    } catch (error) {
      console.error("Import error:", error)
      setAlertModal({ isOpen: true, title: "An error occurred", message: "Failed to import instance" + `: ${error}`, type: "danger" })
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
        loaderVersion: loaderType === "fabric" ? selectedFabricVersion
          : loaderType === "neoforge" ? selectedNeoforgeVersion
          : null,
      })

      onSuccess()
    } catch (error) {
      console.error("Create instance error:", error)
      setAlertModal({ isOpen: true, title: "An error occurred", message: "Failed to create instance" + `: ${error}`, type: "danger" })
    } finally {
      setIsCreating(false)
    }
  }

  const handleVersionFilterChange = (filter: "release" | "snapshot") => {
    setVersionFilter(filter)
    const available = (filter === "snapshot"
      ? allVersions.filter(v => v.type === "snapshot")
      : allVersions.filter(v => v.type === "release")
    ).filter(v => {
      if (loaderType === "fabric" && filter === "release") return fabricSupportedVersions.includes(v.id)
      if (loaderType === "neoforge" && filter === "release") return neoforgeSupportedVersions.includes(v.id)
      return true
    })

    if (available.length > 0) {
      setSelectedVersion(available[0].id)
      if (loaderType === "neoforge") loadNeoforgeVersions(available[0].id)
    }
  }

  const isCreateDisabled = isCreating
    || !newInstanceName.trim()
    || instanceExists
    || (loaderType === "fabric" && !selectedFabricVersion)
    || (loaderType === "neoforge" && !selectedNeoforgeVersion)
    || isLoadingVersions
    || filteredVersions.length === 0

  return (
    <>
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
            <h2 className="text-xl font-semibold text-[#e6e6e6] tracking-tight">New Instance</h2>
            <button onClick={handleClose} className="p-1.5 hover:bg-[#3a3f4b] rounded transition-colors text-gray-400 hover:text-[#e6e6e6] cursor-pointer">
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="px-6 pb-4 space-y-5">
            <div className="flex">
              <button type="button" onClick={handleImportFile} disabled={isCreating} className="w-full px-4 py-3 rounded text-sm font-medium transition-all cursor-pointer bg-[#22252b] hover:bg-[#3a3f4b] text-gray-300">
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
                className={`w-full bg-[#22252b] rounded px-4 py-3.5 text-sm text-[#e6e6e6] placeholder-gray-500 focus:outline-none transition-all ${instanceExists && newInstanceName.trim() ? 'ring-2 ring-red-500' : ''}`}
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
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-sm font-medium text-[#e6e6e6]">Minecraft Version</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleVersionFilterChange("release")}
                    disabled={isCreating}
                    className={`text-xs font-medium transition-colors cursor-pointer ${versionFilter === "release" ? "text-[#e6e6e6]" : "text-gray-500 hover:text-gray-400"}`}
                  >
                    Releases
                  </button>
                  <span className="text-gray-600">|</span>
                  <button
                    type="button"
                    onClick={() => handleVersionFilterChange("snapshot")}
                    disabled={isCreating || loaderType === "fabric" || loaderType === "neoforge"}
                    className={`text-xs font-medium transition-colors ${loaderType === "fabric" || loaderType === "neoforge" ? "text-gray-600 cursor-not-allowed" : versionFilter === "snapshot" ? "text-[#e6e6e6] cursor-pointer" : "text-gray-500 hover:text-gray-400 cursor-pointer"}`}
                  >
                    Snapshots
                  </button>
                </div>
              </div>
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
                    className={`w-full bg-[#22252b] px-4 py-3.5 pr-10 text-sm text-[#e6e6e6] focus:outline-none transition-all text-left cursor-pointer ${isVersionDropdownOpen ? 'rounded-t' : 'rounded'}`}
                    disabled={isCreating}
                  >
                    {selectedVersion}
                  </button>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    {isVersionDropdownOpen
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e6e6e6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e6e6e6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                    }
                  </div>
                  
                  {isVersionDropdownOpen && (
                    <div className="absolute z-10 w-full bg-[#22252b] rounded-b shadow-lg max-h-60 overflow-y-auto custom-scrollbar border-t border-[#181a1f]">
                      {filteredVersions.map((version) => (
                        <button
                          key={version.id}
                          type="button"
                          onClick={() => handleVersionSelect(version.id)}
                          className="w-full px-4 py-3 text-sm text-left hover:bg-[#3a3f4b] transition-colors flex items-center justify-between cursor-pointer text-[#e6e6e6]"
                        >
                          <span>{version.id}</span>
                          {selectedVersion === version.id && <Check size={16} className="text-[#e6e6e6]" strokeWidth={2} />}
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
                {(["vanilla", "fabric", "neoforge"] as const).map((loader) => {
                  const colors: Record<string, string> = { vanilla: "bg-[#16a34a]", fabric: "bg-[#3b82f6]", neoforge: "bg-[#f97316]" }
                  const labels: Record<string, string> = { vanilla: "Vanilla", fabric: "Fabric", neoforge: "NeoForge" }
                  const isActive = loaderType === loader
                  return (
                    <button
                      key={loader}
                      type="button"
                      onClick={() => handleLoaderChange(loader)}
                      disabled={isCreating}
                      className={`flex-1 px-4 py-3 rounded text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 ${isActive ? `${colors[loader]} text-white` : "bg-[#22252b] text-gray-400 hover:bg-[#3a3f4b]"}`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isActive ? "border-white" : "border-gray-500"}`}>
                        {isActive && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <span>{labels[loader]}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {loaderType === "fabric" && (
              <div>
                <label className="block text-sm font-medium text-[#e6e6e6] mb-2.5">Fabric Loader Version</label>
                {isLoadingFabric ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm py-3.5 px-4 bg-[#22252b] rounded">
                    <Loader2 size={16} className="animate-spin text-[#3b82f6]" />
                    <span>Loading versions...</span>
                  </div>
                ) : (
                  <div className="relative" ref={fabricDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsFabricDropdownOpen(!isFabricDropdownOpen)}
                      className={`w-full bg-[#22252b] px-4 py-3.5 pr-10 text-sm text-[#e6e6e6] focus:outline-none transition-all text-left cursor-pointer ${isFabricDropdownOpen ? 'rounded-t' : 'rounded'}`}
                      disabled={isCreating}
                    >
                      {selectedFabricVersion} {fabricVersions.find(v => v.version === selectedFabricVersion)?.stable ? "(Stable)" : ""}
                    </button>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      {isFabricDropdownOpen
                        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e6e6e6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e6e6e6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                      }
                    </div>
                    
                    {isFabricDropdownOpen && (
                      <div className="absolute z-10 w-full bg-[#22252b] rounded-b shadow-lg max-h-60 overflow-y-auto custom-scrollbar border-t border-[#181a1f]">
                        {fabricVersions.map((version) => (
                          <button
                            key={version.version}
                            type="button"
                            onClick={() => { setSelectedFabricVersion(version.version); setIsFabricDropdownOpen(false) }}
                            className="w-full px-4 py-3 text-sm text-left hover:bg-[#3a3f4b] transition-colors flex items-center justify-between cursor-pointer text-[#e6e6e6]"
                          >
                            <span>{version.version} {version.stable ? "(Stable)" : ""}</span>
                            {selectedFabricVersion === version.version && <Check size={16} className="text-[#e6e6e6]" strokeWidth={2} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {loaderType === "neoforge" && (
              <div>
                <label className="block text-sm font-medium text-[#e6e6e6] mb-2.5">NeoForge Version</label>
                {isLoadingNeoforge ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm py-3.5 px-4 bg-[#22252b] rounded">
                    <Loader2 size={16} className="animate-spin text-[#f97316]" />
                    <span>Loading NeoForge versions...</span>
                  </div>
                ) : neoforgeVersions.length === 0 ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm py-3.5 px-4 bg-[#22252b] rounded">
                    <AlertCircle size={16} />
                    <span>No NeoForge versions available for Minecraft {selectedVersion}</span>
                  </div>
                ) : (
                  <div className="relative" ref={neoforgeDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsNeoforgeDropdownOpen(!isNeoforgeDropdownOpen)}
                      className={`w-full bg-[#22252b] px-4 py-3.5 pr-10 text-sm text-[#e6e6e6] focus:outline-none transition-all text-left cursor-pointer ${isNeoforgeDropdownOpen ? 'rounded-t' : 'rounded'}`}
                      disabled={isCreating}
                    >
                      {selectedNeoforgeVersion}
                    </button>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      {isNeoforgeDropdownOpen
                        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e6e6e6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e6e6e6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                      }
                    </div>
                    
                    {isNeoforgeDropdownOpen && (
                      <div className="absolute z-10 w-full bg-[#22252b] rounded-b shadow-lg max-h-60 overflow-y-auto custom-scrollbar border-t border-[#181a1f]">
                        {neoforgeVersions.map((version) => (
                          <button
                            key={version.neoforge_version}
                            type="button"
                            onClick={() => { setSelectedNeoforgeVersion(version.neoforge_version); setIsNeoforgeDropdownOpen(false) }}
                            className="w-full px-4 py-3 text-sm text-left hover:bg-[#3a3f4b] transition-colors flex items-center justify-between cursor-pointer text-[#e6e6e6]"
                          >
                            <span>{version.neoforge_version}</span>
                            {selectedNeoforgeVersion === version.neoforge_version && <Check size={16} className="text-[#e6e6e6]" strokeWidth={2} />}
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
            <button onClick={handleClose} disabled={isCreating} className="px-5 py-3 bg-[#22252b] hover:bg-[#3a3f4b] text-[#e6e6e6] rounded font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
              Cancel
            </button>
            <button onClick={handleCreateInstance} disabled={isCreateDisabled} className="px-5 py-3 bg-[#4572e3] hover:bg-[#3461d1] text-white rounded font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              {isCreating ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Creating...</span></>
              ) : (
                <span>Create Instance</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {alertModal && (
        <AlertModal isOpen={alertModal.isOpen} title={alertModal.title} message={alertModal.message} type={alertModal.type} onClose={() => setAlertModal(null)} />
      )}
    </>
  )
}