import { useState, useEffect, useRef, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Search, Download, Loader2, Image } from "lucide-react"
import type { Instance, ModrinthSearchResult, ModrinthProject, ModrinthVersion } from "../../types"

interface ResourcePacksTabProps {
  selectedInstance: Instance | null
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
  sourceSelector?: React.ReactNode
  modsSelector?: React.ReactNode
  hideToolbar?: boolean
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

const ITEMS_PER_PAGE = 20

export function ResourcePacksTab({ selectedInstance, sourceSelector, modsSelector, hideToolbar, searchQuery, onSearchQueryChange }: ResourcePacksTabProps) {
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

  const [selectedPack, setSelectedPack] = useState<ModrinthProject | null>(null)
  const [packVersions, setPackVersions] = useState<ModrinthVersion[]>([])
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [downloadingPacks, setDownloadingPacks] = useState<Set<string>>(new Set())
  const [installedPacks, setInstalledPacks] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (selectedInstance) loadInstalledResourcePacks()
  }, [selectedInstance])

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    offsetRef.current = 0
    hasMoreRef.current = true
    searchTimeoutRef.current = setTimeout(() => {
      fetchPacks(0, true)
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

  const fetchPacks = useCallback(async (offset: number, replace: boolean) => {
    const query = debounceSearchQuery.trim()
    if (replace) setIsSearching(true)
    else setIsLoadingMore(true)
    try {
      const result = await invoke<ModrinthSearchResult>("search_mods", {
        query: query || "",
        facets: JSON.stringify([["project_type:resourcepack"]]),
        index: query ? "relevance" : "downloads",
        offset,
        limit: ITEMS_PER_PAGE,
      })
      offsetRef.current = offset + result.hits.length
      hasMoreRef.current = offset + result.hits.length < result.total_hits
      setTotalHits(result.total_hits)
      if (replace) { setHits(result.hits); setSelectedPack(null) }
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
    fetchPacks(offsetRef.current, false)
  }, [fetchPacks, isLoadingMore, isSearching])

  const loadInstalledResourcePacks = async () => {
    if (!selectedInstance) return
    try {
      const packs = await invoke<string[]>("get_installed_resourcepacks", { instanceName: selectedInstance.name })
      setInstalledPacks(new Set(packs))
    } catch (error) {
      console.error("Failed to load installed resource packs:", error)
    }
  }

  const getMinecraftVersion = (instance: Instance): string => {
    if (instance.loader === "fabric") {
      const parts = instance.version.split("-")
      return parts[parts.length - 1]
    }
    if (instance.loader === "neoforge") {
      const versionPart = instance.version.replace("neoforge-", "")
      const parts = versionPart.split("-")
      if (parts[0].startsWith("1.")) return parts[0]
      const versionNumbers = parts[0].split(".")
      if (versionNumbers.length >= 2) {
        const major = versionNumbers[0]
        const minor = versionNumbers[1]
        const patch = versionNumbers[2] || "0"
        if (parseInt(major) >= 20) return patch === "0" ? `1.${major}` : `1.${major}.${minor}`
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

  const isPackInstalled = (version: ModrinthVersion): boolean =>
    version.files.some(file => installedPacks.has(file.filename))

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
      setDownloadingPacks(prev => { const n = new Set(prev); n.delete(version.id); return n })
    }
  }

  const formatDownloads = (downloads: number): string => {
    if (downloads >= 1000000) return `${(downloads / 1000000).toFixed(1)}M`
    if (downloads >= 1000) return `${(downloads / 1000).toFixed(1)}K`
    return downloads.toString()
  }

  if (!selectedInstance) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Image size={64} className="mx-auto mb-4 text-[var(--text-muted)]" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No instance selected</h3>
            <p className="text-sm text-[var(--text-muted)]">Select an instance to manage resource packs</p>
          </div>
        </div>
      </div>
    )
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
            placeholder="Search resource packs..."
            value={searchQuery ?? internalSearchQuery}
            onChange={(e) => onSearchQueryChange ? onSearchQueryChange(e.target.value) : setInternalSearchQuery(e.target.value)}
            className="w-full bg-transparent rounded-md pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition-all relative z-10"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20">
              <Loader2 size={16} className="animate-spin text-[#8b5cf6]" />
            </div>
          )}
        </div>
          {modsSelector}
        </div>
      </div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {hits.map((pack) => (
            <div
              key={pack.project_id}
              className={`rounded-md overflow-hidden cursor-pointer transition-all ${selectedPack?.project_id === pack.project_id ? "bg-[var(--bg-elevated)]" : "bg-[var(--bg-tertiary)]"}`}
              onClick={() => handlePackSelect(pack)}
            >
              <div className="flex min-h-0 relative z-0">
                {pack.icon_url ? (
                  <div className="w-24 h-24 flex items-center justify-center flex-shrink-0 rounded m-2">
                    <img src={pack.icon_url} alt={pack.title} className="w-full h-full object-contain rounded" />
                  </div>
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-[#8b5cf6]/10 to-[#a78bfa]/10 flex items-center justify-center flex-shrink-0 rounded m-2">
                    <Image size={48} className="text-[#8b5cf6]" />
                  </div>
                )}
                <div className="flex-1 min-w-0 py-2 px-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0">
                      <h3 className="font-semibold text-base text-[var(--text-primary)] truncate">{pack.title}</h3>
                      <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">by {pack.author}</span>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] line-clamp-2 mb-2">{pack.description}</p>
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="flex items-center gap-1 bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">
                        <Download size={12} />
                        {formatDownloads(pack.downloads)}
                      </span>
                      {pack.categories.slice(0, 2).map((category) => (
                        <span key={category} className="bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">{category}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div ref={sentinelRef} className="flex items-center justify-center py-4">
            {isLoadingMore && <Loader2 size={20} className="animate-spin text-[#8b5cf6]" />}
          </div>
        </div>

        {selectedPack && (
          <div className="bg-[var(--bg-tertiary)] rounded-md p-3 sticky top-0 self-start">
            <div className="flex gap-3 mb-4">
              {selectedPack.icon_url && (
                <img src={selectedPack.icon_url} alt={selectedPack.title} className="w-16 h-16 rounded" />
              )}
              <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold text-[var(--text-primary)] truncate">{selectedPack.title}</h2>
                <p className="text-sm text-[var(--text-muted)]">by {selectedPack.author}</p>
              </div>
            </div>

            <p className="text-sm text-[var(--text-muted)] mb-4 leading-relaxed">{selectedPack.description}</p>

            <div className="flex gap-2 mb-5 text-xs flex-wrap">
              <span className="flex items-center gap-1 bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">
                <Download size={12} />
                {formatDownloads(selectedPack.downloads)}
              </span>
              <span className="bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">
                {selectedPack.follows.toLocaleString()} followers
              </span>
            </div>

            <div className="pt-4">
              <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-3">Versions</h3>
              {isLoadingVersions ? (
                <div className="text-center py-6">
                  <Loader2 size={20} className="animate-spin text-[#8b5cf6] mx-auto" />
                </div>
              ) : packVersions.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] text-center py-3">No compatible versions</p>
              ) : (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {packVersions.map((version) => {
                    const installed = isPackInstalled(version)
                    const downloading = downloadingPacks.has(version.id)
                    return (
                      <div key={version.id} className="bg-[var(--bg-secondary)] rounded p-3 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[var(--text-primary)] truncate">{version.name}</div>
                          <div className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                            {getMinecraftVersion(selectedInstance)}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownloadPack(version)}
                          disabled={!selectedInstance || downloading || installed}
                          className="px-3 py-2 bg-[#8b5cf6] hover:bg-[#a78bfa] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
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