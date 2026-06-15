import { Package, Plus, Search, FolderOpen, Copy, Trash2, ChevronDown, Play, FileArchive, ChevronUp } from "lucide-react"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import type { Instance } from "../../types"
import { ContextMenu } from "../../components/ui/ContextMenu"
import { ExportModal } from "./ExportModal"

type SortOption = "recently-played" | "name-asc" | "name-desc"

const SORT_CYCLE: SortOption[] = ["recently-played", "name-asc", "name-desc"]

const SORT_LABELS: Record<SortOption, string> = {
  "recently-played": "Recently played",
  "name-asc": "Name (A–Z)",
  "name-desc": "Name (Z–A)",
}

interface InstancesTabProps {
  instances: Instance[]
  isAuthenticated: boolean
  launchingInstanceName: string | null
  runningInstances: Set<string>
  onSetSelectedInstance: (instance: Instance) => void
  onLaunch: (instance: Instance) => void | Promise<void>
  onCreateNew: () => void
  onShowDetails: (instance: Instance) => void
  onOpenFolder?: (instance: Instance) => void
  onDuplicateInstance?: (instance: Instance) => void
  onDeleteInstance?: (instanceName: string) => void
  onKillInstance?: (instance: Instance) => void
}

export function InstancesTab({
  instances,
  isAuthenticated,
  launchingInstanceName,
  runningInstances,
  onCreateNew,
  onSetSelectedInstance,
  onLaunch,
  onShowDetails,
  onOpenFolder,
  onDuplicateInstance,
  onDeleteInstance,
  onKillInstance,
}: InstancesTabProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; instance: Instance } | null>(null)
  const [instanceIcons, setInstanceIcons] = useState<Record<string, string | null>>({})
  const [sortBy, setSortBy] = useState<SortOption>("recently-played")
  const [exportModalInstance, setExportModalInstance] = useState<Instance | null>(null)

  const handleCycleSort = () => {
    const currentIndex = SORT_CYCLE.indexOf(sortBy)
    setSortBy(SORT_CYCLE[(currentIndex + 1) % SORT_CYCLE.length])
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
        const major = parseInt(versionNumbers[0])
        const minor = versionNumbers[1]
        const patch = versionNumbers[2]
        if (major >= 22) {
          if (patch && parseInt(patch) !== 0) return `${major}.${minor}.${patch}`
          return minor === '0' ? `${major}` : `${major}.${minor}`
        }
        if (major >= 20) {
          return minor === '0' ? `1.${major}` : `1.${major}.${minor}`
        }
      }
    }
    return instance.version
  }

  const getLoaderBadge = (instance: Instance) => {
    if (instance.loader === "fabric") {
      return (
        <span className="text-[#3b82f6] flex-shrink-0 flex items-center gap-1">
          <img src="/loaders/fabric.png" alt="Fabric" className="w-3.5 h-3.5" />
          Fabric
        </span>
      )
    }
    if (instance.loader === "neoforge") {
      return (
        <span className="text-[#f97316] flex-shrink-0 flex items-center gap-1">
          <img src="/loaders/neoforge.png" alt="NeoForge" className="w-3 h-3" />
          NeoForge
        </span>
      )
    }
    return <span className="text-[#16a34a] flex-shrink-0">Vanilla</span>
  }

  const handleQuickLaunch = (instance: Instance) => {
    onSetSelectedInstance(instance)
    onLaunch(instance)
  }

  useEffect(() => {
    const loadIcons = async () => {
      const icons: Record<string, string | null> = {}
      for (const instance of instances) {
        try {
          const icon = await invoke<string | null>("get_instance_icon", { instanceName: instance.name })
          icons[instance.name] = icon
        } catch (error) {
          icons[instance.name] = null
        }
      }
      setInstanceIcons(icons)
    }
    if (instances.length > 0) loadIcons()
  }, [instances])

  const handleContextMenu = (e: React.MouseEvent, instance: Instance) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, instance })
  }

  const sortedAndFilteredInstances = instances
    .filter(instance => instance.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name)
        case "name-desc":
          return b.name.localeCompare(a.name)
        case "recently-played":
        default: {
          const aTime = (a as any).last_played ? new Date((a as any).last_played).getTime() : 0
          const bTime = (b as any).last_played ? new Date((b as any).last_played).getTime() : 0
          return bTime - aTime
        }
      }
    })

  const sortIsDesc = sortBy === "recently-played" || sortBy === "name-desc"

  return (
    <>
      <div className="p-8 space-y-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {instances.length > 0 && (
                <div className="relative rounded-md bg-[var(--bg-tertiary)]">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-20 pointer-events-none" strokeWidth={2} />
                  <input
                    type="text"
                    placeholder="Search instances..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-72 bg-transparent rounded-md pl-9 pr-3 py-1.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition-all relative z-10"
                  />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {instances.length > 0 && (
                <button
                  onClick={handleCycleSort}
                  className="h-8 px-2.5 hover:bg-[var(--bg-tertiary)] rounded flex items-center gap-1.5 transition-colors cursor-pointer group"
                >
                  <span className="text-sm text-[var(--text-muted)] group-hover:text-[var(--text-muted)] transition-colors font-medium">Sort by:</span>
                  <span className="text-sm text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors font-semibold">{SORT_LABELS[sortBy]}</span>
                  {sortIsDesc
                    ? <ChevronDown size={14} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" strokeWidth={2.5} />
                    : <ChevronUp size={14} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" strokeWidth={2.5} />
                  }
                </button>
              )}
              <button
                onClick={onCreateNew}
                className="px-4 h-8 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus size={16} />
                New
              </button>
            </div>
          </div>

          {instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14">
              <Package size={48} className="text-[var(--text-muted)] mb-3" strokeWidth={1.5} />
              <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">No instances yet</h3>
              <p className="text-sm text-[var(--text-muted)] mb-4">Create your first instance to get started</p>
              <button
                onClick={onCreateNew}
                className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded font-medium text-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={16} strokeWidth={2} />
                <span>Create Instance</span>
              </button>
            </div>
          ) : sortedAndFilteredInstances.length === 0 ? (
            <div className="rounded-md p-8 flex flex-col items-center justify-center">
              <Search size={48} className="text-[var(--text-primary)] mb-3" strokeWidth={1.5} />
              <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">No instances found</h3>
              <p className="text-sm text-[var(--text-muted)]">Try adjusting your search query</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {sortedAndFilteredInstances.map((instance) => {
                const icon = instanceIcons[instance.name]
                const isLaunching = launchingInstanceName === instance.name
                const isRunning = runningInstances.has(instance.name)
                return (
                  <div
                    key={instance.name}
                    onClick={() => { onSetSelectedInstance(instance); onShowDetails(instance) }}
                    onContextMenu={(e) => handleContextMenu(e, instance)}
                    className="bg-[var(--bg-tertiary)] rounded-md flex items-center hover:bg-[var(--bg-hover)] transition-all cursor-pointer group relative overflow-hidden"
                  >
                    <div className="relative flex-shrink-0">
                      {icon ? (
                        <img src={icon} alt={instance.name} className="w-20 h-20 object-cover" />
                      ) : (
                        <div className="w-20 h-20 flex items-center justify-center">
                          <Package size={36} className="text-[var(--text-muted)]" />
                        </div>
                      )}
                    </div>

                    <div className={`py-2 pr-2 pl-4 flex-1 min-w-0 ${isRunning || isLaunching ? 'pr-12' : 'group-hover:pr-12'}`}>
                      <div className="text-base font-medium text-[var(--text-primary)] truncate leading-tight">{instance.name}</div>
                      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mt-0.5">
                        <span>{getMinecraftVersion(instance)}</span>
                        <span className="text-[var(--text-muted)]">•</span>
                        {getLoaderBadge(instance)}
                      </div>
                    </div>

                    {isAuthenticated && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (isRunning && onKillInstance) onKillInstance(instance)
                          else handleQuickLaunch(instance)
                        }}
                        disabled={launchingInstanceName !== null && !isRunning}
                        className={`flex-shrink-0 w-12 h-12 mr-4 flex items-center justify-center rounded transition-all active:scale-95 cursor-pointer ${
                          isRunning || isLaunching
                            ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            : "opacity-0 group-hover:opacity-100 bg-[#16a34a] hover:bg-[#15803d] text-[#181a1f]"
                        } disabled:opacity-50`}
                        title={isRunning ? "Stop instance" : "Launch instance"}
                      >
                        {isLaunching || isRunning ? (
                          <div className="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                        ) : (
                          <Play size={24} fill="currentColor" strokeWidth={0} />
                        )}
                      </button>
                    )}
                  </div>
                )
              })}
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
            { label: "Open", icon: <Package size={16} />, onClick: () => { onSetSelectedInstance(contextMenu.instance); onShowDetails(contextMenu.instance) } },
            { label: "Open Folder", icon: <FolderOpen size={16} />, onClick: () => onOpenFolder?.(contextMenu.instance) },
            { label: "Duplicate", icon: <Copy size={16} />, onClick: () => onDuplicateInstance?.(contextMenu.instance) },
            { label: "Export", icon: <FileArchive size={16} />, onClick: () => setExportModalInstance(contextMenu.instance) },
            { separator: true },
            { label: "Delete", icon: <Trash2 size={16} />, onClick: () => onDeleteInstance?.(contextMenu.instance.name), danger: true },
          ]}
        />
      )}

      {exportModalInstance && (
        <ExportModal
          instanceName={exportModalInstance.name}
          onClose={() => setExportModalInstance(null)}
        />
      )}
    </>
  )
}