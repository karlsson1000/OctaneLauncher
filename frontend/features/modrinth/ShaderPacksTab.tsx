import { useState, useEffect, useRef, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Search, Download, Loader2, Package } from "lucide-react"
import type { Instance, ModrinthSearchResult, ModrinthProject, ModrinthVersion } from "../../types"

interface ShaderPacksTabProps {
  selectedInstance: Instance | null
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
  sourceSelector?: React.ReactNode
  modsSelector?: React.ReactNode
  hideToolbar?: boolean
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

const ITEMS_PER_PAGE = 20

export function ShaderPacksTab({ selectedInstance, sourceSelector, modsSelector, hideToolbar, searchQuery, onSearchQueryChange }: ShaderPacksTabProps) {
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

  const [selectedShader, setSelectedShader] = useState<ModrinthProject | null>(null)
  const [shaderVersions, setShaderVersions] = useState<ModrinthVersion[]>([])
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [downloadingShaders, setDownloadingShaders] = useState<Set<string>>(new Set())
  const [installedShaderFiles, setInstalledShaderFiles] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (selectedInstance) loadInstalledShaders()
  }, [selectedInstance])

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    offsetRef.current = 0
    hasMoreRef.current = true
    searchTimeoutRef.current = setTimeout(() => {
      fetchShaders(0, true)
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

  const fetchShaders = useCallback(async (offset: number, replace: boolean) => {
    const query = debounceSearchQuery.trim()
    if (replace) setIsSearching(true)
    else setIsLoadingMore(true)
    try {
      const result = await invoke<ModrinthSearchResult>("search_mods", {
        query: query || "",
        facets: JSON.stringify([["project_type:shader"]]),
        index: query ? "relevance" : "downloads",
        offset,
        limit: ITEMS_PER_PAGE,
      })
      offsetRef.current = offset + result.hits.length
      hasMoreRef.current = offset + result.hits.length < result.total_hits
      setTotalHits(result.total_hits)
      if (replace) { setHits(result.hits); setSelectedShader(null) }
      else setHits(prev => { const ids = new Set(prev.map(h => h.project_id)); return [...prev, ...result.hits.filter(h => !ids.has(h.project_id))] })
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      if (replace) setIsSearching(false)
      else setIsLoadingMore(false)
    }
  }, [debounceSearchQuery])

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current || isLoadingMore || isSearching) return
    fetchShaders(offsetRef.current, false)
  }, [fetchShaders, isLoadingMore, isSearching])

  const loadInstalledShaders = async () => {
    if (!selectedInstance) return
    try {
      const shaders = await invoke<string[]>("get_installed_shaderpacks", { instanceName: selectedInstance.name })
      setInstalledShaderFiles(new Set(shaders))
    } catch (error) {
      console.error("Failed to load installed shader packs:", error)
    }
  }

  const handleShaderSelect = async (shader: ModrinthProject) => {
    setSelectedShader(shader)
    setIsLoadingVersions(true)
    try {
      const versions = await invoke<ModrinthVersion[]>("get_mod_versions", {
        idOrSlug: shader.project_id,
        loaders: undefined,
      })
      setShaderVersions(versions)
    } catch (error) {
      console.error("Failed to load versions:", error)
    } finally {
      setIsLoadingVersions(false)
    }
  }

  const isShaderInstalled = (version: ModrinthVersion): boolean =>
    version.files.some(file => installedShaderFiles.has(file.filename))

  const handleDownloadShader = async (version: ModrinthVersion) => {
    if (!selectedInstance) return
    const primaryFile = version.files.find(f => f.primary) || version.files[0]
    if (!primaryFile) return
    setDownloadingShaders(prev => new Set(prev).add(version.id))
    try {
      await invoke<string>("download_shaderpack", {
        instanceName: selectedInstance.name, downloadUrl: primaryFile.url, filename: primaryFile.filename,
      })
      setInstalledShaderFiles(prev => new Set(prev).add(primaryFile.filename))
    } catch (error) {
      console.error("Download error:", error)
    } finally {
      setDownloadingShaders(prev => { const n = new Set(prev); n.delete(version.id); return n })
    }
  }

  const formatDownloads = (downloads: number): string => {
    if (downloads >= 1000000) return `${(downloads / 1000000).toFixed(1)}M`
    if (downloads >= 1000) return `${(downloads / 1000).toFixed(1)}K`
    return downloads.toString()
  }

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col">
      {!hideToolbar && <div className="sticky top-0 z-10 bg-[var(--content-bg)] pb-4 flex-shrink-0">
        <div className="flex gap-2 items-stretch">
          {sourceSelector}
        <div className="relative flex-1 rounded-md bg-[var(--bg-tertiary)]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-20 pointer-events-none" strokeWidth={2} />
          <input
            type="text"
            placeholder="Search shader packs..."
            value={searchQuery ?? internalSearchQuery}
            onChange={(e) => onSearchQueryChange ? onSearchQueryChange(e.target.value) : setInternalSearchQuery(e.target.value)}
            className="w-full bg-transparent rounded-md pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition-all relative z-10"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20">
              <Loader2 size={16} className="animate-spin text-[#f59e0b]" />
            </div>
          )}
        </div>
          {modsSelector}
        </div>
      </div>}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-2">
           <div className="lg:col-span-2 space-y-3 overflow-y-auto pr-2">
            {hits.map((shader) => (
              <div
                key={shader.project_id}
                className={`rounded-md overflow-hidden cursor-pointer transition-all ${selectedShader?.project_id === shader.project_id ? "bg-[var(--bg-elevated)]" : "bg-[var(--bg-tertiary)]"}`}
                onClick={() => handleShaderSelect(shader)}
              >
                <div className="flex min-h-0 relative z-0">
                  {shader.icon_url ? (
                    <div className="w-24 h-24 flex items-center justify-center flex-shrink-0 rounded m-2">
                      <img src={shader.icon_url} alt={shader.title} className="w-full h-full object-contain rounded" />
                    </div>
                  ) : (
                    <div className="w-24 h-24 bg-gradient-to-br from-[#f59e0b]/10 to-[#fbbf24]/10 flex items-center justify-center flex-shrink-0 rounded m-2">
                      <Package size={48} className="text-[#f59e0b]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 py-2 px-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-0">
                        <h3 className="font-semibold text-base text-[var(--text-primary)] truncate">{shader.title}</h3>
                        <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">by {shader.author}</span>
                      </div>
                      <p className="text-sm text-[var(--text-muted)] line-clamp-2 mb-2">{shader.description}</p>
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="flex items-center gap-1 bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">
                          <Download size={12} />
                          {formatDownloads(shader.downloads)}
                        </span>
                        {shader.categories.slice(0, 2).map((category) => (
                          <span key={category} className="bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">{category}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div ref={sentinelRef} className="flex items-center justify-center py-4">
              {isLoadingMore && <Loader2 size={20} className="animate-spin text-[#f59e0b]" />}
            </div>
           </div>

          {selectedShader && (
            <div className="bg-[var(--bg-tertiary)] rounded-md p-3 sticky top-0 self-start">
              <div className="flex gap-3 mb-4">
                {selectedShader.icon_url && (
                  <img src={selectedShader.icon_url} alt={selectedShader.title} className="w-16 h-16 rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold text-[var(--text-primary)] truncate">{selectedShader.title}</h2>
                  <p className="text-sm text-[var(--text-muted)]">by {selectedShader.author}</p>
                </div>
              </div>

              <p className="text-sm text-[var(--text-muted)] mb-4 leading-relaxed">{selectedShader.description}</p>
              <div className="flex gap-2 mb-5 text-xs flex-wrap">
                <span className="flex items-center gap-1 bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">
                  <Download size={12} />
                  {formatDownloads(selectedShader.downloads)}
                </span>
                <span className="bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">
                  {selectedShader.follows.toLocaleString()} followers
                </span>
              </div>

              <div className="pt-4">
                <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-3">Versions</h3>
                {isLoadingVersions ? (
                  <div className="text-center py-6">
                    <Loader2 size={20} className="animate-spin text-[#f59e0b] mx-auto" />
                  </div>
                ) : shaderVersions.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] text-center py-3">No compatible versions</p>
                ) : (
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1.5">
                    {shaderVersions.map((version) => {
                      const installed = isShaderInstalled(version)
                      const downloading = downloadingShaders.has(version.id)
                      return (
                        <div key={version.id} className="bg-[var(--bg-secondary)] rounded p-3 flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[var(--text-primary)] truncate">{version.name}</div>
                            <div className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                              {version.game_versions[0]}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDownloadShader(version)}
                            disabled={!selectedInstance || downloading || installed}
                            className="px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
                            style={{ backgroundColor: installed ? "var(--bg-secondary)" : "#f59e0b", color: installed ? "var(--text-muted)" : "white" }}
                          >
                            {downloading ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : installed ? (
                              "Installed"
                            ) : (
                              <><Download size={14} />Install</>
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
    </div>
  )
}