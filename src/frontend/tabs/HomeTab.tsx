import { Package, Plus, FolderOpen, Copy, Trash2, Play, ExternalLink, LayoutGrid, LayoutList, FileArchive } from "lucide-react"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { useTranslation } from "react-i18next"
import type { Instance } from "../../types"
import { ContextMenu } from "../modals/ContextMenu"
import { ExportModal } from "../modals/ExportModal"

interface HomeTabProps {
  instances: Instance[]
  isAuthenticated: boolean
  launchingInstanceName: string | null
  runningInstances: Set<string>
  onLaunch: (instance: Instance) => void | Promise<void>
  onOpenFolder: () => void
  onDeleteInstance: (name: string) => void
  onCreateNew: () => void
  onShowDetails: (instance: Instance) => void
  onOpenFolderByInstance?: (instance: Instance) => void
  onDuplicateInstance?: (instance: Instance) => void
  onRefreshInstances?: () => void
  onKillInstance?: (instance: Instance) => void
}

interface Snapshot {
  id: string
  title: string
  version: string
  type: string
  date?: string
  image?: {
    title: string
    url: string
  }
  body?: string
  contentPath?: string
  shortText?: string
}

interface SnapshotsResponse {
  version: number
  entries: Snapshot[]
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
  const { t } = useTranslation()
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    instance: Instance
  } | null>(null)
  const [instanceIcons, setInstanceIcons] = useState<Record<string, string | null>>({})
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loadingSnapshots, setLoadingSnapshots] = useState(true)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [exportModalInstance, setExportModalInstance] = useState<Instance | null>(null)

  // Get only the 5 most recently played instances
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
          const icon = await invoke<string | null>("get_instance_icon", {
            instanceName: instance.name
          })
          icons[instance.name] = icon
        } catch (error) {
          console.error(`Failed to load icon for ${instance.name}:`, error)
          icons[instance.name] = null
        }
      }
      setInstanceIcons(icons)
    }

    if (recentInstances.length > 0) {
      loadIcons()
    }
  }, [instances])

  // Load snapshots
  useEffect(() => {
    const loadSnapshots = async () => {
      try {
        const response = await fetch('https://launchercontent.mojang.com/v2/javaPatchNotes.json')
        const data: SnapshotsResponse = await response.json()
        // Get the latest 4 snapshots
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
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      instance,
    })
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

  const getLoaderBadge = (instance: Instance) => {
    if (instance.loader === "fabric") {
      return <span className="text-[#3b82f6] flex-shrink-0">{t('common.loaders.fabric')}</span>
    }
    if (instance.loader === "neoforge") {
      return <span className="text-[#f97316] flex-shrink-0">{t('common.loaders.neoforge')}</span>
    }
    return <span className="text-[#16a34a] flex-shrink-0">{t('common.loaders.vanilla')}</span>
  }

  const formatDate = (dateString: string): string => {
      const date = new Date(dateString)
      const now = new Date()

      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      const diffTime = todayOnly.getTime() - dateOnly.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays === 0) return t('common.dates.today')
      if (diffDays === 1) return t('common.dates.yesterday')
      if (diffDays < 7) return t('common.dates.daysAgo', { count: diffDays })
      if (diffDays < 30) return t('common.dates.weeksAgo', { count: Math.floor(diffDays / 7) })

      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

  const cleanVersionName = (version: string): string => {
    // Remove "Minecraft Java Edition" and "| Minecraft" from version string
    return version
      .replace('Minecraft Java Edition', '')
      .replace('| Minecraft', '')
      .replace('Minecraft:', '')
      .replace('Minecraft', '')
      .trim()
  }

  const getVersionUrl = (version: string): string => {
    const cleanVersion = cleanVersionName(version)
    
    // Check if it's a snapshot (contains 'w' pattern like 25w46a or 'snapshot' in name)
    const isSnapshot = /\d+w\d+[a-z]?/.test(cleanVersion) || cleanVersion.toLowerCase().includes('snapshot')
    
    if (isSnapshot) {
      // For snapshots: minecraft-snapshot-25w46a or minecraft-26-1-snapshot-1
      const urlVersion = cleanVersion.replace(/\./g, '-').toLowerCase()
      
      // Check if it's a weekly snapshot (like 25w46a)
      if (/\d+w\d+[a-z]?/.test(cleanVersion)) {
        return `https://www.minecraft.net/en-us/article/minecraft-snapshot-${urlVersion}`
      } else {
        // For numbered snapshots (like 26.1-snapshot-1)
        return `https://www.minecraft.net/en-us/article/minecraft-${urlVersion}`
      }
    } else {
      // For releases: minecraft-java-edition-1-21-4
      const urlVersion = cleanVersion.replace(/\./g, '-').toLowerCase()
      return `https://www.minecraft.net/en-us/article/minecraft-java-edition-${urlVersion}`
    }
  }

  return (
    <div className="p-6 space-y-6">
      <style>{`
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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#e6e6e6] tracking-tight">{t('home.title')}</h1>
            <p className="text-sm text-[#7d8590] mt-0.5">{t('home.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className="w-8.5 h-8.5 hover:bg-[#22252b] text-[#7d8590] hover:text-[#e6e6e6] rounded flex items-center justify-center transition-colors cursor-pointer"
              title={viewMode === "grid" ? t('home.viewMode.list') : t('home.viewMode.grid')}
            >
              {viewMode === "grid" ? <LayoutList size={22} /> : <LayoutGrid size={22} />}
            </button>
            <button
              onClick={onCreateNew}
              className="px-4 h-8 bg-[#4572e3] hover:bg-[#3461d1] text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Plus size={16} />
              {t('home.newButton')}
            </button>
          </div>
        </div>

        {/* Instances Section */}
        <div>
          {recentInstances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14">
              <Package size={48} className="text-[#7d8590] mb-3" strokeWidth={1.5} />
              <h3 className="text-base font-semibold text-[#e6e6e6] mb-1">{t('home.noInstances.title')}</h3>
              <p className="text-sm text-[#7d8590] mb-4">{t('home.noInstances.description')}</p>
              <button
                onClick={onCreateNew}
                className="px-4 py-2 bg-[#4572e3] hover:bg-[#3461d1] text-white rounded font-medium text-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={16} strokeWidth={2} />
                <span>{t('home.noInstances.createButton')}</span>
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
                        {/* Square Image Section */}
                        <div className="aspect-square bg-[#181a1f] flex items-center justify-center overflow-hidden relative z-0">
                          {icon ? (
                            <img
                              src={icon}
                              alt={instance.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package size={88} className="text-[#3a3f4b]" strokeWidth={1.5} />
                          )}
                        </div>
                        
                        {/* Solid Text Section with Play Button */}
                        <div className="bg-[#22252b] p-3 flex items-center justify-between gap-2 relative z-0">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-[#e6e6e6] truncate mb-0.5">{instance.name}</h3>
                            <div className="flex items-center gap-1.5 text-xs min-w-0">
                              <span className="text-[#7d8590] truncate">{getMinecraftVersion(instance)}</span>
                              <span className="text-[#3a3f4b] flex-shrink-0">•</span>
                              {getLoaderBadge(instance)}
                            </div>
                          </div>
                          
                          {/* Play Button */}
                          {isAuthenticated && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (isRunning && onKillInstance) {
                                  onKillInstance(instance)
                                } else {
                                  onLaunch(instance)
                                }
                              }}
                              disabled={launchingInstanceName !== null && !isRunning}
                              className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded transition-all cursor-pointer ${
                                isRunning || isLaunching
                                  ? "bg-red-500/10 text-red-400"
                                  : "bg-[#16a34a]/10 hover:bg-[#16a34a]/20 text-[#16a34a]"
                              } disabled:opacity-50`}
                              title={isRunning ? t('home.instance.stopTooltip') : t('home.instance.launchTooltip')}
                            >
                              {isLaunching || isRunning ? (
                                <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                              ) : (
                                <Play size={18} fill="currentColor" strokeWidth={0} />
                              )}
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
                        {/* Instance Image */}
                        <div className="w-20 h-20 bg-[#181a1f] flex items-center justify-center flex-shrink-0 relative z-0">
                          {icon ? (
                            <img
                              src={icon}
                              alt={instance.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package size={32} className="text-[#3a3f4b]" strokeWidth={1.5} />
                          )}
                        </div>
                        
                        {/* Instance Info */}
                        <div className="flex-1 min-w-0 px-4 py-3 relative z-0">
                          <h3 className="text-base font-semibold text-[#e6e6e6] truncate mb-1">{instance.name}</h3>
                          <div className="flex items-center gap-2 text-sm min-w-0">
                            <span className="text-[#7d8590] truncate">{getMinecraftVersion(instance)}</span>
                            <span className="text-[#3a3f4b] flex-shrink-0">•</span>
                            {getLoaderBadge(instance)}
                          </div>
                        </div>
                        
                        {/* Play Button */}
                        {isAuthenticated && (
                          <div className="px-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (isRunning && onKillInstance) {
                                  onKillInstance(instance)
                                } else {
                                  onLaunch(instance)
                                }
                              }}
                              disabled={launchingInstanceName !== null && !isRunning}
                              className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded transition-all cursor-pointer ${
                                isRunning || isLaunching
                                  ? "bg-red-500/10 text-red-400"
                                  : "bg-[#16a34a]/10 hover:bg-[#16a34a]/20 text-[#16a34a]"
                              } disabled:opacity-50`}
                              title={isRunning ? t('home.instance.stopTooltip') : t('home.instance.launchTooltip')}
                            >
                              {isLaunching || isRunning ? (
                                <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                              ) : (
                                <Play size={18} fill="currentColor" strokeWidth={0} />
                              )}
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

        {/* Snapshots Section */}
        <div className="mt-auto">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-[#e6e6e6] tracking-tight">{t('home.snapshots.title')}</h2>
            <p className="text-sm text-[#7d8590] mt-0.5">{t('home.snapshots.subtitle')}</p>
          </div>

          {loadingSnapshots ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#3a3f4b] border-t-[#16a34a] rounded-full animate-spin" />
            </div>
          ) : snapshots.length === 0 ? (
            <div className="bg-[#22252b] rounded-md p-8 text-center">
              <p className="text-[#7d8590]">{t('home.snapshots.unableToLoad')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {snapshots.map((snapshot) => (
                <div
                  key={snapshot.id}
                  onClick={async () => {
                    try {
                      await invoke('open_url', { url: getVersionUrl(snapshot.version) })
                    } catch (error) {
                      console.error('Failed to open link:', error)
                    }
                  }}
                  className="blur-border bg-[#22252b] rounded-md overflow-hidden relative group cursor-pointer transition-all flex flex-col"
                >
                  {/* External Link Icon */}
                  <div className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink size={14} className="text-[#e6e6e6]" />
                  </div>
                  
                  {/* Snapshot Image */}
                  <div className="h-40 bg-[#181a1f] overflow-hidden relative flex-shrink-0 z-0">
                    {snapshot.image?.url ? (
                      <img
                        src={`https://launchercontent.mojang.com${snapshot.image.url}`}
                        alt={snapshot.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={48} className="text-[#3a3f4b]" strokeWidth={1.5} />
                      </div>
                    )}
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  
                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col relative z-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-[#e6e6e6] truncate">
                        {cleanVersionName(snapshot.version)}
                      </h3>
                      {snapshot.date && (
                        <span className="text-xs text-[#7d8590] whitespace-nowrap">
                          {formatDate(snapshot.date)}
                        </span>
                      )}
                    </div>
                    {snapshot.shortText && (
                      <p className="text-xs text-[#7d8590] line-clamp-3 leading-snug">
                        {snapshot.shortText}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: t('home.contextMenu.open'),
              icon: <Package size={16} />,
              onClick: () => {
                onShowDetails(contextMenu.instance)
              },
            },
            {
              label: t('home.contextMenu.openFolder'),
              icon: <FolderOpen size={16} />,
              onClick: () => {
                if (onOpenFolderByInstance) {
                  onOpenFolderByInstance(contextMenu.instance)
                }
              },
            },
            {
              label: t('home.contextMenu.duplicate'),
              icon: <Copy size={16} />,
              onClick: () => {
                if (onDuplicateInstance) {
                  onDuplicateInstance(contextMenu.instance)
                }
              },
            },
            {
              label: t('home.contextMenu.export'),
              icon: <FileArchive size={16} />,
              onClick: () => {
                setExportModalInstance(contextMenu.instance)
              },
            },
            { separator: true },
            {
              label: t('home.contextMenu.delete'),
              icon: <Trash2 size={16} />,
              onClick: () => {
                onDeleteInstance(contextMenu.instance.name)
              },
              danger: true,
            },
          ]}
        />
      )}

      {/* Export Modal */}
      {exportModalInstance && (
        <ExportModal
          instanceName={exportModalInstance.name}
          onClose={() => setExportModalInstance(null)}
        />
      )}
    </div>
  )
}