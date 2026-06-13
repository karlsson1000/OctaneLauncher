import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Search, Download, Loader2, Package, ChevronDown, Check, CheckCircle, AlertCircle, X } from "lucide-react"
import type { Instance, ModrinthSearchResult, ModrinthProject, ModrinthVersion, ModrinthProjectDetails } from "../../types"

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
const ITEMS_PER_PAGE = 20

export function ModpacksTab({
  instances,
  onRefreshInstances,
  selectedVersion,
  onSetAvailableVersions,
  onSetIsLoadingVersions,
  onShowCreationToast,
}: ModpacksTabProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [hits, setHits] = useState<ModrinthProject[]>([])
  const [, setTotalHits] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const offsetRef = useRef(0)
  const hasMoreRef = useRef(true)

  const [installingModpacks, setInstallingModpacks] = useState<Set<string>>(new Set())
  const [installationStatus, setInstallationStatus] = useState<Record<string, "success" | "error">>({})
  const [modpackVersions, setModpackVersions] = useState<Record<string, ModrinthVersion[]>>({})
  const [loadingVersions, setLoadingVersions] = useState<Set<string>>(new Set())
  const [modpackGalleries, setModpackGalleries] = useState<Record<string, string[]>>({})
  const [customModpack, setCustomModpack] = useState<ModrinthProject | null>(null)
  const customModpackLoadedRef = useRef(false)

  const [selectedModpack, setSelectedModpack] = useState<ModrinthProject | null>(null)
  const [selectedModpackVersion, setSelectedModpackVersion] = useState<string>("")
  const [isModalClosing, setIsModalClosing] = useState(false)
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false)

  useEffect(() => {
    loadCustomModpack()
    loadAvailableVersions()
  }, [])

  useEffect(() => {
    if (!selectedModpack) setIsVersionDropdownOpen(false)
  }, [selectedModpack])

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    offsetRef.current = 0
    hasMoreRef.current = true
    searchTimeoutRef.current = setTimeout(() => {
      fetchModpacks(0, true)
    }, hits.length === 0 ? 0 : 300)
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
  }, [searchQuery, selectedVersion])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && !isSearching && hasMoreRef.current) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )
    if (sentinelRef.current) observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [isLoadingMore, isSearching])

  const fetchModpacks = useCallback(async (offset: number, replace: boolean) => {
    const query = searchQuery.trim()
    if (replace) setIsSearching(true)
    else setIsLoadingMore(true)

    try {
      const facets: string[][] = [["project_type:modpack"]]
      if (selectedVersion) facets.push([`versions:${selectedVersion}`])

      const result = await invoke<ModrinthSearchResult>("search_mods", {
        query: query || "",
        facets: JSON.stringify(facets),
        index: query ? "relevance" : "downloads",
        offset,
        limit: ITEMS_PER_PAGE,
      })

      offsetRef.current = offset + result.hits.length
      hasMoreRef.current = offset + result.hits.length < result.total_hits
      setTotalHits(result.total_hits)

      if (replace) {
        setHits(result.hits)
        setSelectedModpack(null)
      } else {
        setHits(prev => {
          const ids = new Set(prev.map(h => h.project_id))
          return [...prev, ...result.hits.filter(h => !ids.has(h.project_id))]
        })
      }

      for (const modpack of result.hits) {
        loadModpackGallery(modpack.project_id)
      }
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      if (replace) setIsSearching(false)
      else setIsLoadingMore(false)
    }
  }, [searchQuery, selectedVersion])

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current || isLoadingMore || isSearching) return
    fetchModpacks(offsetRef.current, false)
  }, [fetchModpacks, isLoadingMore, isSearching])

  const loadCustomModpack = async () => {
    if (customModpackLoadedRef.current) return
    customModpackLoadedRef.current = true
    try {
      const projectDetails = await invoke<ModrinthProjectDetails>("get_project_details", {
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
        display_categories: [],
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
      const stableVersions = versions.filter(v => /^1\.\d+(\.\d+)?$/.test(v))
      onSetAvailableVersions(stableVersions)
    } catch (error) {
      console.error("Failed to load available versions:", error)
    } finally {
      onSetIsLoadingVersions(false)
    }
  }

  const loadModpackGallery = async (projectId: string) => {
    if (modpackGalleries[projectId]) return
    try {
      const projectDetails = await invoke<ModrinthProjectDetails>("get_project_details", { idOrSlug: projectId })
      if (projectDetails.gallery && projectDetails.gallery.length > 0) {
        const sortedGallery = projectDetails.gallery
          .map(img => ({
            url: img.url,
            featured: img.featured,
            title: (img.title || "").toLowerCase(),
            description: (img.description || "").toLowerCase(),
          }))
          .sort((a, b) => {
            if (a.featured && !b.featured) return -1
            if (!a.featured && b.featured) return 1
            const aHasBanner = a.title.includes("banner") || a.description.includes("banner")
            const bHasBanner = b.title.includes("banner") || b.description.includes("banner")
            if (aHasBanner && !bHasBanner) return -1
            if (!aHasBanner && bHasBanner) return 1
            const aHasHeader = a.title.includes("header") || a.description.includes("header")
            const bHasHeader = b.title.includes("header") || b.description.includes("header")
            if (aHasHeader && !bHasHeader) return -1
            if (!aHasHeader && bHasHeader) return 1
            return 0
          })
          .map(img => img.url)
        setModpackGalleries(prev => ({ ...prev, [projectId]: sortedGallery }))
      }
    } catch (error) {
      console.error(`Failed to load gallery for ${projectId}:`, error)
    }
  }

  const displayedHits = useMemo(() => {
    if (!customModpack || searchQuery.trim() || offsetRef.current === 0 && hits.length === 0) {
      return hits
    }
    const withoutCustom = hits.filter(m => m.project_id !== customModpack.project_id)
    if (!searchQuery.trim()) {
      return [customModpack, ...withoutCustom]
    }
    return hits
  }, [hits, customModpack, searchQuery])

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
        if (versions.length > 0) setSelectedModpackVersion(versions[0].id)
      } catch (error) {
        console.error("Failed to load versions:", error)
      } finally {
        setLoadingVersions(prev => { const s = new Set(prev); s.delete(projectId); return s })
      }
    } else {
      setSelectedModpackVersion(modpackVersions[projectId][0]?.id || "")
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
      if (!versions || versions.length === 0) { alert("No versions available"); return }

      const versionId = selectedModpackVersion || versions[0].id
      const instanceName = selectedModpack.title
      const existingInstance = instances.find(i => i.name === instanceName)
      const finalName = existingInstance ? `${instanceName}-${Date.now()}` : instanceName

      setInstallingModpacks(prev => new Set(prev).add(selectedModpack.project_id))
      handleCloseModal()

      if (onShowCreationToast) onShowCreationToast(finalName)

      await invoke("install_modpack", {
        modpackSlug: selectedModpack.slug,
        instanceName: finalName,
        versionId,
        preferredGameVersion: selectedVersion,
      })

      setInstallationStatus(prev => ({ ...prev, [selectedModpack.project_id]: "success" }))
      if (onRefreshInstances) setTimeout(() => onRefreshInstances!(), 500)

      setTimeout(() => {
        setInstallingModpacks(prev => { const s = new Set(prev); s.delete(projectId); return s })
        setInstallationStatus(prev => { const s = { ...prev }; delete s[projectId]; return s })
      }, 3000)
    } catch (error) {
      console.error("Failed to install modpack:", error)
      if (selectedModpack) {
        setInstallationStatus(prev => ({ ...prev, [selectedModpack.project_id]: "error" }))
        setInstallingModpacks(prev => { const s = new Set(prev); s.delete(selectedModpack.project_id); return s })
        setTimeout(() => {
          setInstallationStatus(prev => { const s = { ...prev }; delete s[selectedModpack.project_id]; return s })
        }, 5000)
      }
    }
  }

  const handleCloseModal = () => {
    setIsModalClosing(true)
    setTimeout(() => { setIsModalClosing(false); setSelectedModpack(null) }, 150)
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 rounded-md bg-[var(--bg-tertiary)]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-20 pointer-events-none" strokeWidth={2} />
          <input
            type="text"
            placeholder="Search modpacks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent rounded-md pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition-all relative z-10"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20">
              <Loader2 size={16} className="animate-spin text-[#3b82f6]" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {displayedHits.map((modpack) => {
          const isInstalling = installingModpacks.has(modpack.project_id)
          const status = installationStatus[modpack.project_id]
          const gallery = modpackGalleries[modpack.project_id] || []
          const backgroundImage = gallery.length > 0 ? gallery[0] : null

          return (
            <div key={modpack.project_id} className="relative bg-[var(--bg-tertiary)] rounded-md overflow-hidden transition-all group">
              <div className="relative h-48 overflow-hidden z-0">
                {backgroundImage ? (
                  <img src={backgroundImage} alt={modpack.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[var(--bg-tertiary)] via-[var(--bg-secondary)] to-[#141414] flex items-center justify-center">
                    <Package size={64} className="text-[var(--text-muted)]" strokeWidth={1.5} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              </div>

              <div className="relative bg-[var(--bg-tertiary)] p-4 flex items-center gap-4 z-0">
                <div className="w-14 h-14 rounded overflow-hidden flex-shrink-0">
                  {modpack.icon_url ? (
                    <img src={modpack.icon_url} alt={modpack.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[var(--bg-secondary)] flex items-center justify-center">
                      <Package size={28} className="text-[var(--text-muted)]" strokeWidth={1.5} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-[var(--text-primary)] leading-tight truncate">{modpack.title}</h3>
                  <p className="text-sm text-[var(--text-muted)] leading-tight">by {modpack.author}</p>
                  <p className="text-sm text-[var(--text-muted)] leading-tight">{formatDownloads(modpack.downloads)} downloads</p>
                </div>

                {status === "success" ? (
                  <div className="flex-shrink-0 px-4 py-2 rounded-md font-medium text-sm bg-[#16a34a] text-white">
                    <span className="flex items-center gap-1.5"><CheckCircle size={16} />Installed</span>
                  </div>
                ) : status === "error" ? (
                  <div className="flex-shrink-0 px-4 py-2 rounded-md font-medium text-sm bg-red-600 text-white">
                    <span className="flex items-center gap-1.5"><AlertCircle size={16} />Error</span>
                  </div>
                ) : isInstalling ? (
                  <div className="flex-shrink-0 px-4 py-2 rounded-md font-medium text-sm bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                    <span className="flex items-center gap-1.5"><Loader2 size={16} className="animate-spin" />Installing...</span>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); openModpackModal(modpack) }}
                    className="flex-shrink-0 px-4 py-2 rounded font-medium text-sm bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white transition-colors cursor-pointer shadow-sm"
                  >
                    <span className="flex items-center gap-1.5"><Download size={16} />Install</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="flex items-center justify-center py-4">
        {isLoadingMore && <Loader2 size={20} className="animate-spin text-[#3b82f6]" />}
      </div>

      {/* Install modal */}
      {selectedModpack && (
        <div
          className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop ${isModalClosing ? "closing" : ""}`}
          onClick={handleCloseModal}
        >
          <div
            className={`bg-[var(--bg-secondary)] rounded-md w-full max-w-2xl modal-content ${isModalClosing ? "closing" : ""}`}
            onClick={(e) => e.stopPropagation()}
            style={{ pointerEvents: "auto" }}
          >
            <div className="relative h-64 overflow-hidden rounded-t-md">
              {modpackGalleries[selectedModpack.project_id]?.[0] ? (
                <img src={modpackGalleries[selectedModpack.project_id][0]} alt={selectedModpack.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[var(--bg-tertiary)] via-[var(--bg-secondary)] to-[#141414] flex items-center justify-center">
                  <Package size={80} className="text-[var(--text-muted)]" strokeWidth={1.5} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              <button
                onClick={handleCloseModal}
                className="absolute top-4 right-4 p-1.5 bg-[var(--bg-tertiary)]/80 hover:bg-[var(--bg-hover-strong)] backdrop-blur-sm rounded transition-colors cursor-pointer"
              >
                <X size={20} className="text-[var(--text-primary)]" strokeWidth={2} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-visible">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
                  {selectedModpack.icon_url ? (
                    <img src={selectedModpack.icon_url} alt={selectedModpack.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                      <Package size={32} className="text-[var(--text-muted)]" strokeWidth={1.5} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-[var(--text-primary)] leading-tight">{selectedModpack.title}</h2>
                  <p className="text-sm text-[var(--text-muted)] leading-tight">by {selectedModpack.author}</p>
                  <p className="text-sm text-[var(--text-muted)] leading-tight">{formatDownloads(selectedModpack.downloads)} downloads</p>
                </div>
              </div>

              {selectedModpack.description && (
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{selectedModpack.description}</p>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--text-primary)]">Select version</label>
                {loadingVersions.has(selectedModpack.project_id) ? (
                  <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm py-3.5 px-4 bg-[var(--bg-tertiary)] rounded">
                    <Loader2 size={16} className="animate-spin text-[var(--accent-primary)]" />
                    <span>Loading versions...</span>
                  </div>
                ) : modpackVersions[selectedModpack.project_id]?.length > 0 ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
                      className={`w-full bg-[var(--bg-tertiary)] px-4 py-3.5 pr-10 text-sm text-[var(--text-primary)] focus:outline-none transition-all text-left cursor-pointer ${isVersionDropdownOpen ? "rounded-t" : "rounded"}`}
                    >
                      {(() => {
                        const version = modpackVersions[selectedModpack.project_id].find(v => v.id === selectedModpackVersion)
                        return version ? `${version.name} - ${version.game_versions?.join(", ") || ""}` : selectedModpackVersion
                      })()}
                    </button>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ChevronDown
                        size={18}
                        className={`text-[var(--text-primary)] transition-transform ${isVersionDropdownOpen ? "rotate-180" : ""}`}
                        strokeWidth={3}
                      />
                    </div>
                    {isVersionDropdownOpen && (
                      <div className="absolute z-10 w-full bg-[var(--bg-tertiary)] rounded-b shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                        {modpackVersions[selectedModpack.project_id].map((version) => (
                          <button
                            key={version.id}
                            type="button"
                            onClick={() => { setSelectedModpackVersion(version.id); setIsVersionDropdownOpen(false) }}
                            className="w-full px-4 py-3 text-sm text-left hover:bg-[var(--bg-hover-strong)] transition-colors flex items-center justify-between cursor-pointer text-[var(--text-primary)]"
                          >
                            <span>{version.name} - {version.game_versions?.join(", ")}</span>
                            {selectedModpackVersion === version.id && <Check size={16} className="text-[var(--text-primary)]" strokeWidth={2} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-muted)] py-3">No versions available</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleCloseModal}
                  className="px-5 py-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover-strong)] text-[var(--text-primary)] rounded font-medium text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInstallModpack}
                  disabled={!selectedModpackVersion || loadingVersions.has(selectedModpack.project_id)}
                  className="px-5 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-tertiary)] disabled:cursor-not-allowed disabled:text-[var(--text-muted)] text-white rounded font-medium text-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Download size={16} />
                  Install
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}