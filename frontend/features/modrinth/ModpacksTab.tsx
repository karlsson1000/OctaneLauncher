import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Search, Download, Loader2, Package } from "lucide-react"
import type { Instance, ModrinthSearchResult, ModrinthProject, ModrinthVersion, ModrinthProjectDetails } from "../../types"

interface ModpacksTabProps {
  instances: Instance[]
  onRefreshInstances?: () => void
  onShowCreationToast?: (instanceName: string) => void
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
  sourceSelector?: React.ReactNode
  modsSelector?: React.ReactNode
  hideToolbar?: boolean
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

const CUSTOM_MODPACK_SLUG = "stellarmc-enhanced"
const CUSTOM_MODPACK_AUTHOR = "StellarMC"
const ITEMS_PER_PAGE = 20

export function ModpacksTab({
  instances,
  onRefreshInstances,
  onShowCreationToast,
  sourceSelector,
  modsSelector,
  hideToolbar,
  searchQuery,
  onSearchQueryChange,
}: ModpacksTabProps) {
  const [internalSearchQuery, setInternalSearchQuery] = useState("")
  const debounceSearchQuery = searchQuery ?? internalSearchQuery
  const [hits, setHits] = useState<ModrinthProject[]>([])
  const [, setTotalHits] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const offsetRef = useRef(0)
  const hasMoreRef = useRef(true)

  const [selectedModpack, setSelectedModpack] = useState<ModrinthProject | null>(null)
  const [modpackVersions, setModpackVersions] = useState<Record<string, ModrinthVersion[]>>({})
  const [loadingVersions, setLoadingVersions] = useState<Set<string>>(new Set())
  const [installingVersions, setInstallingVersions] = useState<Set<string>>(new Set())
  const [installationStatus, setInstallationStatus] = useState<Record<string, "success" | "error">>({})
  const [customModpack, setCustomModpack] = useState<ModrinthProject | null>(null)
  const customModpackLoadedRef = useRef(false)
  const [, setAvailableVersions] = useState<string[]>([])

  useEffect(() => {
    loadCustomModpack()
    loadAvailableVersions()
  }, [])

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    offsetRef.current = 0
    hasMoreRef.current = true
    searchTimeoutRef.current = setTimeout(() => {
      fetchModpacks(0, true)
    }, hits.length === 0 ? 0 : 300)
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
    }, [debounceSearchQuery])

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
    const query = debounceSearchQuery.trim()
    if (replace) setIsSearching(true)
    else setIsLoadingMore(true)

    try {
      const facets: string[][] = [["project_type:modpack"]]

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
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      if (replace) setIsSearching(false)
      else setIsLoadingMore(false)
    }
  }, [debounceSearchQuery])

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
    } catch (error) {
      console.error("Failed to load custom modpack:", error)
    }
  }

  const loadAvailableVersions = async () => {
    try {
      const versions = await invoke<string[]>("get_modpack_game_versions")
      const stableVersions = versions.filter(v => /^1\.\d+(\.\d+)?$/.test(v))
      setAvailableVersions(stableVersions)
    } catch (error) {
      console.error("Failed to load available versions:", error)
    }
  }

  const displayedHits = useMemo(() => {
    if (!customModpack || debounceSearchQuery.trim() || offsetRef.current === 0 && hits.length === 0) {
      return hits
    }
    const withoutCustom = hits.filter(m => m.project_id !== customModpack.project_id)
    if (!debounceSearchQuery.trim()) {
      return [customModpack, ...withoutCustom]
    }
    return hits
  }, [hits, customModpack, debounceSearchQuery])

  const handleModpackSelect = async (modpack: ModrinthProject) => {
    setSelectedModpack(modpack)
    const projectId = modpack.project_id
    if (!modpackVersions[projectId]) {
      setLoadingVersions(prev => new Set(prev).add(projectId))
      try {
        const versions = await invoke<ModrinthVersion[]>("get_modpack_versions", {
          idOrSlug: modpack.slug,
          gameVersion: null,
        })
        setModpackVersions(prev => ({ ...prev, [projectId]: versions }))
      } catch (error) {
        console.error("Failed to load versions:", error)
      } finally {
        setLoadingVersions(prev => { const s = new Set(prev); s.delete(projectId); return s })
      }
    }
  }

  const handleInstallModpack = async (version: ModrinthVersion, modpack: ModrinthProject) => {
    const instanceName = modpack.title
    const existingInstance = instances.find(i => i.name === instanceName)
    const finalName = existingInstance ? `${instanceName}-${Date.now()}` : instanceName

    setInstallingVersions(prev => new Set(prev).add(version.id))
    if (onShowCreationToast) onShowCreationToast(finalName)

    try {
      await invoke("install_modpack", {
        modpackSlug: modpack.slug,
        instanceName: finalName,
        versionId: version.id,
        preferredGameVersion: null,
      })
      setInstallationStatus(prev => ({ ...prev, [modpack.project_id]: "success" }))
      if (onRefreshInstances) setTimeout(() => onRefreshInstances!(), 500)
      setTimeout(() => {
        setInstallingVersions(prev => { const s = new Set(prev); s.delete(version.id); return s })
        setInstallationStatus(prev => { const s = { ...prev }; delete s[modpack.project_id]; return s })
      }, 3000)
    } catch (error) {
      console.error("Failed to install modpack:", error)
      setInstallationStatus(prev => ({ ...prev, [modpack.project_id]: "error" }))
      setInstallingVersions(prev => { const s = new Set(prev); s.delete(version.id); return s })
      setTimeout(() => {
        setInstallationStatus(prev => { const s = { ...prev }; delete s[modpack.project_id]; return s })
      }, 5000)
    }
  }

  const formatDownloads = (downloads: number): string => {
    if (downloads >= 1000000) return `${(downloads / 1000000).toFixed(1)}M`
    if (downloads >= 1000) return `${(downloads / 1000).toFixed(1)}K`
    return downloads.toString()
  }

  return (
    <div className="max-w-7xl mx-auto">
      {!hideToolbar && <div className="sticky top-0 z-10 bg-[var(--content-bg)] pb-4">
        <div className="flex gap-2 items-stretch">
          {sourceSelector}
        <div className="relative flex-1 rounded-md bg-[var(--bg-tertiary)]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-20 pointer-events-none" strokeWidth={2} />
          <input
            type="text"
            placeholder="Search modpacks..."
            value={searchQuery ?? internalSearchQuery}
            onChange={(e) => onSearchQueryChange ? onSearchQueryChange(e.target.value) : setInternalSearchQuery(e.target.value)}
            className="w-full bg-transparent rounded-md pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition-all relative z-10"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20">
              <Loader2 size={16} className="animate-spin text-[#3b82f6]" />
            </div>
          )}
        </div>
          {modsSelector}
        </div>
      </div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {displayedHits.map((modpack) => (
            <div
              key={modpack.project_id}
              className={`rounded-md overflow-hidden cursor-pointer transition-all ${selectedModpack?.project_id === modpack.project_id ? "bg-[var(--bg-elevated)]" : "bg-[var(--bg-tertiary)]"}`}
              onClick={() => handleModpackSelect(modpack)}
            >
              <div className="flex min-h-0 relative z-0">
                {modpack.icon_url ? (
                  <div className="w-24 h-24 flex items-center justify-center flex-shrink-0 rounded m-2">
                    <img src={modpack.icon_url} alt={modpack.title} className="w-full h-full object-contain rounded" />
                  </div>
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-[#3b82f6]/10 to-[#60a5fa]/10 flex items-center justify-center flex-shrink-0 rounded m-2">
                    <Package size={48} className="text-[#3b82f6]" />
                  </div>
                )}
                <div className="flex-1 min-w-0 py-2 px-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0">
                      <h3 className="font-semibold text-base text-[var(--text-primary)] truncate">{modpack.title}</h3>
                      <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">by {modpack.author}</span>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] line-clamp-2 mb-2">{modpack.description}</p>
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="flex items-center gap-1 bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">
                        <Download size={12} />
                        {formatDownloads(modpack.downloads)}
                      </span>
                      {modpack.categories.slice(0, 2).map((category) => (
                        <span key={category} className="bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">{category}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div ref={sentinelRef} className="flex items-center justify-center py-4">
            {isLoadingMore && <Loader2 size={20} className="animate-spin text-[#3b82f6]" />}
          </div>
        </div>

        {selectedModpack && (
          <div className="bg-[var(--bg-tertiary)] rounded-md p-3 sticky top-0 self-start">
            <div className="flex gap-3 mb-4">
              {selectedModpack.icon_url && (
                <img src={selectedModpack.icon_url} alt={selectedModpack.title} className="w-16 h-16 rounded" />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold text-[var(--text-primary)] truncate">{selectedModpack.title}</h2>
                <p className="text-sm text-[var(--text-muted)]">by {selectedModpack.author}</p>
              </div>
            </div>

            <p className="text-sm text-[var(--text-muted)] mb-4 leading-relaxed">{selectedModpack.description}</p>

            <div className="flex gap-2 mb-5 text-xs flex-wrap">
              <span className="flex items-center gap-1 bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">
                <Download size={12} />
                {formatDownloads(selectedModpack.downloads)}
              </span>
              <span className="bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">{selectedModpack.follows.toLocaleString()} followers</span>
            </div>

            <div className="pt-1">
              <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-3">Versions</h3>
              {loadingVersions.has(selectedModpack.project_id) ? (
                <div className="text-center py-6"><Loader2 size={20} className="animate-spin text-[#3b82f6] mx-auto" /></div>
              ) : modpackVersions[selectedModpack.project_id]?.length > 0 ? (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {modpackVersions[selectedModpack.project_id].map((version) => {
                    const installing = installingVersions.has(version.id)
                    const projectStatus = installationStatus[selectedModpack.project_id]
                    return (
                      <div key={version.id} className="bg-[var(--bg-secondary)] rounded p-3 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[var(--text-primary)] truncate">{version.name}</div>
                          <div className="text-xs text-[#3a3f4b] truncate mt-0.5">{version.game_versions?.join(", ")}</div>
                        </div>
                        <button
                          onClick={() => handleInstallModpack(version, selectedModpack)}
                          disabled={installing}
                          className="px-3 py-2 bg-[#3b82f6] hover:bg-[#60a5fa] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
                        >
                          {installing ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : projectStatus === "success" ? (
                            "Installed"
                          ) : projectStatus === "error" ? (
                            "Error"
                          ) : (
                            <><Download size={14} />Install</>
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-[#3a3f4b] text-center py-3">No versions available</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
