import { useState, useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Search, Download, Loader2, Package, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, X, Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { Instance, ModrinthSearchResult, ModrinthProject, ModrinthVersion } from "../../types"

interface ModpacksTabProps {
  instances: Instance[]
  onRefreshInstances?: () => void
  selectedVersion: string | null
  onSetSelectedVersion: (version: string | null) => void
  availableVersions: string[]
  onSetAvailableVersions: (versions: string[]) => void
  isLoadingVersions: boolean
  onSetIsLoadingVersions: (loading: boolean) => void
  onShowCreationToast?: (instanceName: string) => void
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
}

const CUSTOM_MODPACK_SLUG = "stellarmc-enhanced"
const CUSTOM_MODPACK_AUTHOR = "StellarMC"

export function ModpacksTab({ 
  instances, 
  onRefreshInstances,
  selectedVersion,
  onSetAvailableVersions,
  onSetIsLoadingVersions,
  onShowCreationToast,
  scrollContainerRef
}: ModpacksTabProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<ModrinthSearchResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const [installingModpacks, setInstallingModpacks] = useState<Set<string>>(new Set())
  const [installationStatus, setInstallationStatus] = useState<Record<string, 'success' | 'error'>>({})
  const [modpackVersions, setModpackVersions] = useState<Record<string, ModrinthVersion[]>>({})
  const [loadingVersions, setLoadingVersions] = useState<Set<string>>(new Set())
  const [modpackGalleries, setModpackGalleries] = useState<Record<string, string[]>>({})
  const [customModpack, setCustomModpack] = useState<ModrinthProject | null>(null)
  
  const [selectedModpack, setSelectedModpack] = useState<ModrinthProject | null>(null)
  const [selectedModpackVersion, setSelectedModpackVersion] = useState<string>("")
  const [isModalClosing, setIsModalClosing] = useState(false)
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false)

  useEffect(() => {
    loadCustomModpack()
    loadPopularModpacks()
    loadAvailableVersions()
  }, [])

  useEffect(() => {
    if (!selectedModpack) {
      setIsVersionDropdownOpen(false)
    }
  }, [selectedModpack])

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
  }, [searchQuery, selectedVersion])

  const loadCustomModpack = async () => {
    try {
      const projectDetails = await invoke<any>("get_project_details", {
        idOrSlug: CUSTOM_MODPACK_SLUG,
      })

      const modpackData: ModrinthProject = {
        project_id: projectDetails.id,
        slug: projectDetails.slug,
        title: projectDetails.title,
        description: projectDetails.description,
        author: CUSTOM_MODPACK_AUTHOR,
        icon_url: projectDetails.icon_url,
        downloads: projectDetails.downloads || 0,
        follows: 0,
        date_created: "",
        date_modified: "",
        latest_version: "",
        license: "",
        client_side: "required",
        server_side: "optional",
        project_type: "modpack",
        categories: [],
        versions: [],
        gallery: [],
        display_categories: []
      }
      
      setCustomModpack(modpackData)
      loadModpackGallery(projectDetails.id)
    } catch (error) {
      console.error("Failed to load custom modpack:", error)
    }
  }

  const loadAvailableVersions = async () => {
    onSetIsLoadingVersions(true)
    try {
      const versions = await invoke<string[]>("get_modpack_game_versions")
      const stableVersions = versions.filter(version => {
        return /^1\.\d+(\.\d+)?$/.test(version)
      })
      onSetAvailableVersions(stableVersions)
    } catch (error) {
      console.error("Failed to load available versions:", error)
    } finally {
      onSetIsLoadingVersions(false)
    }
  }

  const loadPopularModpacks = async () => {
    setIsSearching(true)
    try {
      let facets = [["project_type:modpack"]]
      if (selectedVersion) {
        facets.push([`versions:${selectedVersion}`])
      }
      
      const result = await invoke<ModrinthSearchResult>("search_mods", {
        query: "",
        facets: JSON.stringify(facets),
        index: "downloads",
        offset: 0,
        limit: itemsPerPage,
      })
      setSearchResults(result)
      
      for (const modpack of result.hits) {
        loadModpackGallery(modpack.project_id)
      }
    } catch (error) {
      console.error("Failed to load popular modpacks:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearch = async (page: number = currentPage) => {
    const query = searchQuery.trim()
    setIsSearching(true)
    try {
      let facets = [["project_type:modpack"]]
      if (selectedVersion) {
        facets.push([`versions:${selectedVersion}`])
      }
      
      const offset = (page - 1) * itemsPerPage
      const result = await invoke<ModrinthSearchResult>("search_mods", {
        query: query || "",
        facets: JSON.stringify(facets),
        index: query ? "relevance" : "downloads",
        offset,
        limit: itemsPerPage,
      })
      setSearchResults(result)
      
      for (const modpack of result.hits) {
        loadModpackGallery(modpack.project_id)
      }
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

  const getFilteredModpacks = () => {
    if (!searchResults) return []
    
    const modpacks = searchResults.hits

    const shouldShowCustomModpack = currentPage === 1 && !searchQuery.trim() && customModpack
    
    if (shouldShowCustomModpack) {
      const filteredModpacks = modpacks.filter(m => m.project_id !== customModpack!.project_id)
      return [customModpack!, ...filteredModpacks]
    }
    
    return modpacks
  }

  const getPaginatedModpacks = () => {
    const filtered = getFilteredModpacks()
    if (!searchQuery.trim() && currentPage === 1 && customModpack) {
      return filtered.slice(0, itemsPerPage)
    }
    
    return filtered
  }

  const openModpackModal = async (modpack: ModrinthProject) => {
    setSelectedModpack(modpack)
    const projectId = modpack.project_id
    
    if (!modpackVersions[projectId]) {
      setLoadingVersions(prev => new Set(prev).add(projectId))
      try {
        const versions = await invoke<ModrinthVersion[]>("get_modpack_versions", {
          idOrSlug: modpack.slug,
          gameVersion: selectedVersion,
        })
        setModpackVersions(prev => ({ ...prev, [projectId]: versions }))
        if (versions.length > 0) {
          setSelectedModpackVersion(versions[0].id)
        }
      } catch (error) {
        console.error("Failed to load versions:", error)
      } finally {
        setLoadingVersions(prev => {
          const newSet = new Set(prev)
          newSet.delete(projectId)
          return newSet
        })
      }
    } else {
      setSelectedModpackVersion(modpackVersions[projectId][0]?.id || "")
    }
  }

  const loadModpackGallery = async (projectId: string) => {
    try {
      const projectDetails = await invoke<any>("get_project_details", {
        idOrSlug: projectId,
      })
      
      if (projectDetails.gallery && projectDetails.gallery.length > 0) {
        const sortedGallery = projectDetails.gallery
          .map((img: any) => ({
            url: img.url || img,
            featured: img.featured || false,
            title: (img.title || '').toLowerCase(),
            description: (img.description || '').toLowerCase(),
          }))
          .sort((a: any, b: any) => {
            if (a.featured && !b.featured) return -1
            if (!a.featured && b.featured) return 1
            
            const aHasBanner = a.title.includes('banner') || a.description.includes('banner')
            const bHasBanner = b.title.includes('banner') || b.description.includes('banner')
            if (aHasBanner && !bHasBanner) return -1
            if (!aHasBanner && bHasBanner) return 1
            
            const aHasHeader = a.title.includes('header') || a.description.includes('header')
            const bHasHeader = b.title.includes('header') || b.description.includes('header')
            if (aHasHeader && !bHasHeader) return -1
            if (!aHasHeader && bHasHeader) return 1
            
            return 0
          })
          .map((img: any) => img.url)
        
        setModpackGalleries(prev => ({ ...prev, [projectId]: sortedGallery }))
      }
    } catch (error) {
      console.error(`Failed to load gallery for ${projectId}:`, error)
    }
  }

  const formatDownloads = (downloads: number): string => {
    if (downloads >= 1000000) return `${(downloads / 1000000).toFixed(1)}M`
    if (downloads >= 1000) return `${(downloads / 1000).toFixed(1)}K`
    return downloads.toString()
  }

  const handleInstallModpack = async () => {
    if (!selectedModpack) return
    
    try {
      const projectId = selectedModpack.project_id
      const versions = modpackVersions[projectId]

      if (!versions || versions.length === 0) {
        alert(t('modpacks.noVersionsAvailable'))
        return
      }

      const versionId = selectedModpackVersion || versions[0].id
      const instanceName = selectedModpack.title

      const existingInstance = instances.find(i => i.name === instanceName)
      const finalName = existingInstance ? `${instanceName}-${Date.now()}` : instanceName
      
      setInstallingModpacks(prev => new Set(prev).add(selectedModpack.project_id))
      handleCloseModal()
      
      console.log("Installing modpack:", {
        slug: selectedModpack.slug,
        instanceName: finalName,
        versionId: versionId,
        gameVersion: selectedVersion
      })
      
      if (onShowCreationToast) {
        onShowCreationToast(finalName)
      }
      
      await invoke("install_modpack", {
        modpackSlug: selectedModpack.slug,
        instanceName: finalName,
        versionId: versionId,
        preferredGameVersion: selectedVersion,
      })
      
      setInstallationStatus(prev => ({ ...prev, [selectedModpack.project_id]: 'success' }))

      if (onRefreshInstances) {
        setTimeout(() => {
          onRefreshInstances()
        }, 500)
      }

      setTimeout(() => {
        setInstallingModpacks(prev => {
          const newSet = new Set(prev)
          newSet.delete(projectId)
          return newSet
        })
        setInstallationStatus(prev => {
          const newStatus = { ...prev }
          delete newStatus[projectId]
          return newStatus
        })
      }, 3000)

    } catch (error) {
      console.error("Failed to install modpack:", error)
      if (selectedModpack) {
        setInstallationStatus(prev => ({ ...prev, [selectedModpack.project_id]: 'error' }))
        
        setInstallingModpacks(prev => {
          const newSet = new Set(prev)
          newSet.delete(selectedModpack.project_id)
          return newSet
        })

        setTimeout(() => {
          setInstallationStatus(prev => {
            const newStatus = { ...prev }
            delete newStatus[selectedModpack.project_id]
            return newStatus
          })
        }, 5000)
      }
    }
  }

  const handleCloseModal = () => {
    setIsModalClosing(true)
    setTimeout(() => {
      setIsModalClosing(false)
      setSelectedModpack(null)
    }, 150)
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
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 blur-border-input rounded-md bg-[#22252b]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7d8590] z-20 pointer-events-none" strokeWidth={2} />
          <input
            type="text"
            placeholder={t('modpacks.searchPlaceholder')}
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

      {searchResults && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {getPaginatedModpacks().map((modpack) => {
              const isInstalling = installingModpacks.has(modpack.project_id)
              const status = installationStatus[modpack.project_id]
              const gallery = modpackGalleries[modpack.project_id] || []
              const backgroundImage = gallery.length > 0 ? gallery[0] : null
              
              return (
                <div
                  key={modpack.project_id}
                  className="blur-border relative bg-[#22252b] rounded-md overflow-hidden transition-all group"
                >
                  <div className="relative h-48 overflow-hidden z-0">
                    {backgroundImage ? (
                      <img
                        src={backgroundImage}
                        alt={modpack.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#22252b] via-[#181a1f] to-[#141414] flex items-center justify-center">
                        <Package size={64} className="text-[#3a3f4b]" strokeWidth={1.5} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  </div>

                  <div className="relative bg-[#22252b] p-4 flex items-center gap-4 z-0">
                    <div className="w-14 h-14 rounded overflow-hidden flex-shrink-0">
                      {modpack.icon_url ? (
                        <img
                          src={modpack.icon_url}
                          alt={modpack.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#181a1f] flex items-center justify-center">
                          <Package size={28} className="text-[#7d8590]" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-[#e6e6e6] leading-tight truncate">
                        {modpack.title}
                      </h3>
                      <p className="text-sm text-[#7d8590] leading-tight">
                        by {modpack.author}
                      </p>
                      <p className="text-sm text-[#3a3f4b] leading-tight">
                        {formatDownloads(modpack.downloads)} {t('modpacks.downloads')}
                      </p>
                    </div>

                    {status === 'success' ? (
                      <div className="flex-shrink-0 px-4 py-2 rounded-md font-medium text-sm bg-[#16a34a] text-white">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle size={16} />
                          {t('modpacks.status.success')}
                        </span>
                      </div>
                    ) : status === 'error' ? (
                      <div className="flex-shrink-0 px-4 py-2 rounded-md font-medium text-sm bg-red-600 text-white">
                        <span className="flex items-center gap-1.5">
                          <AlertCircle size={16} />
                          {t('modpacks.status.error')}
                        </span>
                      </div>
                    ) : isInstalling ? (
                      <div className="flex-shrink-0 px-4 py-2 rounded-md font-medium text-sm bg-[#181a1f] text-[#7d8590] border border-[#3a3f4b]">
                        <span className="flex items-center gap-1.5">
                          <Loader2 size={16} className="animate-spin" />
                          {t('modpacks.status.installing')}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openModpackModal(modpack)
                        }}
                        className="flex-shrink-0 px-4 py-2 rounded font-medium text-sm bg-[#4572e3] hover:bg-[#3461d1] text-white transition-colors cursor-pointer shadow-sm"
                      >
                        <span className="flex items-center gap-1.5">
                          <Download size={16} />
                          {t('mods.install')}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
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
                {t('mods.pagination.previous')}
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
                {t('mods.pagination.next')}
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {selectedModpack && (
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
            className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop ${isModalClosing ? 'closing' : ''}`} 
            onClick={handleCloseModal}
          >
            <div 
              className={`blur-border bg-[#181a1f] rounded-md w-full max-w-2xl border border-[#3a3f4b] modal-content ${isModalClosing ? 'closing' : ''}`} 
              onClick={(e) => e.stopPropagation()}
              style={{ pointerEvents: 'auto' }}
            >
              <div className="relative h-64 overflow-hidden rounded-t-md">
                {modpackGalleries[selectedModpack.project_id]?.[0] ? (
                  <img
                    src={modpackGalleries[selectedModpack.project_id][0]}
                    alt={selectedModpack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#22252b] via-[#181a1f] to-[#141414] flex items-center justify-center">
                    <Package size={80} className="text-[#3a3f4b]" strokeWidth={1.5} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <button
                  onClick={handleCloseModal}
                  className="absolute top-4 right-4 p-1.5 bg-[#22252b]/80 hover:bg-[#3a3f4b] backdrop-blur-sm border border-[#3a3f4b] rounded transition-colors cursor-pointer"
                >
                  <X size={20} className="text-[#e6e6e6]" strokeWidth={2} />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-visible">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
                    {selectedModpack.icon_url ? (
                      <img src={selectedModpack.icon_url} alt={selectedModpack.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#22252b] flex items-center justify-center">
                        <Package size={32} className="text-[#7d8590]" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-[#e6e6e6] leading-tight">{selectedModpack.title}</h2>
                    <p className="text-sm text-[#7d8590] leading-tight">by {selectedModpack.author}</p>
                    <p className="text-sm text-[#3a3f4b] leading-tight">
                      {formatDownloads(selectedModpack.downloads)} {t('modpacks.downloads')}
                    </p>
                  </div>
                </div>

                {selectedModpack.description && (
                  <p className="text-sm text-[#7d8590] leading-relaxed">{selectedModpack.description}</p>
                )}

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[#e6e6e6]">{t('modpacks.selectVersion')}</label>
                  {loadingVersions.has(selectedModpack.project_id) ? (
                    <div className="flex items-center gap-2 text-[#7d8590] text-sm py-3.5 px-4 bg-[#22252b] rounded">
                      <Loader2 size={16} className="animate-spin text-[#4572e3]" />
                      <span>{t('modpacks.loadingVersions')}</span>
                    </div>
                  ) : modpackVersions[selectedModpack.project_id]?.length > 0 ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
                        className={`w-full bg-[#22252b] px-4 py-3.5 pr-10 text-sm text-[#e6e6e6] focus:outline-none transition-all text-left cursor-pointer ${
                          isVersionDropdownOpen ? 'rounded-t' : 'rounded'
                        }`}
                      >
                        {(() => {
                          const version = modpackVersions[selectedModpack.project_id].find(v => v.id === selectedModpackVersion);
                          return version ? `${version.name} - ${version.game_versions?.join(', ') || ''}` : selectedModpackVersion;
                        })()}
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
                          {modpackVersions[selectedModpack.project_id].map((version) => (
                            <button
                              key={version.id}
                              type="button"
                              onClick={() => {
                                setSelectedModpackVersion(version.id);
                                setIsVersionDropdownOpen(false);
                              }}
                              className="w-full px-4 py-3 text-sm text-left hover:bg-[#3a3f4b] transition-colors flex items-center justify-between cursor-pointer text-[#e6e6e6]"
                            >
                              <span>{version.name} - {version.game_versions?.join(', ')}</span>
                              {selectedModpackVersion === version.id && (
                                <Check size={16} className="text-[#e6e6e6]" strokeWidth={2} />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-[#7d8590] py-3">{t('modpacks.noVersionsAvailable')}</p>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={handleCloseModal}
                    className="px-5 py-2.5 bg-[#22252b] hover:bg-[#3a3f4b] text-[#e6e6e6] rounded font-medium text-sm transition-colors cursor-pointer"
                  >
                    {t('common.actions.cancel')}
                  </button>
                  <button
                    onClick={handleInstallModpack}
                    disabled={!selectedModpackVersion || loadingVersions.has(selectedModpack.project_id)}
                    className="px-5 py-2.5 bg-[#4572e3] hover:bg-[#3461d1] disabled:bg-[#22252b] disabled:cursor-not-allowed disabled:text-[#3a3f4b] text-white rounded font-medium text-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Download size={16} />
                    {t('mods.install')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}