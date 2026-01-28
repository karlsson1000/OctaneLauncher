import { useState, useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Search, Download, Loader2, Image, ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { Instance, ModrinthSearchResult, ModrinthProject, ModrinthVersion } from "../../types"

interface ResourcePacksTabProps {
  selectedInstance: Instance | null
  instances: Instance[]
  onSetSelectedInstance: (instance: Instance) => void
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
}

export function ResourcePacksTab({ 
  selectedInstance,
  scrollContainerRef
}: ResourcePacksTabProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<ModrinthSearchResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedPack, setSelectedPack] = useState<ModrinthProject | null>(null)
  const [packVersions, setPackVersions] = useState<ModrinthVersion[]>([])
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [downloadingPacks, setDownloadingPacks] = useState<Set<string>>(new Set())
  const [installedPacks, setInstalledPacks] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadPopularResourcePacks()
  }, [])

  useEffect(() => {
    if (selectedInstance) {
      loadInstalledResourcePacks()
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

  const loadInstalledResourcePacks = async () => {
    if (!selectedInstance) return
    
    try {
      const packs = await invoke<string[]>("get_installed_resourcepacks", {
        instanceName: selectedInstance.name,
      })
      setInstalledPacks(new Set(packs))
    } catch (error) {
      console.error("Failed to load installed resource packs:", error)
    }
  }

  const loadPopularResourcePacks = async () => {
    setIsSearching(true)
    try {
      const facets = JSON.stringify([["project_type:resourcepack"]])
      const result = await invoke<ModrinthSearchResult>("search_mods", {
        query: "",
        facets,
        index: "downloads",
        offset: 0,
        limit: itemsPerPage,
      })
      setSearchResults(result)
    } catch (error) {
      console.error("Failed to load popular resource packs:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearch = async (page: number = currentPage) => {
    const query = searchQuery.trim()
    setIsSearching(true)
    try {
      const facets = JSON.stringify([["project_type:resourcepack"]])
      const offset = (page - 1) * itemsPerPage
      const result = await invoke<ModrinthSearchResult>("search_mods", {
        query: query || "",
        facets,
        index: query ? "relevance" : "downloads",
        offset,
        limit: itemsPerPage,
      })
      setSearchResults(result)
      setSelectedPack(null)
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

    const handlePackSelect = async (pack: ModrinthProject) => {
    if (!selectedInstance) return
    
    setSelectedPack(pack)
    setIsLoadingVersions(true)
    try {
        const mcVersion = getMinecraftVersion(selectedInstance)
        
        const versions = await invoke<ModrinthVersion[]>("get_mod_versions", {
        idOrSlug: pack.project_id,
        gameVersions: [mcVersion],
        })
        setPackVersions(versions)
    } catch (error) {
        console.error("Failed to load versions:", error)
    } finally {
        setIsLoadingVersions(false)
    }
    }

  const isPackInstalled = (version: ModrinthVersion): boolean => {
    return version.files.some(file => installedPacks.has(file.filename))
  }

  const handleDownloadPack = async (version: ModrinthVersion) => {
    if (!selectedInstance) return

    const primaryFile = version.files.find(f => f.primary) || version.files[0]
    if (!primaryFile) return

    setDownloadingPacks(prev => new Set(prev).add(version.id))
    
    try {
      await invoke<string>("download_resourcepack", {
        instanceName: selectedInstance.name,
        downloadUrl: primaryFile.url,
        filename: primaryFile.filename,
      })
      
      setInstalledPacks(prev => new Set(prev).add(primaryFile.filename))
    } catch (error) {
      console.error("Download error:", error)
    } finally {
      setDownloadingPacks(prev => {
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
            <Image size={64} className="mx-auto mb-4 text-[#3a3f4b]" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-[#e6e6e6] mb-2">
              {t('resourcepacks.noInstanceSelected')}
            </h3>
            <p className="text-sm text-[#7d8590]">
              {t('resourcepacks.selectInstancePrompt')}
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
            placeholder={t('resourcepacks.searchPlaceholder')}
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
              {searchResults.hits.map((pack) => (
                <div
                  key={pack.project_id}
                  className={`blur-border rounded-md overflow-hidden cursor-pointer transition-all ${
                    selectedPack?.project_id === pack.project_id ? "bg-[#2a2f3b]" : "bg-[#22252b]"
                  }`}
                  onClick={() => handlePackSelect(pack)}
                >
                  <div className="flex min-h-0 relative z-0">
                    {pack.icon_url ? (
                      <div className="w-24 h-24 flex items-center justify-center flex-shrink-0 rounded m-2">
                        <img
                          src={pack.icon_url}
                          alt={pack.title}
                          className="w-full h-full object-contain rounded"
                        />
                      </div>
                    ) : (
                      <div className="w-24 h-24 bg-gradient-to-br from-[#8b5cf6]/10 to-[#a78bfa]/10 flex items-center justify-center flex-shrink-0 rounded m-2">
                        <Image size={48} className="text-[#8b5cf6]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 py-2 px-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-0">
                          <h3 className="font-semibold text-base text-[#e6e6e6] truncate">{pack.title}</h3>
                          <span className="text-xs text-[#7d8590] whitespace-nowrap">by {pack.author}</span>
                        </div>
                        <p className="text-sm text-[#7d8590] line-clamp-2 mb-2">{pack.description}</p>
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                          <span className="flex items-center gap-1 bg-[#181a1f] px-2 py-1 rounded text-[#7d8590]">
                            <Download size={12} />
                            {formatDownloads(pack.downloads)}
                          </span>
                          {pack.categories.slice(0, 2).map((category) => (
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

            {selectedPack && (
              <div className="bg-[#22252b] rounded-md p-5 sticky top-4 self-start border border-[#3a3f4b]">
                <div className="flex gap-3 mb-4">
                  {selectedPack.icon_url && (
                    <img src={selectedPack.icon_url} alt={selectedPack.title} className="w-16 h-16 rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold text-[#e6e6e6] truncate">{selectedPack.title}</h2>
                    <p className="text-sm text-[#7d8590]">by {selectedPack.author}</p>
                  </div>
                </div>
                
                <p className="text-sm text-[#7d8590] mb-4 leading-relaxed">{selectedPack.description}</p>
                
                <div className="flex gap-2 mb-5 text-xs flex-wrap">
                  <span className="flex items-center gap-1 bg-[#181a1f] px-2 py-1 rounded text-[#7d8590]">
                    <Download size={12} />
                    {formatDownloads(selectedPack.downloads)}
                  </span>
                  <span className="bg-[#181a1f] px-2 py-1 rounded text-[#7d8590]">{selectedPack.follows.toLocaleString()} {t('resourcepacks.followers')}</span>
                </div>

                <div className="border-t border-[#3a3f4b] pt-4">
                  <h3 className="font-semibold text-sm text-[#e6e6e6] mb-3">{t('resourcepacks.versions')}</h3>
                  {isLoadingVersions ? (
                    <div className="text-center py-6">
                      <Loader2 size={20} className="animate-spin text-[#16a34a] mx-auto" />
                    </div>
                  ) : packVersions.length === 0 ? (
                    <p className="text-sm text-[#3a3f4b] text-center py-3">{t('resourcepacks.noCompatibleVersions')}</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {packVersions.map((version) => {
                        const installed = isPackInstalled(version)
                        const downloading = downloadingPacks.has(version.id)
                        
                        return (
                          <div
                            key={version.id}
                            className="bg-[#181a1f] rounded p-3 flex items-center justify-between gap-2"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-[#e6e6e6] truncate">{version.name}</div>
                              <div className="text-xs text-[#3a3f4b] truncate mt-0.5">
                                {getMinecraftVersion(selectedInstance)}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleDownloadPack(version)}
                                disabled={!selectedInstance || downloading || installed}
                                className="px-3 py-2 bg-[#8b5cf6] hover:bg-[#a78bfa] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
                              >
                                {downloading ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : installed ? (
                                  t('resourcepacks.installed')
                                ) : (
                                  <>
                                    <Download size={14} />
                                    {t('resourcepacks.install')}
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
                {t('resourcepacks.pagination.previous')}
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
                  className="px-3 py-2 bg-[#8b5cf6] text-white rounded-md text-sm font-medium"
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
                {t('resourcepacks.pagination.next')}
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}