import { useState, useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Search, Download, Loader2, Sparkles, ChevronLeft, ChevronRight, Heart } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { Instance, ModrinthSearchResult, ModrinthProject, ModrinthVersion } from "../../types"

interface ShaderPacksTabProps {
  selectedInstance: Instance | null
  instances: Instance[]
  onSetSelectedInstance: (instance: Instance) => void
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
}

export function ShaderPacksTab({ 
  selectedInstance,
  scrollContainerRef
}: ShaderPacksTabProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<ModrinthSearchResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedShader, setSelectedShader] = useState<ModrinthProject | null>(null)
  const [shaderVersions, setShaderVersions] = useState<ModrinthVersion[]>([])
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [downloadingShaders, setDownloadingShaders] = useState<Set<string>>(new Set())
  const [installedShaders, setInstalledShaders] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [favoriteShaderPacks, setFavoriteShaderPacks] = useState<Set<string>>(new Set())

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('favoriteShaderPacks')
    if (savedFavorites) {
      try {
        const parsed = JSON.parse(savedFavorites)
        setFavoriteShaderPacks(new Set(parsed))
      } catch (error) {
        console.error('Failed to parse favorite shader packs:', error)
        setFavoriteShaderPacks(new Set())
      }
    }
  }, [])

  useEffect(() => {
    loadPopularShaderPacks()
  }, [])

  useEffect(() => {
    if (selectedInstance) {
      loadInstalledShaderPacks()
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

  const toggleFavorite = (projectId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation()
    }
    
    setFavoriteShaderPacks(prev => {
      const newFavorites = new Set(prev)
      if (newFavorites.has(projectId)) {
        newFavorites.delete(projectId)
      } else {
        newFavorites.add(projectId)
      }
      // Save to localStorage
      localStorage.setItem('favoriteShaderPacks', JSON.stringify(Array.from(newFavorites)))
      return newFavorites
    })
  }

  const loadInstalledShaderPacks = async () => {
    if (!selectedInstance) return
    
    try {
      const shaders = await invoke<string[]>("get_installed_shaderpacks", {
        instanceName: selectedInstance.name,
      })
      setInstalledShaders(new Set(shaders))
    } catch (error) {
      console.error("Failed to load installed shader packs:", error)
    }
  }

  const loadPopularShaderPacks = async () => {
    setIsSearching(true)
    try {
      const facets = JSON.stringify([["project_type:shader"]])
      const result = await invoke<ModrinthSearchResult>("search_mods", {
        query: "",
        facets,
        index: "downloads",
        offset: 0,
        limit: itemsPerPage,
      })
      setSearchResults(result)
    } catch (error) {
      console.error("Failed to load popular shader packs:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearch = async (page: number = currentPage) => {
    const query = searchQuery.trim()
    setIsSearching(true)
    try {
      const facets = JSON.stringify([["project_type:shader"]])
      const offset = (page - 1) * itemsPerPage
      const result = await invoke<ModrinthSearchResult>("search_mods", {
        query: query || "",
        facets,
        index: query ? "relevance" : "downloads",
        offset,
        limit: itemsPerPage,
      })
      setSearchResults(result)
      setSelectedShader(null)
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

  const handleShaderSelect = async (shader: ModrinthProject) => {
    if (!selectedInstance) return
    
    setSelectedShader(shader)
    setIsLoadingVersions(true)
    try {
      const mcVersion = getMinecraftVersion(selectedInstance)
      
      const versions = await invoke<ModrinthVersion[]>("get_mod_versions", {
        idOrSlug: shader.project_id,
        loaders: ["iris", "optifine", "canvas"],
        gameVersions: [mcVersion],
      })
      setShaderVersions(versions)
    } catch (error) {
      console.error("Failed to load versions:", error)
    } finally {
      setIsLoadingVersions(false)
    }
  }

  const isShaderInstalled = (version: ModrinthVersion): boolean => {
    return version.files.some(file => installedShaders.has(file.filename))
  }

  const handleDownloadShader = async (version: ModrinthVersion) => {
    if (!selectedInstance) return

    const primaryFile = version.files.find(f => f.primary) || version.files[0]
    if (!primaryFile) return

    setDownloadingShaders(prev => new Set(prev).add(version.id))
    
    try {
      await invoke<string>("download_shaderpack", {
        instanceName: selectedInstance.name,
        downloadUrl: primaryFile.url,
        filename: primaryFile.filename,
      })
      
      setInstalledShaders(prev => new Set(prev).add(primaryFile.filename))
    } catch (error) {
      console.error("Download error:", error)
    } finally {
      setDownloadingShaders(prev => {
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

  if (!selectedInstance) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Sparkles size={64} className="mx-auto mb-4 text-[#3a3f4b]" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-[#e6e6e6] mb-2">
              {t('shaderpacks.noInstanceSelected')}
            </h3>
            <p className="text-sm text-[#7d8590]">
              {t('shaderpacks.selectInstancePrompt')}
            </p>
          </div>
        </div>
      </div>
    )
  }

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
            placeholder={t('shaderpacks.searchPlaceholder')}
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
              {searchResults.hits.map((shader) => (
                <div
                  key={shader.project_id}
                  className={`blur-border rounded-md overflow-hidden cursor-pointer transition-all ${
                    selectedShader?.project_id === shader.project_id ? "bg-[#2a2f3b]" : "bg-[#22252b]"
                  }`}
                  onClick={() => handleShaderSelect(shader)}
                >
                  <div className="flex min-h-0 relative z-0">
                    {shader.icon_url ? (
                      <div className="w-24 h-24 flex items-center justify-center flex-shrink-0 rounded m-2">
                        <img
                          src={shader.icon_url}
                          alt={shader.title}
                          className="w-full h-full object-contain rounded"
                        />
                      </div>
                    ) : (
                      <div className="w-24 h-24 bg-gradient-to-br from-[#f59e0b]/10 to-[#fbbf24]/10 flex items-center justify-center flex-shrink-0 rounded m-2">
                        <Sparkles size={48} className="text-[#f59e0b]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 py-2 px-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-0">
                          <h3 className="font-semibold text-base text-[#e6e6e6] truncate">{shader.title}</h3>
                          <span className="text-xs text-[#7d8590] whitespace-nowrap">by {shader.author}</span>
                        </div>
                        <p className="text-sm text-[#7d8590] line-clamp-2 mb-2">{shader.description}</p>
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                          <span className="flex items-center gap-1 bg-[#181a1f] px-2 py-1 rounded text-[#7d8590]">
                            <Download size={12} />
                            {formatDownloads(shader.downloads)}
                          </span>
                          {shader.categories.slice(0, 2).map((category) => (
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

            {selectedShader && (
              <div className="bg-[#22252b] rounded-md p-5 sticky top-4 self-start border border-[#3a3f4b]">
                <div className="flex gap-3 mb-4">
                  {selectedShader.icon_url && (
                    <img src={selectedShader.icon_url} alt={selectedShader.title} className="w-16 h-16 rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-xl font-semibold text-[#e6e6e6] truncate">{selectedShader.title}</h2>
                      <button
                        onClick={(e) => toggleFavorite(selectedShader.project_id, e)}
                        className="p-1 hover:bg-[#181a1f] rounded transition-colors flex-shrink-0 cursor-pointer"
                      >
                        <Heart
                          size={20}
                          className={favoriteShaderPacks.has(selectedShader.project_id) ? "fill-[#ef4444] text-[#ef4444]" : "text-[#7d8590]"}
                          strokeWidth={2}
                        />
                      </button>
                    </div>
                    <p className="text-sm text-[#7d8590]">by {selectedShader.author}</p>
                  </div>
                </div>
                
                <p className="text-sm text-[#7d8590] mb-4 leading-relaxed">{selectedShader.description}</p>
                
                <div className="flex gap-2 mb-5 text-xs flex-wrap">
                  <span className="flex items-center gap-1 bg-[#181a1f] px-2 py-1 rounded text-[#7d8590]">
                    <Download size={12} />
                    {formatDownloads(selectedShader.downloads)}
                  </span>
                  <span className="bg-[#181a1f] px-2 py-1 rounded text-[#7d8590]">{selectedShader.follows.toLocaleString()} {t('shaderpacks.followers')}</span>
                </div>

                <div className="border-t border-[#3a3f4b] pt-4">
                  <h3 className="font-semibold text-sm text-[#e6e6e6] mb-3">{t('shaderpacks.versions')}</h3>
                  {isLoadingVersions ? (
                    <div className="text-center py-6">
                      <Loader2 size={20} className="animate-spin text-[#16a34a] mx-auto" />
                    </div>
                  ) : shaderVersions.length === 0 ? (
                    <p className="text-sm text-[#3a3f4b] text-center py-3">{t('shaderpacks.noCompatibleVersions')}</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {shaderVersions.map((version) => {
                        const installed = isShaderInstalled(version)
                        const downloading = downloadingShaders.has(version.id)
                        
                        return (
                          <div
                            key={version.id}
                            className="bg-[#181a1f] rounded p-3 flex items-center justify-between gap-2"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-[#e6e6e6] truncate">{version.name}</div>
                              <div className="text-xs text-[#3a3f4b] truncate mt-0.5">
                                {version.loaders.join(', ')} • {getMinecraftVersion(selectedInstance)}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleDownloadShader(version)}
                                disabled={!selectedInstance || downloading || installed}
                                className="px-3 py-2 bg-[#f59e0b] hover:bg-[#fbbf24] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
                              >
                                {downloading ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : installed ? (
                                  t('shaderpacks.installed')
                                ) : (
                                  <>
                                    <Download size={14} />
                                    {t('shaderpacks.install')}
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
                {t('shaderpacks.pagination.previous')}
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
                  className="px-3 py-2 bg-[#f59e0b] text-white rounded-md text-sm font-medium"
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
                {t('shaderpacks.pagination.next')}
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}