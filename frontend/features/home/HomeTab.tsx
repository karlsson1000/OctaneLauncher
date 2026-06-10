import { Package, Plus, ExternalLink, FileArchive, FolderOpen, Copy, Trash2, Play, ChevronRight } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import type { Instance, Snapshot, SnapshotsResponse, AccountInfo } from "../../types"
import { ContextMenu } from "../../components/ui/ContextMenu"
import { ExportModal } from "../instances/ExportModal"

interface HomeTabProps {
  instances: Instance[]
  isAuthenticated: boolean
  activeAccount: AccountInfo | null
  launchingInstanceName: string | null
  runningInstances: Set<string>
  onLaunch: (instance: Instance) => void | Promise<void>
  onDeleteInstance: (name: string) => void
  onCreateNew: () => void
  onShowDetails: (instance: Instance) => void
  onOpenFolderByInstance?: (instance: Instance) => void
  onDuplicateInstance?: (instance: Instance) => void
  onKillInstance?: (instance: Instance) => void
  onNavigateToInstances?: () => void
}

export function HomeTab({
  instances,
  isAuthenticated,
  activeAccount,
  launchingInstanceName,
  runningInstances,
  onLaunch,
  onCreateNew,
  onShowDetails,
  onOpenFolderByInstance,
  onDuplicateInstance,
  onDeleteInstance,
  onKillInstance,
  onNavigateToInstances,
}: HomeTabProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; instance: Instance } | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loadingSnapshots, setLoadingSnapshots] = useState(true)
  const [exportModalInstance, setExportModalInstance] = useState<Instance | null>(null)
  const [instanceIcons, setInstanceIcons] = useState<Record<string, string | null>>({})
  const [tooltipInstance, setTooltipInstance] = useState<Instance | null>(null)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lastPlayedInstance = instances
    .filter(i => i.last_played)
    .sort((a, b) => new Date(b.last_played!).getTime() - new Date(a.last_played!).getTime())[0] ?? null

  const recentInstances = [...instances]
    .filter(i => i.last_played)
    .sort((a, b) => new Date(b.last_played!).getTime() - new Date(a.last_played!).getTime())
    .slice(0, 5)

  useEffect(() => {
    const loadIcons = async () => {
      const icons: Record<string, string | null> = {}
      for (const instance of recentInstances) {
        try {
          icons[instance.name] = await invoke<string | null>("get_instance_icon", { instanceName: instance.name })
        } catch { icons[instance.name] = null }
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
        setSnapshots(data.entries.slice(0, 3))
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

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const diffDays = Math.floor((todayOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return Math.floor(diffDays / 7) === 1 ? "1 week ago" : `${Math.floor(diffDays / 7)} weeks ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
        if (parseInt(major) >= 20) {
          return patch === '0' ? `1.${major}` : `1.${major}.${minor}`
        }
      }
    }
    return instance.version
  }

  const formatPlaytime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
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

  const getGreeting = (): string => {
    const h = new Date().getHours()
    if (h < 12) return "Good morning"
    if (h < 18) return "Good afternoon"
    return "Good evening"
  }

  const isLastPlayedRunning = lastPlayedInstance ? runningInstances.has(lastPlayedInstance.name) : false
  const isLastPlayedLaunching = lastPlayedInstance ? launchingInstanceName === lastPlayedInstance.name : false

  return (
    <div className="p-8 pt-[90px] space-y-10">
      <div className="max-w-7xl mx-auto">

        {/* Bento hero */}
        <div className="w-full h-36 bg-[#22252b] rounded-md blur-border relative flex items-center justify-between px-8">
          {activeAccount && (
            <div className="absolute left-12 bottom-0" style={{ zIndex: 10 }}>
              <img
                src={`https://renders.stellarmc.gg/bust/${activeAccount.username}`}
                alt={activeAccount.username}
                className="h-48 w-auto object-contain"
                style={{ imageRendering: 'pixelated', display: 'block' }}
              />
            </div>
          )}

          {isAuthenticated && activeAccount && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <h2 className="text-3xl font-semibold text-[#e6e6e6] tracking-tight">
                {getGreeting()}, {activeAccount.username}
              </h2>
            </div>
          )}

          <div className="flex-1" />

          {isAuthenticated && lastPlayedInstance && (
            <button
            onClick={() => isLastPlayedRunning && onKillInstance
              ? onKillInstance(lastPlayedInstance)
              : onLaunch(lastPlayedInstance)
            }
            disabled={launchingInstanceName !== null && !isLastPlayedRunning && !isLastPlayedLaunching}
            className={`h-11 px-5 rounded-md flex items-center justify-center gap-3 text-lg font-semibold transition-all active:scale-95 cursor-pointer ${
              isLastPlayedRunning || isLastPlayedLaunching
                ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                : "bg-[#16a34a] text-[#181a1f] hover:bg-[#15803d]"
            } disabled:opacity-40`}
            title={isLastPlayedRunning ? "Stop" : `Play ${lastPlayedInstance.name}`}
          >
            {isLastPlayedLaunching || isLastPlayedRunning
              ? <div className="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
              : <Play size={24} fill="currentColor" strokeWidth={0} />
            }
            <span>{isLastPlayedRunning ? "Stop" : isLastPlayedLaunching ? "Launching..." : lastPlayedInstance.name}</span>
          </button>
          )}
        </div>

      </div>

      {/* Recently Played */}
      {recentInstances.length > 0 && (
        <div className="max-w-7xl mx-auto">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {onNavigateToInstances ? (
                  <button onClick={onNavigateToInstances} className="flex items-center gap-2 cursor-pointer group">
                    <h2 className="text-xl font-semibold text-[#e6e6e6] tracking-tight group-hover:text-white transition-colors">
                      Recently Played
                    </h2>
                    <ChevronRight size={18} className="text-[#7d8590] group-hover:text-white transition-colors" />
                  </button>
                ) : (
                  <h2 className="text-xl font-semibold text-[#e6e6e6] tracking-tight">
                    Recently Played
                  </h2>
                )}
              </div>
              <button
                onClick={onCreateNew}
                className="px-4 h-7 bg-[#4572e3] hover:bg-[#3461d1] text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus size={16} />
                New
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {recentInstances.map((instance) => {
              const isRunning = runningInstances.has(instance.name)
              const isLaunching = launchingInstanceName === instance.name
              const icon = instanceIcons[instance.name]
              return (
                <div
                  key={instance.name}
                  onClick={() => onShowDetails(instance)}
                  onContextMenu={(e) => handleContextMenu(e, instance)}
                  onMouseEnter={() => {
                    tooltipTimerRef.current = setTimeout(() => setTooltipInstance(instance), 1000)
                  }}
                  onMouseLeave={() => {
                    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
                    setTooltipInstance(null)
                  }}
                  className="bg-[#22252b] rounded-md p-2 flex items-center gap-2 hover:bg-[#2a2e36] transition-all cursor-pointer group relative"
                >
                  {tooltipInstance === instance && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 z-50 pointer-events-none">
                      <div className="bg-[#181a1f] rounded-md p-3 mx-2 shadow-xl border border-[#2a2e36]">
                        <div className="text-sm font-medium text-[#e6e6e6] mb-1.5">{instance.name}</div>
                        <div className="space-y-1 text-xs text-[#7d8590]">
                          <div className="flex justify-between gap-4">
                            <span>Version</span>
                            <span className="text-[#e6e6e6]">{getMinecraftVersion(instance)}</span>
                          </div>
                          {instance.loader && (
                            <div className="flex justify-between gap-4">
                              <span>Loader</span>
                              <span className="text-[#e6e6e6] capitalize">{instance.loader}{instance.loader_version ? ` ${instance.loader_version}` : ''}</span>
                            </div>
                          )}
                          <div className="flex justify-between gap-4">
                            <span>Created</span>
                            <span className="text-[#e6e6e6]">{formatDate(instance.created_at)}</span>
                          </div>
                          {instance.total_playtime_seconds !== undefined && instance.total_playtime_seconds > 0 && (
                            <div className="flex justify-between gap-4">
                              <span>Playtime</span>
                              <span className="text-[#e6e6e6]">{formatPlaytime(instance.total_playtime_seconds)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="relative flex-shrink-0">
                    {icon ? (
                      <img src={icon} alt={instance.name} className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 bg-[#181a1f] rounded flex items-center justify-center">
                        <Package size={20} className="text-[#3a3f4b]" />
                      </div>
                    )}
                  </div>
                  <div className={`flex-1 min-w-0 ${isRunning || isLaunching ? 'pr-12' : 'group-hover:pr-12'}`}>
                    <div className="text-sm font-medium text-[#e6e6e6] truncate leading-tight">{instance.name}</div>
                    <div className="text-xs text-[#7d8590] truncate leading-tight mt-0.5">
                      {instance.last_played && formatDate(instance.last_played)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isRunning) onKillInstance?.(instance)
                      else onLaunch(instance)
                    }}
                    disabled={launchingInstanceName !== null && !isLaunching && !isRunning}
                    className={`absolute right-2 flex-shrink-0 w-10 h-10 flex items-center justify-center rounded transition-all active:scale-90 ${
                      isRunning || isLaunching
                        ? "bg-red-500/10 text-red-400 opacity-100 hover:bg-red-500/20 cursor-pointer"
                        : launchingInstanceName !== null
                        ? "opacity-0 pointer-events-none"
                        : "opacity-0 group-hover:opacity-100 bg-[#16a34a] hover:bg-[#15803d] text-[#181a1f] cursor-pointer"
                    }`}
                    title={isRunning ? "Stop instance" : "Launch instance"}
                  >
                    {isLaunching || isRunning ? (
                      <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                    ) : (
                      <Play size={20} fill="currentColor" strokeWidth={0} />
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Snapshots */}
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-[#e6e6e6] tracking-tight">Latest Snapshots</h2>
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
          <div className="grid grid-cols-3 gap-4">
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
                      <Package size={48} className="text-[#3a3f4b]" strokeWidth={2} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="p-4 flex-1 flex flex-col relative z-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-[#e6e6e6] truncate">{cleanVersionName(snapshot.version)}</h3>
                    {snapshot.date && <span className="text-xs text-[#7d8590] whitespace-nowrap">{formatDate(snapshot.date)}</span>}
                  </div>
                  {snapshot.shortText && <p className="text-xs text-[#7d8590] line-clamp-2 leading-snug">{snapshot.shortText}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
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