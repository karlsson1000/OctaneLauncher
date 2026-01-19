import { useState, useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Search, Download, Loader2, Package, ChevronDown, ChevronLeft, ChevronRight, Check } from "lucide-react"
import type { Instance, ModrinthSearchResult, ModrinthProject, ModrinthVersion } from "../../types"

interface ModFile {
  filename: string
  size: number
}

interface ModsSelectorProps {
  instances: Instance[]
  selectedInstance: Instance | null
  onSetSelectedInstance: (instance: Instance) => void
  scrollContainerRef?: React.RefObject<HTMLDivElement>
}

export function ModsSelector({ instances, selectedInstance, onSetSelectedInstance }: ModsSelectorProps) {
  const [showInstanceSelector, setShowInstanceSelector] = useState(false)
  const instanceSelectorRef = useRef<HTMLDivElement>(null)
  const [instanceIcons, setInstanceIcons] = useState<Record<string, string | null>>({})

  useEffect(() => {
    const loadIcons = async () => {
      const icons: Record<string, string | null> = {}
      for (const instance of instances) {
        try {
          const icon = await invoke<string | null>("get_instance_icon", {
            instanceName: instance.name
          })
          icons[instance.name] = icon
        } catch (error) {
          console.error(`Failed to load icon for ${instance.name}:`, error)
          icons[instance.name] = null
        }
      }
      setInstanceIcons(icons)
    }

    if (instances.length > 0) {
      loadIcons()
    }
  }, [instances])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (instanceSelectorRef.current && !instanceSelectorRef.current.contains(event.target as Node)) {
        setShowInstanceSelector(false)
      }
    }

    if (showInstanceSelector) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showInstanceSelector])

  const getMinecraftVersion = (instance: Instance): string => {
    if (instance.loader === "fabric") {
      const parts = instance.version.split('-')
      return parts[parts.length - 1]
    }
    if (instance.loader === "neoforge") {
      const versionPart = instance.version.replace('neoforge-', '')
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
    return instance.version
  }

  const getLoaderDisplay = (instance: Instance): { name: string; color: string } => {
    if (instance.loader === "fabric") {
      return { name: "Fabric", color: "text-[#3b82f6]" }
    }
    if (instance.loader === "neoforge") {
      return { name: "NeoForge", color: "text-[#f97316]" }
    }
    return { name: "Vanilla", color: "text-[#16a34a]" }
  }

  if (!selectedInstance || (selectedInstance.loader !== "fabric" && selectedInstance.loader !== "neoforge")) {
    return null
  }

  const loaderInfo = getLoaderDisplay(selectedInstance)

  return (
    <div className="relative self-center" ref={instanceSelectorRef}>
      <button
        onClick={() => setShowInstanceSelector(!showInstanceSelector)}
        className="flex items-center gap-2 px-3 py-2 bg-[#22252b] hover:bg-[#2a2f3b] rounded-md text-sm transition-colors cursor-pointer border border-[#3a3f4b]"
      >
        {instanceIcons[selectedInstance.name] ? (
          <img
            src={instanceIcons[selectedInstance.name]!}
            alt={selectedInstance.name}
            className="w-7 h-7 rounded object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
            <Package size={24} className="text-[#7d8590]" strokeWidth={1.5} />
          </div>
        )}
        <div className="text-left min-w-0">
          <div className="font-semibold text-[#e6e6e6] whitespace-nowrap leading-tight">{selectedInstance.name}</div>
          <div className="flex items-center gap-1 text-xs leading-tight mt-0.5">
            <span className="text-[#7d8590]">{getMinecraftVersion(selectedInstance)}</span>
            <span className="text-[#3a3f4b]">•</span>
            <span className={loaderInfo.color}>{loaderInfo.name}</span>
          </div>
        </div>
        <ChevronDown size={16} className={`text-[#7d8590] ml-auto transition-transform ${showInstanceSelector ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>
      {showInstanceSelector && (
        <div className="absolute top-full mt-1 right-0 bg-[#22252b] rounded-md overflow-hidden z-[100] min-w-[240px] max-h-[400px] overflow-y-auto border border-[#3a3f4b]">
          {instances.filter(instance => instance.loader === "fabric" || instance.loader === "neoforge").length === 0 ? (
            <div className="px-3 py-4 text-center bg-[#22252b]">
              <p className="text-sm text-[#7d8590] mb-1">No modded instances</p>
              <p className="text-xs text-[#3a3f4b]">Create a Fabric or NeoForge instance to install mods</p>
            </div>
          ) : (
            instances
              .filter(instance => instance.loader === "fabric" || instance.loader === "neoforge")
              .map((instance) => {
                const icon = instanceIcons[instance.name]
                const loader = getLoaderDisplay(instance)
                return (
                  <button
                    key={instance.name}
                    onClick={() => {
                      onSetSelectedInstance(instance)
                      setShowInstanceSelector(false)
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm cursor-pointer transition-colors ${
                      selectedInstance.name === instance.name
                        ? "bg-[#3b82f6]/10 text-[#e6e6e6]"
                        : "text-[#7d8590] hover:bg-[#2a2f3b]"
                    }`}
                  >
                    {icon ? (
                      <img
                        src={icon}
                        alt={instance.name}
                        className="w-8 h-8 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                        <Package size={24} className="text-[#7d8590]" strokeWidth={1.5} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[#e6e6e6] truncate">{instance.name}</div>
                      <div className="flex items-center gap-1 text-xs">
                        <span>{getMinecraftVersion(instance)}</span>
                        <span>•</span>
                        <span className={loader.color}>{loader.name}</span>
                      </div>
                    </div>
                    {selectedInstance.name === instance.name && (
                      <Check size={16} className="flex-shrink-0" strokeWidth={2} />
                    )}
                  </button>
                )
              })
          )}
        </div>
      )}
    </div>
  )
}

