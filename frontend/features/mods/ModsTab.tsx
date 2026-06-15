import { useState, useEffect, useRef, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Search, Download, Loader2, Package, ChevronDown, Check } from "lucide-react"
import type { Instance, ModrinthSearchResult, ModrinthProject, ModrinthVersion, ModFile } from "../../types"

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
          const icon = await invoke<string | null>("get_instance_icon", { instanceName: instance.name })
          icons[instance.name] = icon
        } catch {
          icons[instance.name] = null
        }
      }
      setInstanceIcons(icons)
    }
    if (instances.length > 0) loadIcons()
  }, [instances])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (instanceSelectorRef.current && !instanceSelectorRef.current.contains(event.target as Node)) {
        setShowInstanceSelector(false)
      }
    }
    if (showInstanceSelector) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showInstanceSelector])

  const getMinecraftVersion = (instance: Instance): string => {
    if (instance.loader === "fabric") {
      const parts = instance.version.split('-')
      return parts[parts.length - 1]
    }
    if (instance.loader === "neoforge") {
      const versionPart = instance.version.replace('neoforge-', '')
      const parts = versionPart.split('-')
      if (parts[0].startsWith('1.')) return parts[0]
      const versionNumbers = parts[0].split('.')
      if (versionNumbers.length >= 2) {
        const major = versionNumbers[0]
        const minor = versionNumbers[1]
        const patch = versionNumbers[2] || '0'
        if (parseInt(major) >= 20) return patch === '0' ? `1.${major}` : `1.${major}.${minor}`
      }
    }
    return instance.version
  }

  const getLoaderDisplay = (instance: Instance): { name: string; color: string } => {
    if (instance.loader === "fabric") return { name: "Fabric", color: "text-[#3b82f6]" }
    if (instance.loader === "neoforge") return { name: "NeoForge", color: "text-[#f97316]" }
    return { name: "Vanilla", color: "text-[#16a34a]" }
  }

  if (!selectedInstance || (selectedInstance.loader !== "fabric" && selectedInstance.loader !== "neoforge")) return null

  const loaderInfo = getLoaderDisplay(selectedInstance)

  return (
    <div className="relative self-center" ref={instanceSelectorRef}>
      <button
        onClick={() => setShowInstanceSelector(!showInstanceSelector)}
        className="flex items-center gap-3 px-2 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] rounded-md text-sm transition-colors cursor-pointer"
      >
        {instanceIcons[selectedInstance.name] ? (
          <img src={instanceIcons[selectedInstance.name]!} alt={selectedInstance.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
            <Package size={26} className="text-[var(--text-muted)]" strokeWidth={2} />
          </div>
        )}
        <div className="text-left min-w-0">
          <div className="font-semibold text-[var(--text-primary)] whitespace-nowrap leading-tight">{selectedInstance.name}</div>
          <div className="flex items-center gap-1 text-xs leading-tight mt-0.5">
            <span className="text-[var(--text-muted)]">{getMinecraftVersion(selectedInstance)}</span>
            <span className="text-[#3a3f4b]">•</span>
            <span className={loaderInfo.color}>{loaderInfo.name}</span>
          </div>
        </div>
        <ChevronDown size={16} className={`text-[var(--text-muted)] ml-auto transition-transform ${showInstanceSelector ? 'rotate-180' : ''}`} strokeWidth={3} />
      </button>
      {showInstanceSelector && (
        <div className="absolute top-full mt-1 right-0 bg-[var(--bg-tertiary)] rounded-md overflow-hidden z-[100] min-w-[240px] max-h-[400px] overflow-y-auto">
          {instances.filter(i => i.loader === "fabric" || i.loader === "neoforge").length === 0 ? (
            <div className="px-3 py-4 text-center bg-[var(--bg-tertiary)]">
              <p className="text-sm text-[var(--text-muted)] mb-1">No modded instances</p>
              <p className="text-xs text-[#3a3f4b]">Create a Fabric or NeoForge instance to install mods</p>
            </div>
          ) : (
            instances.filter(i => i.loader === "fabric" || i.loader === "neoforge").map((instance) => {
              const icon = instanceIcons[instance.name]
              const loader = getLoaderDisplay(instance)
              return (
                <button
                  key={instance.name}
                  onClick={() => { onSetSelectedInstance(instance); setShowInstanceSelector(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm cursor-pointer transition-colors ${selectedInstance.name === instance.name ? "bg-[#3b82f6]/10 text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"}`}
                >
                  {icon ? (
                    <img src={icon} alt={instance.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <Package size={24} className="text-[var(--text-muted)]" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[var(--text-primary)] truncate">{instance.name}</div>
                    <div className="flex items-center gap-1 text-xs">
                      <span>{getMinecraftVersion(instance)}</span>
                      <span>•</span>
                      <span className={loader.color}>{loader.name}</span>
                    </div>
                  </div>
                  {selectedInstance.name === instance.name && <Check size={16} className="flex-shrink-0 text-[#16a34a]" strokeWidth={3} />}
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

export function ModsTab({ selectedInstance, instances, onSetSelectedInstance }: ModsTabProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [hits, setHits] = useState<ModrinthProject[]>([])
  const [, setTotalHits] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [selectedMod, setSelectedMod] = useState<ModrinthProject | null>(null)
  const [modVersions, setModVersions] = useState<ModrinthVersion[]>([])
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [downloadingMods, setDownloadingMods] = useState<Set<string>>(new Set())
  const [installedModFiles, setInstalledModFiles] = useState<Set<string>>(new Set())
  const sentinelRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const offsetRef = useRef(0)
  const hasMoreRef = useRef(true)
  const itemsPerPage = 20

  useEffect(() => {
    if (!selectedInstance || (selectedInstance.loader !== "fabric" && selectedInstance.loader !== "neoforge")) {
      const moddedInstances = instances.filter(i => i.loader === "fabric" || i.loader === "neoforge")
      if (moddedInstances.length > 0) onSetSelectedInstance(moddedInstances[0])
    }
  }, [instances, selectedInstance])

  useEffect(() => {
    if (selectedInstance && (selectedInstance.loader === "fabric" || selectedInstance.loader === "neoforge")) {
      loadInstalledMods()
    }
  }, [selectedInstance])

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    offsetRef.current = 0
    hasMoreRef.current = true
    searchTimeoutRef.current = setTimeout(() => {
      fetchMods(0, true)
    }, hits.length === 0 ? 0 : 300)
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
  }, [searchQuery])

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

  const fetchMods = useCallback(async (offset: number, replace: boolean) => {
    const query = searchQuery.trim()
    if (replace) setIsSearching(true)
    else setIsLoadingMore(true)
    try {
      const result = await invoke<ModrinthSearchResult>("search_mods", {
        query: query || "",
        facets: JSON.stringify([["project_type:mod"]]),
        index: query ? "relevance" : "downloads",
        offset,
        limit: itemsPerPage,
      })
      offsetRef.current = offset + result.hits.length
      hasMoreRef.current = offset + result.hits.length < result.total_hits
      setTotalHits(result.total_hits)
      if (replace) {
        setHits(result.hits)
        setSelectedMod(null)
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
  }, [searchQuery, itemsPerPage])

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current || isLoadingMore || isSearching) return
    fetchMods(offsetRef.current, false)
  }, [fetchMods, isLoadingMore, isSearching])

  const loadInstalledMods = async () => {
    if (!selectedInstance) return
    try {
      const mods = await invoke<ModFile[]>("get_installed_mods", { instanceName: selectedInstance.name })
      setInstalledModFiles(new Set(mods.map(mod => mod.filename)))
    } catch (error) {
      console.error("Failed to load installed mods:", error)
    }
  }

  const getMinecraftVersion = (instance: Instance): string => {
    if (instance.loader === "fabric") {
      const parts = instance.version.split('-')
      return parts[parts.length - 1]
    }
    if (instance.loader === "neoforge") {
      const versionPart = instance.version.replace('neoforge-', '')
      const parts = versionPart.split('-')
      if (parts[0].startsWith('1.')) return parts[0]
      const versionNumbers = parts[0].split('.')
      if (versionNumbers.length >= 2) {
        const major = versionNumbers[0]
        const minor = versionNumbers[1]
        const patch = versionNumbers[2] || '0'
        if (parseInt(major) >= 20) return patch === '0' ? `1.${major}` : `1.${major}.${minor}`
      }
    }
    return instance.version
  }

  const handleModSelect = async (mod: ModrinthProject) => {
    if (!selectedInstance || (selectedInstance.loader !== "fabric" && selectedInstance.loader !== "neoforge")) return
    setSelectedMod(mod)
    setIsLoadingVersions(true)
    try {
      const versions = await invoke<ModrinthVersion[]>("get_mod_versions", {
        idOrSlug: mod.project_id,
        loaders: [selectedInstance.loader],
        gameVersions: [getMinecraftVersion(selectedInstance)],
      })
      setModVersions(versions)
    } catch (error) {
      console.error("Failed to load versions:", error)
    } finally {
      setIsLoadingVersions(false)
    }
  }

  const isModInstalled = (version: ModrinthVersion): boolean =>
    version.files.some(file => installedModFiles.has(file.filename))

  const handleDownloadMod = async (version: ModrinthVersion) => {
    if (!selectedInstance || (selectedInstance.loader !== "fabric" && selectedInstance.loader !== "neoforge")) return
    const primaryFile = version.files.find(f => f.primary) || version.files[0]
    if (!primaryFile) return
    setDownloadingMods(prev => new Set(prev).add(version.id))
    try {
      await invoke<string>("download_mod", {
        instanceName: selectedInstance.name, downloadUrl: primaryFile.url, filename: primaryFile.filename,
      })
      setInstalledModFiles(prev => new Set(prev).add(primaryFile.filename))
    } catch (error) {
      console.error("Download error:", error)
    } finally {
      setDownloadingMods(prev => { const n = new Set(prev); n.delete(version.id); return n })
    }
  }

  const formatDownloads = (downloads: number): string => {
    if (downloads >= 1000000) return `${(downloads / 1000000).toFixed(1)}M`
    if (downloads >= 1000) return `${(downloads / 1000).toFixed(1)}K`
    return downloads.toString()
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 rounded-md bg-[var(--bg-tertiary)]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-20 pointer-events-none" strokeWidth={2} />
          <input
            type="text"
            placeholder="Search mods..."
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            {hits.map((mod) => (
              <div
                key={mod.project_id}
                className={`rounded-md overflow-hidden cursor-pointer transition-all ${selectedMod?.project_id === mod.project_id ? "bg-[var(--bg-elevated)]" : "bg-[var(--bg-tertiary)]"}`}
                onClick={() => handleModSelect(mod)}
              >
                <div className="flex min-h-0 relative z-0">
                  {mod.icon_url ? (
                    <div className="w-24 h-24 flex items-center justify-center flex-shrink-0 rounded m-2">
                      <img src={mod.icon_url} alt={mod.title} className="w-full h-full object-contain rounded" />
                    </div>
                  ) : (
                    <div className="w-24 h-24 bg-gradient-to-br from-[#16a34a]/10 to-[#22c55e]/10 flex items-center justify-center flex-shrink-0 rounded m-2">
                      <Package size={48} className="text-[#16a34a]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 py-2 px-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-0">
                        <h3 className="font-semibold text-base text-[var(--text-primary)] truncate">{mod.title}</h3>
                        <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">by {mod.author}</span>
                      </div>
                      <p className="text-sm text-[var(--text-muted)] line-clamp-2 mb-2">{mod.description}</p>
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="flex items-center gap-1 bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">
                          <Download size={12} />
                          {formatDownloads(mod.downloads)}
                        </span>
                        {mod.categories.slice(0, 2).map((category) => (
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

          {selectedMod && (
            <div className="bg-[var(--bg-tertiary)] rounded-md p-5 sticky top-4 self-start">
              <div className="flex gap-3 mb-4">
                {selectedMod.icon_url && <img src={selectedMod.icon_url} alt={selectedMod.title} className="w-16 h-16 rounded" />}
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold text-[var(--text-primary)] truncate">{selectedMod.title}</h2>
                  <p className="text-sm text-[var(--text-muted)]">by {selectedMod.author}</p>
                </div>
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-4 leading-relaxed">{selectedMod.description}</p>
              <div className="flex gap-2 mb-5 text-xs flex-wrap">
                <span className="flex items-center gap-1 bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">
                  <Download size={12} />
                  {formatDownloads(selectedMod.downloads)}
                </span>
                <span className="bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">{selectedMod.follows.toLocaleString()} followers</span>
              </div>
              <div className="pt-1">
                <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-3">Versions</h3>
                {isLoadingVersions ? (
                  <div className="text-center py-6"><Loader2 size={20} className="animate-spin text-[#3b82f6] mx-auto" /></div>
                ) : modVersions.length === 0 ? (
                  <p className="text-sm text-[#3a3f4b] text-center py-3">No compatible versions</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {modVersions.map((version) => {
                      const installed = isModInstalled(version)
                      const downloading = downloadingMods.has(version.id)
                      return (
                        <div key={version.id} className="bg-[var(--bg-secondary)] rounded p-3 flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[var(--text-primary)] truncate">{version.name}</div>
                            <div className="text-xs text-[#3a3f4b] truncate mt-0.5">
                              {version.loaders.join(', ')} • {selectedInstance ? getMinecraftVersion(selectedInstance) : version.game_versions[0]}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDownloadMod(version)}
                            disabled={!selectedInstance || downloading || installed}
                            className="px-3 py-2 bg-[#16a34a] hover:bg-[#22c55e] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
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