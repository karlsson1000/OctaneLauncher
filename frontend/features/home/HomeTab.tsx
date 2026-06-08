import { Package, Plus, FolderOpen, Copy, Trash2, Play, ExternalLink, LayoutGrid, LayoutList, FileArchive } from "lucide-react"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import type { Instance, Snapshot, SnapshotsResponse } from "../../types"
import { ContextMenu } from "../../components/ui/ContextMenu"
import { ExportModal } from "../instances/ExportModal"

interface HomeTabProps {
  instances: Instance[]
  isAuthenticated: boolean
  launchingInstanceName: string | null
  runningInstances: Set<string>
  onLaunch: (instance: Instance) => void | Promise<void>
  onDeleteInstance: (name: string) => void
  onCreateNew: () => void
  onShowDetails: (instance: Instance) => void
  onOpenFolderByInstance?: (instance: Instance) => void
  onDuplicateInstance?: (instance: Instance) => void
  onKillInstance?: (instance: Instance) => void
}

export function HomeTab({
  instances,
  isAuthenticated,
  launchingInstanceName,
  runningInstances,
  onLaunch,
  onCreateNew,
  onShowDetails,
  onOpenFolderByInstance,
  onDuplicateInstance,
  onDeleteInstance,
  onKillInstance,
}: HomeTabProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; instance: Instance } | null>(null)
  const [instanceIcons, setInstanceIcons] = useState<Record<string, string | null>>({})
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loadingSnapshots, setLoadingSnapshots] = useState(true)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [exportModalInstance, setExportModalInstance] = useState<Instance | null>(null)

  const recentInstances = instances
    .filter(instance => instance.last_played)
    .sort((a, b) => {
      const timeA = a.last_played ? new Date(a.last_played).getTime() : 0
      const timeB = b.last_played ? new Date(b.last_played).getTime() : 0
      return timeB - timeA
    })
    .slice(0, 5)

  useEffect(() => {
    const loadIcons = async () => {
      const icons: Record<string, string | null> = {}
      for (const instance of recentInstances) {
        try {
          const icon = await invoke<string | null>("get_instance_icon", { instanceName: instance.name })
          icons[instance.name] = icon
        } catch {
          icons[instance.name] = null
        }
      }
      setInstanceIcons(icons)
    }
    if (recentInstances.length > 0) loadIcons()
  }, [instances])

  useEffect(() => {
    const loadSnapshots = async () => {
      try {
        const response = await fetch('https://launchercontent.mojang.com/v2/javaPatchNotes.json')
        const data: SnapshotsResponse = await response.json()
        setSnapshots(data.entries.slice(0, 4))
      } catch (error) {
        console.error('Failed to load snapshots:', error)
      } finally {
        setLoadingSnapshots(false)
      }
    }
    loadSnapshots()
  }, [])

  const handleContextMenu = (e: React.MouseEvent, instance: Instance) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, instance })
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

  const getLoaderBadge = (instance: Instance) => {
    if (instance.loader === "fabric") {
      return (
        <span className="text-[#3b82f6] flex-shrink-0 flex items-center gap-1">
          <img src="/loaders/fabric.png" alt="Fabric" className="w-3.5 h-3.5" />
          {"Fabric"}
        </span>
      )
    }
    if (instance.loader === "neoforge") {
      return (
        <span className="text-[#f97316] flex-shrink-0 flex items-center gap-1">
          <img src="/loaders/neoforge.png" alt="NeoForge" className="w-3 h-3" />
          {"NeoForge"}
        </span>
      )
    }
    return <span className="text-[#16a34a] flex-shrink-0">{"Vanilla"}</span>
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const diffDays = Math.floor((todayOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`
    if (diffDays < 30) return Math.floor(diffDays / 7) === 1 ? "1 week ago" : `${Math.floor(diffDays / 7)} weeks ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const cleanVersionName = (version: string): string =>
    version.replace('Minecraft Java Edition', '').replace('| Minecraft', '').replace('Minecraft:', '').replace('Minecraft', '').trim()

  const getVersionUrl = (version: string): string => {
    const cleanVersion = cleanVersionName(version)
    const isSnapshot = /\d+w\d+[a-z]?/.test(cleanVersion) || cleanVersion.toLowerCase().includes('snapshot')
    const urlVersion = cleanVersion.replace(/\./g, '-').toLowerCase()
    if (isSnapshot) {
      return /\d+w\d+[a-z]?/.test(cleanVersion)
        ? `https://www.minecraft.net/en-us/article/minecraft-snapshot-${urlVersion}`
        : `https://www.minecraft.net/en-us/article/minecraft-${urlVersion}`
    }
    return `https://www.minecraft.net/en-us/article/minecraft-java-edition-${urlVersion}`
  }

  return (
    <div className="p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#e6e6e6] tracking-tight">Home</h1>
            <p className="text-sm text-[#7d8590] mt-0.5">Recently played instances</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className="w-8.5 h-8.5 hover:bg-[#22252b] text-[#7d8590] hover:text-[#e6e6e6] rounded flex items-center justify-center transition-colors cursor-pointer"
              title={viewMode === "grid" ? "List View" : "Grid View"}
            >
              {viewMode === "grid" ? <LayoutList size={22} /> : <LayoutGrid size={22} />}
            </button>
            <button
              onClick={onCreateNew}
              className="px-4 h-8 bg-[#4572e3] hover:bg-[#3461d1] text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Plus size={16} />
              New
            </button>
          </div>
        </div>

        <div>
          {recentInstances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14">
              <Package size={48} className="text-[#7d8590] mb-3" strokeWidth={1.5} />
              <h3 className="text-base font-semibold text-[#e6e6e6] mb-1">No recently played instances</h3>
              <p className="text-sm text-[#7d8590] mb-4">Launch an instance to see it here</p>
              <button
                onClick={onCreateNew}
                className="px-4 py-2 bg-[#4572e3] hover:bg-[#3461d1] text-white rounded font-medium text-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={16} strokeWidth={2} />
                <span>Create Instance</span>
              </button>
            </div>
          ) : (
            <>
              {viewMode === "grid" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {recentInstances.map((instance) => {
                    const icon = instanceIcons[instance.name]
                    const isLaunching = launchingInstanceName === instance.name
                    const isRunning = runningInstances.has(instance.name)
                    return (
                      <div
                        key={instance.name}
                        onClick={() => onShowDetails(instance)}
                        onContextMenu={(e) => handleContextMenu(e, instance)}
                        className="blur-border group relative bg-[#22252b] rounded-md overflow-hidden cursor-pointer transition-all"
                      >
                        <div className="aspect-square bg-[#181a1f] flex items-center justify-center overflow-hidden relative z-0">
                          {icon ? <img src={icon} alt={instance.name} className="w-full h-full object-cover" /> : <Package size={88} className="text-[#3a3f4b]" strokeWidth={1.5} />}
                        </div>
                        <div className="bg-[#22252b] p-3 flex items-center justify-between gap-2 relative z-0">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-[#e6e6e6] truncate mb-0.5">{instance.name}</h3>
                            <div className="flex items-center gap-1.5 text-xs min-w-0">
                              <span className="text-[#7d8590] truncate">{getMinecraftVersion(instance)}</span>
                              <span className="text-[#3a3f4b] flex-shrink-0">•</span>
                              {getLoaderBadge(instance)}
                            </div>
                          </div>
                          {isAuthenticated && (
                            <button
                              onClick={(e) => { e.stopPropagation(); isRunning && onKillInstance ? onKillInstance(instance) : onLaunch(instance) }}
                              disabled={launchingInstanceName !== null && !isRunning}
                              className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded transition-all cursor-pointer ${isRunning || isLaunching ? "bg-red-500/10 text-red-400" : "bg-[#16a34a]/10 hover:bg-[#16a34a]/20 text-[#16a34a]"} disabled:opacity-50`}
                              title={isRunning ? "Stop instance" : "Launch instance"}
                            >
                              {isLaunching || isRunning ? <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <Play size={18} fill="currentColor" strokeWidth={0} />}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {recentInstances.map((instance) => {
                    const icon = instanceIcons[instance.name]
                    const isLaunching = launchingInstanceName === instance.name
                    const isRunning = runningInstances.has(instance.name)
                    return (
                      <div
                        key={instance.name}
                        onClick={() => onShowDetails(instance)}
                        onContextMenu={(e) => handleContextMenu(e, instance)}
                        className="blur-border group relative bg-[#22252b] rounded-md overflow-hidden cursor-pointer transition-all flex items-center"
                      >
                        <div className="w-20 h-20 bg-[#181a1f] flex items-center justify-center flex-shrink-0 relative z-0">
                          {icon ? <img src={icon} alt={instance.name} className="w-full h-full object-cover" /> : <Package size={32} className="text-[#3a3f4b]" strokeWidth={1.5} />}
                        </div>
                        <div className="flex-1 min-w-0 px-4 py-3 relative z-0">
                          <h3 className="text-base font-semibold text-[#e6e6e6] truncate mb-1">{instance.name}</h3>
                          <div className="flex items-center gap-2 text-sm min-w-0">
                            <span className="text-[#7d8590] truncate">{getMinecraftVersion(instance)}</span>
                            <span className="text-[#3a3f4b] flex-shrink-0">•</span>
                            {getLoaderBadge(instance)}
                          </div>
                        </div>
                        {isAuthenticated && (
                          <div className="px-4">
                            <button
                              onClick={(e) => { e.stopPropagation(); isRunning && onKillInstance ? onKillInstance(instance) : onLaunch(instance) }}
                              disabled={launchingInstanceName !== null && !isRunning}
                              className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded transition-all cursor-pointer ${isRunning || isLaunching ? "bg-red-500/10 text-red-400" : "bg-[#16a34a]/10 hover:bg-[#16a34a]/20 text-[#16a34a]"} disabled:opacity-50`}
                              title={isRunning ? "Stop instance" : "Launch instance"}
                            >
                              {isLaunching || isRunning ? <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <Play size={18} fill="currentColor" strokeWidth={0} />}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-auto">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-[#e6e6e6] tracking-tight">Latest Snapshots</h2>
            <p className="text-sm text-[#7d8590] mt-0.5">Recent Java Edition snapshots</p>
          </div>
          {loadingSnapshots ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#3a3f4b] border-t-[#16a34a] rounded-full animate-spin" />
            </div>
          ) : snapshots.length === 0 ? (
            <div className="bg-[#22252b] rounded-md p-8 text-center">
              <p className="text-[#7d8590]">Unable to load snapshots</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {snapshots.map((snapshot) => (
                <div
                  key={snapshot.id}
                  onClick={async () => {
                    try { await invoke('open_url', { url: getVersionUrl(snapshot.version) }) } catch {}
                  }}
                  className="blur-border bg-[#22252b] rounded-md overflow-hidden relative group cursor-pointer transition-all flex flex-col"
                >
                  <div className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink size={14} className="text-[#e6e6e6]" />
                  </div>
                  <div className="h-40 bg-[#181a1f] overflow-hidden relative flex-shrink-0 z-0">
                    {snapshot.image?.url ? (
                      <img src={`https://launchercontent.mojang.com${snapshot.image.url}`} alt={snapshot.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={48} className="text-[#3a3f4b]" strokeWidth={1.5} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  <div className="p-4 flex-1 flex flex-col relative z-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-[#e6e6e6] truncate">{cleanVersionName(snapshot.version)}</h3>
                      {snapshot.date && <span className="text-xs text-[#7d8590] whitespace-nowrap">{formatDate(snapshot.date)}</span>}
                    </div>
                    {snapshot.shortText && <p className="text-xs text-[#7d8590] line-clamp-3 leading-snug">{snapshot.shortText}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            { label: "Open", icon: <Package size={16} />, onClick: () => onShowDetails(contextMenu.instance) },
            { label: "Open Folder", icon: <FolderOpen size={16} />, onClick: () => onOpenFolderByInstance?.(contextMenu.instance) },
            { label: "Duplicate", icon: <Copy size={16} />, onClick: () => onDuplicateInstance?.(contextMenu.instance) },
            { label: "Export", icon: <FileArchive size={16} />, onClick: () => setExportModalInstance(contextMenu.instance) },
            { separator: true },
            { label: "Delete", icon: <Trash2 size={16} />, onClick: () => onDeleteInstance(contextMenu.instance.name), danger: true },
          ]}
        />
      )}

      {exportModalInstance && (
        <ExportModal instanceName={exportModalInstance.name} onClose={() => setExportModalInstance(null)} />
      )}
    </div>
  )
}