import { useState, useEffect, useRef, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Search, Download, Loader2, Package } from "lucide-react"
import type { Instance, CurseforgeSearchResult, CurseforgeHit, CurseforgeGetModFilesResult, CurseforgeFile } from "../../types"

interface CurseforgeShaderPacksTabProps {
  selectedInstance: Instance | null
  hideToolbar?: boolean
  sourceSelector?: React.ReactNode
  modsSelector?: React.ReactNode
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

const CLASS_ID = 6552
const SEARCH_PLACEHOLDER = "Search shader packs..."

export function CurseforgeShaderPacksTab({ selectedInstance, hideToolbar, sourceSelector, modsSelector, searchQuery, onSearchQueryChange }: CurseforgeShaderPacksTabProps) {
  const [internalSearchQuery, setInternalSearchQuery] = useState("")
  const debounceSearchQuery = searchQuery ?? internalSearchQuery
  const [hits, setHits] = useState<CurseforgeHit[]>([])
  const [, setTotalHits] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const offsetRef = useRef(0)
  const hasMoreRef = useRef(true)
  const itemsPerPage = 20

  const [selectedItem, setSelectedItem] = useState<CurseforgeHit | null>(null)
  const [itemFiles, setItemFiles] = useState<CurseforgeFile[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [downloadingItems, setDownloadingItems] = useState<Set<number>>(new Set())
  const [installedFiles, setInstalledFiles] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (selectedInstance) loadInstalledItems()
  }, [selectedInstance])

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    offsetRef.current = 0
    hasMoreRef.current = true
    searchTimeoutRef.current = setTimeout(() => {
      fetchItems(0, true)
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

  const fetchItems = useCallback(async (offset: number, replace: boolean) => {
    const query = debounceSearchQuery.trim()
    if (replace) setIsSearching(true)
    else setIsLoadingMore(true)
    try {
      const result = await invoke<CurseforgeSearchResult>("search_curseforge_mods", {
        query: query || "",
        classId: CLASS_ID,
        categoryIds: null,
        gameVersion: null,
        modLoaderTypes: null,
        sortField: query ? 4 : 6,
        sortOrder: query ? null : "desc",
        index: offset,
        pageSize: itemsPerPage,
      })
      offsetRef.current = offset + result.data.length
      hasMoreRef.current = offset + result.data.length < result.pagination.totalCount
      setTotalHits(result.pagination.totalCount)
      if (replace) {
        setHits(result.data)
        setSelectedItem(null)
      } else {
        setHits(prev => {
          const ids = new Set(prev.map(h => h.id))
          return [...prev, ...result.data.filter(h => !ids.has(h.id))]
        })
      }
    } catch (error) {
      console.error("CurseForge search error:", error)
    } finally {
      if (replace) setIsSearching(false)
      else setIsLoadingMore(false)
    }
  }, [debounceSearchQuery, itemsPerPage])

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current || isLoadingMore || isSearching) return
    fetchItems(offsetRef.current, false)
  }, [fetchItems, isLoadingMore, isSearching])

  const loadInstalledItems = async () => {
    if (!selectedInstance) return
    try {
      const packs = await invoke<string[]>("get_installed_shaderpacks", { instanceName: selectedInstance.name })
      setInstalledFiles(new Set(packs))
    } catch (error) {
      console.error("Failed to load installed shader packs:", error)
    }
  }

  const handleItemSelect = async (item: CurseforgeHit) => {
    setSelectedItem(item)
    setIsLoadingFiles(true)
    try {
      const result = await invoke<CurseforgeGetModFilesResult>("get_curseforge_mod_files", {
        modId: item.id,
        gameVersion: null,
        modLoaderType: null,
        pageSize: 20,
      })
      setItemFiles(result.data)
    } catch (error) {
      console.error("Failed to load files:", error)
    } finally {
      setIsLoadingFiles(false)
    }
  }

  const isItemInstalled = (file: CurseforgeFile): boolean =>
    installedFiles.has(file.fileName)

  const handleDownload = async (file: CurseforgeFile) => {
    if (!selectedInstance || !file.downloadUrl) return
    setDownloadingItems(prev => new Set(prev).add(file.id))
    try {
      await invoke<string>("download_curseforge_file", {
        instanceName: selectedInstance.name,
        downloadUrl: file.downloadUrl,
        filename: file.fileName,
        targetFolder: "shaderpacks",
      })
      setInstalledFiles(prev => new Set(prev).add(file.fileName))
    } catch (error) {
      console.error("Download error:", error)
    } finally {
      setDownloadingItems(prev => { const n = new Set(prev); n.delete(file.id); return n })
    }
  }

  const formatDownloads = (downloads: number): string => {
    if (downloads >= 1000000) return `${(downloads / 1000000).toFixed(1)}M`
    if (downloads >= 1000) return `${(downloads / 1000).toFixed(1)}K`
    return downloads.toString()
  }

  const releaseTypeLabel = (type: number): string => {
    switch (type) {
      case 1: return "Release"
      case 2: return "Beta"
      case 3: return "Alpha"
      default: return "Other"
    }
  }

  if (!selectedInstance) {
    return (
      <div className="max-w-7xl mx-auto">
        {!hideToolbar && (
        <div className="sticky top-0 z-10 bg-[var(--content-bg)] pb-4">
        <div className="flex gap-2 items-stretch">
          {sourceSelector}
          <div className="relative flex-1 rounded-md bg-[var(--bg-tertiary)]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-20 pointer-events-none" strokeWidth={2} />
            <input
              type="text"
              placeholder={SEARCH_PLACEHOLDER}
              value={searchQuery ?? internalSearchQuery}
              onChange={(e) => onSearchQueryChange ? onSearchQueryChange(e.target.value) : setInternalSearchQuery(e.target.value)}
              className="w-full bg-transparent rounded-md pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition-all relative z-10"
            />
          </div>
          {modsSelector}
        </div>
        </div>
        )}
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Package size={64} className="mx-auto mb-4 text-[var(--text-muted)]" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No instance selected</h3>
            <p className="text-sm text-[var(--text-muted)]">Select an instance to manage shader packs</p>
        </div>
    </div>
    </div>
  )
}

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col">
      {!hideToolbar && (
        <div className="sticky top-0 z-10 bg-[var(--content-bg)] pb-4 flex-shrink-0">
          <div className="flex gap-2 items-stretch">
            {sourceSelector}
          <div className="relative flex-1 rounded-md bg-[var(--bg-tertiary)]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-20 pointer-events-none" strokeWidth={2} />
            <input
              type="text"
              placeholder={SEARCH_PLACEHOLDER}
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
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-2">
        <div className="lg:col-span-2 space-y-3 overflow-y-auto pr-2">
          {hits.map((item) => (
            <div
              key={item.id}
              className={`rounded-md overflow-hidden cursor-pointer transition-all ${selectedItem?.id === item.id ? "bg-[var(--bg-elevated)]" : "bg-[var(--bg-tertiary)]"}`}
              onClick={() => handleItemSelect(item)}
            >
              <div className="flex min-h-0 relative z-0">
                {item.logo?.thumbnailUrl ? (
                  <div className="w-24 h-24 flex items-center justify-center flex-shrink-0 rounded m-2">
                    <img src={item.logo.thumbnailUrl} alt={item.name} className="w-full h-full object-contain rounded" />
                  </div>
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-[#f59e0b]/10 to-[#fbbf24]/10 flex items-center justify-center flex-shrink-0 rounded m-2">
                    <Package size={48} className="text-[#f59e0b]" />
                  </div>
                )}
                <div className="flex-1 min-w-0 py-2 px-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0">
                      <h3 className="font-semibold text-base text-[var(--text-primary)] truncate">{item.name}</h3>
                      <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                        by {item.authors?.[0]?.name || "Unknown"}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] line-clamp-2 mb-2">{item.summary}</p>
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="flex items-center gap-1 bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">
                        <Download size={12} />
                        {formatDownloads(item.downloadCount)}
                      </span>
                      {item.categories?.slice(0, 2).map((cat) => (
                        <span key={cat.name} className="bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">{cat.name}</span>
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

        {selectedItem && (
          <div className="bg-[var(--bg-tertiary)] rounded-md p-3 sticky top-0 self-start">
            <div className="flex gap-3 mb-4">
              {selectedItem.logo?.thumbnailUrl && (
                <img src={selectedItem.logo.thumbnailUrl} alt={selectedItem.name} className="w-16 h-16 rounded" />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold text-[var(--text-primary)] truncate">{selectedItem.name}</h2>
                <p className="text-sm text-[var(--text-muted)]">by {selectedItem.authors?.[0]?.name || "Unknown"}</p>
              </div>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-4 leading-relaxed">{selectedItem.summary}</p>
            <div className="flex gap-2 mb-5 text-xs flex-wrap">
              <span className="flex items-center gap-1 bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">
                <Download size={12} />
                {formatDownloads(selectedItem.downloadCount)}
              </span>
            </div>
            <div className="pt-1">
              <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-3">Files</h3>
              {isLoadingFiles ? (
                <div className="text-center py-6"><Loader2 size={20} className="animate-spin text-[#f59e0b] mx-auto" /></div>
              ) : itemFiles.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] text-center py-3">No files available</p>
              ) : (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1.5">
                  {itemFiles.map((file) => {
                    const installed = isItemInstalled(file)
                    const downloading = downloadingItems.has(file.id)
                    return (
                      <div key={file.id} className="bg-[var(--bg-secondary)] rounded p-3 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[var(--text-primary)] truncate">{file.fileName}</div>
                          <div className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                            {releaseTypeLabel(file.releaseType)} • {(file.fileLength / 1024 / 1024).toFixed(1)} MB
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownload(file)}
                          disabled={!selectedInstance || downloading || installed || !file.downloadUrl}
                          className="px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
                          style={{ backgroundColor: installed ? "var(--bg-secondary)" : "#f59e0b", color: installed ? "var(--text-muted)" : "white" }}
                        >
                          {downloading ? <Loader2 size={14} className="animate-spin" /> : installed ? "Installed" : <><Download size={14} />Install</>}
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