interface ModsTabProps {
  selectedInstance: Instance | null
  instances: Instance[]
  onSetSelectedInstance: (instance: Instance) => void
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
}

export function ModsTab({ selectedInstance, instances, onSetSelectedInstance, scrollContainerRef }: ModsTabProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<ModrinthSearchResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedMod, setSelectedMod] = useState<ModrinthProject | null>(null)
  const [modVersions, setModVersions] = useState<ModrinthVersion[]>([])
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [downloadingMods, setDownloadingMods] = useState<Set<string>>(new Set())
  const [installedModFiles, setInstalledModFiles] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadPopularMods()
  }, [])

  useEffect(() => {
    if (!selectedInstance || (selectedInstance.loader !== "fabric" && selectedInstance.loader !== "neoforge")) {
      const moddedInstances = instances.filter(instance => instance.loader === "fabric" || instance.loader === "neoforge")
      if (moddedInstances.length > 0) {
        onSetSelectedInstance(moddedInstances[0])
      }
    }
  }, [instances, selectedInstance])

  useEffect(() => {
    if (selectedInstance && (selectedInstance.loader === "fabric" || selectedInstance.loader === "neoforge")) {
      loadInstalledMods()
    }
  }, [selectedInstance])

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1)
      handleSearch(1)
    }, 500)
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  const loadInstalledMods = async () => {
    if (!selectedInstance) return
    
    try {
      const mods = await invoke<ModFile[]>("get_installed_mods", {
        instanceName: selectedInstance.name,
      })
      
      const filenames = new Set(mods.map(mod => mod.filename))
      setInstalledModFiles(filenames)
    } catch (error) {
      console.error("Failed to load installed mods:", error)
    }
  }

  const loadPopularMods = async () => {
    setIsSearching(true)
    try {
      const facets = JSON.stringify([["project_type:mod"]])
      const result = await invoke<ModrinthSearchResult>("search_mods", {
        query: "",
        facets,
        index: "downloads",
        offset: 0,
        limit: itemsPerPage,
      })
      setSearchResults(result)
    } catch (error) {
      console.error("Failed to load popular mods:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearch = async (page: number = currentPage) => {
    const query = searchQuery.trim()
    setIsSearching(true)
    try {
      const facets = JSON.stringify([["project_type:mod"]])
      const offset = (page - 1) * itemsPerPage
      const result = await invoke<ModrinthSearchResult>("search_mods", {
        query: query || "",
        facets,
        index: query ? "relevance" : "downloads",
        offset,
        limit: itemsPerPage,
      })
      setSearchResults(result)
      setSelectedMod(null)
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    if (scrollContainerRef?.current) {
      scrollContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
    
    setCurrentPage(newPage)
    setTimeout(() => handleSearch(newPage), 100)
  }

  const getMinecraftVersion = (instance: Instance): string => {
    if (instance.loader === "fabric") {
      const parts = instance.version.split('-')
      return parts[parts.length - 1]
    }
    if (instance.loader === "neoforge") {
      const versionPart = instance.version.replace('neoforge-', '')
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
    return instance.version
  }

  const handleModSelect = async (mod: ModrinthProject) => {
    if (!selectedInstance || (selectedInstance.loader !== "fabric" && selectedInstance.loader !== "neoforge")) return
    
    setSelectedMod(mod)
    setIsLoadingVersions(true)
    try {
      const mcVersion = getMinecraftVersion(selectedInstance)
      const loaders = [selectedInstance.loader]
      
      const versions = await invoke<ModrinthVersion[]>("get_mod_versions", {
        idOrSlug: mod.project_id,
        loaders: loaders,
        gameVersions: [mcVersion],
      })
      setModVersions(versions)
    } catch (error) {
      console.error("Failed to load versions:", error)
    } finally {
      setIsLoadingVersions(false)
    }
  }

  const isModInstalled = (version: ModrinthVersion): boolean => {
    return version.files.some(file => installedModFiles.has(file.filename))
  }

  const handleDownloadMod = async (version: ModrinthVersion) => {
    if (!selectedInstance || (selectedInstance.loader !== "fabric" && selectedInstance.loader !== "neoforge")) return

    const primaryFile = version.files.find(f => f.primary) || version.files[0]
    if (!primaryFile) return

    setDownloadingMods(prev => new Set(prev).add(version.id))
    
    try {
      await invoke<string>("download_mod", {
        instanceName: selectedInstance.name,
        downloadUrl: primaryFile.url,
        filename: primaryFile.filename,
      })
      
      setInstalledModFiles(prev => new Set(prev).add(primaryFile.filename))
    } catch (error) {
      console.error("Download error:", error)
    } finally {
      setDownloadingMods(prev => {
        const newSet = new Set(prev)
        newSet.delete(version.id)
        return newSet
      })
    }
  }

  const formatDownloads = (downloads: number): string => {
    if (downloads >= 1000000) return `${(downloads / 1000000).toFixed(1)}M`
    if (downloads >= 1000) return `${(downloads / 1000).toFixed(1)}K`
    return downloads.toString()
  }

  const totalPages = searchResults ? Math.ceil(searchResults.total_hits / itemsPerPage) : 1
  const showPagination = searchResults && searchResults.total_hits > itemsPerPage

  return (
    <div className="max-w-7xl mx-auto">
      <style>{`
        .blur-border-input::before {
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
        }

        .blur-border-input:focus-within::before {
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.14),
            rgba(255, 255, 255, 0.08)
          );
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
        }

        .blur-border:hover::before {
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.14),
            rgba(255, 255, 255, 0.08)
          );
        }
      `}</style>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 blur-border-input rounded-md bg-[#22252b]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7d8590] z-20 pointer-events-none" strokeWidth={2} />
          <input
            type="text"
            placeholder="Search mods..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent rounded-md pl-10 pr-4 py-2.5 text-sm text-[#e6e6e6] placeholder-[#7d8590] focus:outline-none transition-all relative z-10"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20">
              <Loader2 size={16} className="animate-spin text-[#16a34a]" />
            </div>
          )}
        </div>
      </div>

      {searchResults ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-3">
              {searchResults.hits.map((mod) => (
                <div
                  key={mod.project_id}
                  className={`blur-border rounded-md overflow-hidden cursor-pointer transition-all ${
                    selectedMod?.project_id === mod.project_id ? "bg-[#2a2f3b]" : "bg-[#22252b]"
                  }`}
                  onClick={() => handleModSelect(mod)}
                >
                  <div className="flex min-h-0 relative z-0">
                    {mod.icon_url ? (
                      <div className="w-24 h-24 flex items-center justify-center flex-shrink-0 rounded m-2">
                        <img
                          src={mod.icon_url}
                          alt={mod.title}
                          className="w-full h-full object-contain rounded"
                        />
                      </div>
                    ) : (
                      <div className="w-24 h-24 bg-gradient-to-br from-[#16a34a]/10 to-[#22c55e]/10 flex items-center justify-center flex-shrink-0 rounded m-2">
                        <Package size={48} className="text-[#16a34a]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 py-2 px-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-0">
                          <h3 className="font-semibold text-base text-[#e6e6e6] truncate">{mod.title}</h3>
                          <span className="text-xs text-[#7d8590] whitespace-nowrap">by {mod.author}</span>
                        </div>
                        <p className="text-sm text-[#7d8590] line-clamp-2 mb-2">{mod.description}</p>
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                          <span className="flex items-center gap-1 bg-[#181a1f] px-2 py-1 rounded text-[#7d8590]">
                            <Download size={12} />
                            {formatDownloads(mod.downloads)}
                          </span>
                          {mod.categories.slice(0, 2).map((category) => (
                            <span key={category} className="bg-[#181a1f] px-2 py-1 rounded text-[#7d8590]">
                              {category}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedMod && (
              <div className="bg-[#22252b] rounded-md p-5 sticky top-4 self-start border border-[#3a3f4b]">
                <div className="flex gap-3 mb-4">
                  {selectedMod.icon_url && (
                    <img src={selectedMod.icon_url} alt={selectedMod.title} className="w-16 h-16 rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold text-[#e6e6e6] truncate">{selectedMod.title}</h2>
                    <p className="text-sm text-[#7d8590]">by {selectedMod.author}</p>
                  </div>
                </div>
                
                <p className="text-sm text-[#7d8590] mb-4 leading-relaxed">{selectedMod.description}</p>
                
                <div className="flex gap-2 mb-5 text-xs flex-wrap">
                  <span className="flex items-center gap-1 bg-[#181a1f] px-2 py-1 rounded text-[#7d8590]">
                    <Download size={12} />
                    {formatDownloads(selectedMod.downloads)}
                  </span>
                  <span className="bg-[#181a1f] px-2 py-1 rounded text-[#7d8590]">{selectedMod.follows.toLocaleString()} followers</span>
                </div>

                <div className="border-t border-[#3a3f4b] pt-4">
                  <h3 className="font-semibold text-sm text-[#e6e6e6] mb-3">Versions</h3>
                  {isLoadingVersions ? (
                    <div className="text-center py-6">
                      <Loader2 size={20} className="animate-spin text-[#16a34a] mx-auto" />
                    </div>
                  ) : modVersions.length === 0 ? (
                    <p className="text-sm text-[#3a3f4b] text-center py-3">No compatible versions</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {modVersions.map((version) => {
                        const installed = isModInstalled(version)
                        const downloading = downloadingMods.has(version.id)
                        
                        return (
                          <div
                            key={version.id}
                            className="bg-[#181a1f] rounded p-3 flex items-center justify-between gap-2"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-[#e6e6e6] truncate">{version.name}</div>
                              <div className="text-xs text-[#3a3f4b] truncate mt-0.5">
                                {version.loaders.join(', ')} • {selectedInstance ? getMinecraftVersion(selectedInstance) : version.game_versions[0]}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleDownloadMod(version)}
                                disabled={!selectedInstance || downloading || installed}
                                className="px-3 py-2 bg-[#16a34a] hover:bg-[#22c55e] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
                              >
                                {downloading ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : installed ? (
                                  "Installed"
                                ) : (
                                  <>
                                    <Download size={14} />
                                    Install
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {showPagination && (
            <div className="flex items-center justify-center gap-2 mt-6 pb-4">
              <button
                onClick={(e) => {
                  e.preventDefault()
                  handlePageChange(currentPage - 1)
                }}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-2 bg-[#22252b] hover:bg-[#2a2f3b] disabled:opacity-50 disabled:cursor-not-allowed text-[#e6e6e6] rounded-md text-sm transition-colors cursor-pointer border border-[#3a3f4b]"
              >
                <ChevronLeft size={16} />
                Previous
              </button>

              <div className="flex items-center gap-1">
                {currentPage > 2 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        handlePageChange(1)
                      }}
                      className="px-3 py-2 bg-[#22252b] hover:bg-[#2a2f3b] text-[#e6e6e6] rounded-md text-sm transition-colors cursor-pointer border border-[#3a3f4b]"
                    >
                      1
                    </button>
                    {currentPage > 3 && (
                      <span className="px-2 text-[#3a3f4b]">...</span>
                    )}
                  </>
                )}

                {currentPage > 1 && (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      handlePageChange(currentPage - 1)
                    }}
                    className="px-3 py-2 bg-[#22252b] hover:bg-[#2a2f3b] text-[#e6e6e6] rounded-md text-sm transition-colors cursor-pointer border border-[#3a3f4b]"
                  >
                    {currentPage - 1}
                  </button>
                )}

                <button
                  className="px-3 py-2 bg-[#16a34a] text-white rounded-md text-sm font-medium"
                >
                  {currentPage}
                </button>

                {currentPage < totalPages && (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      handlePageChange(currentPage + 1)
                    }}
                    className="px-3 py-2 bg-[#22252b] hover:bg-[#2a2f3b] text-[#e6e6e6] rounded-md text-sm transition-colors cursor-pointer border border-[#3a3f4b]"
                  >
                    {currentPage + 1}
                  </button>
                )}

                {currentPage < totalPages - 1 && (
                  <>
                    {currentPage < totalPages - 2 && (
                      <span className="px-2 text-[#3a3f4b]">...</span>
                    )}
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        handlePageChange(totalPages)
                      }}
                      className="px-3 py-2 bg-[#22252b] hover:bg-[#2a2f3b] text-[#e6e6e6] rounded-md text-sm transition-colors cursor-pointer border border-[#3a3f4b]"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.preventDefault()
                  handlePageChange(currentPage + 1)
                }}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-2 bg-[#22252b] hover:bg-[#2a2f3b] disabled:opacity-50 disabled:cursor-not-allowed text-[#e6e6e6] rounded-md text-sm transition-colors cursor-pointer border border-[#3a3f4b]"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}