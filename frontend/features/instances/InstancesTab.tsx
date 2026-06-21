import { Package, Plus, Search, FolderOpen, Copy, Trash2, ChevronDown, Play, FileArchive, ChevronUp, FolderPlus, FolderSymlink, FolderX } from "lucide-react"
import { useState, useEffect, useRef, useMemo } from "react"
import { invoke } from "@tauri-apps/api/core"
import type { Instance } from "../../types"
import { ContextMenu } from "../../components/ui/ContextMenu"
import { ExportModal } from "./ExportModal"
import { storeGet, storeSet } from "../../lib/store"

type SortOption = "recently-played" | "name-asc" | "name-desc"

const SORT_CYCLE: SortOption[] = ["recently-played", "name-asc", "name-desc"]

const SORT_LABELS: Record<SortOption, string> = {
  "recently-played": "Recently played",
  "name-asc": "Name (A–Z)",
  "name-desc": "Name (Z–A)",
}

const DEFAULT_GROUP = "__ungrouped__"

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

  const [groups, setGroups] = useState<Record<string, string[]>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const groupsRef = useRef(groups)
  groupsRef.current = groups

  useEffect(() => {
    storeGet<Record<string, string[]>>("instance_groups").then(g => { if (g) setGroups(g) })
    storeGet<Record<string, boolean>>("group_collapsed").then(c => { if (c) setCollapsed(c) })
  }, [])

  const [groupModal, setGroupModal] = useState<{ instance: Instance } | null>(null)
  const [groupModalValue, setGroupModalValue] = useState("")
  const groupModalInputRef = useRef<HTMLInputElement>(null)

  const [groupContextMenu, setGroupContextMenu] = useState<{ x: number; y: number; group: string } | null>(null)

  const persistGroups = async (next: Record<string, string[]>) => {
    setGroups(next)
    await storeSet("instance_groups", next)
  }

  const persistCollapsed = async (next: Record<string, boolean>) => {
    setCollapsed(next)
    await storeSet("group_collapsed", next)
  }

  const handleCycleSort = () => {
    const currentIndex = SORT_CYCLE.indexOf(sortBy)
    setSortBy(SORT_CYCLE[(currentIndex + 1) % SORT_CYCLE.length])
  }

  const handleCreateGroup = async (instance: Instance, name: string) => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === DEFAULT_GROUP) return
    const next = { ...groups }
    for (const key of Object.keys(next)) {
      next[key] = next[key].filter(n => n !== instance.name)
    }
    next[trimmed] = [...(next[trimmed] ?? []), instance.name]
    await persistGroups(next)
  }

  const handleMoveToGroup = async (instance: Instance, group: string) => {
    const next = { ...groups }
    for (const key of Object.keys(next)) {
      next[key] = next[key].filter(n => n !== instance.name)
    }
    next[group] = [...(next[group] ?? []), instance.name]
    await persistGroups(next)
  }

  const handleRemoveFromGroup = async (instance: Instance) => {
    const next = { ...groups }
    for (const key of Object.keys(next)) {
      next[key] = next[key].filter(n => n !== instance.name)
    }
    await persistGroups(next)
  }

  const handleDeleteGroup = async (group: string) => {
    const next = { ...groups }
    delete next[group]
    await persistGroups(next)
    setGroupContextMenu(null)
  }

  const toggleCollapsed = async (group: string) => {
    await persistCollapsed({ ...collapsed, [group]: !collapsed[group] })
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
    if (instance.loader === "forge") {
      return instance.version.split('-forge-')[0] || instance.version
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
    if (instance.loader === "forge") {
      return (
        <span className="text-[#e05d2e] flex-shrink-0 flex items-center gap-1">
          <img src="/loaders/forge.png" alt="Forge" className="w-3 h-3" />
          Forge
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
        } catch {
          icons[instance.name] = null
        }
      }
      setInstanceIcons(icons)
    }
    if (instances.length > 0) loadIcons()
  }, [instances])

  useEffect(() => {
    if (groupModal) {
      setTimeout(() => groupModalInputRef.current?.focus(), 50)
    }
  }, [groupModal])

  useEffect(() => {
    const nameSet = new Set(instances.map(i => i.name))
    let changed = false
    const next: Record<string, string[]> = {}
    for (const [group, names] of Object.entries(groupsRef.current)) {
      const filtered = names.filter(n => nameSet.has(n))
      if (filtered.length !== names.length) changed = true
      if (filtered.length > 0) next[group] = filtered
    }
    if (changed) persistGroups(next)
  }, [instances])

  const handleContextMenu = (e: React.MouseEvent, instance: Instance) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, instance })
  }

  const handleGroupHeaderContextMenu = (e: React.MouseEvent, group: string) => {
    e.preventDefault()
    setGroupContextMenu({ x: e.clientX, y: e.clientY, group })
  }

  const sortInstances = (list: Instance[]) =>
    [...list].sort((a, b) => {
      switch (sortBy) {
        case "name-asc": return a.name.localeCompare(b.name)
        case "name-desc": return b.name.localeCompare(a.name)
        case "recently-played":
        default: {
          const aTime = (a as any).last_played ? new Date((a as any).last_played).getTime() : 0
          const bTime = (b as any).last_played ? new Date((b as any).last_played).getTime() : 0
          return bTime - aTime
        }
      }
    })

  const filteredInstances = instances.filter(i =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const instanceToGroup = useMemo(() => {
    const map = new Map<string, string>()
    for (const [group, names] of Object.entries(groups)) {
      for (const name of names) {
        map.set(name, group)
      }
    }
    return map
  }, [groups])

  const namedGroups = Object.keys(groups)
  const ungrouped = filteredInstances.filter(i => (instanceToGroup.get(i.name) ?? DEFAULT_GROUP) === DEFAULT_GROUP)
  const hasAnyGroups = namedGroups.length > 0

  const visibleNamedGroups = namedGroups.map(group => ({
    name: group,
    instances: sortInstances(filteredInstances.filter(i => instanceToGroup.get(i.name) === group)),
  }))

  const sortIsDesc = sortBy === "recently-played" || sortBy === "name-desc"

  const renderInstanceCard = (instance: Instance) => {
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
  }

  const renderGroupHeader = (group: string) => {
    const isCollapsed = collapsed[group]

    return (
      <div
        className="flex items-center gap-1.5 mb-2 select-none"
        onContextMenu={(e) => handleGroupHeaderContextMenu(e, group)}
      >
        <ChevronDown
          size={16}
          strokeWidth={3}
          className={`text-[var(--text-muted)] flex-shrink-0 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
        />
        <span className="text-sm font-semibold text-[var(--text-muted)] truncate cursor-pointer" onClick={() => toggleCollapsed(group)}>{group}</span>
      </div>
    )
  }

  const instanceGroup = contextMenu ? (instanceToGroup.get(contextMenu.instance.name) ?? DEFAULT_GROUP) : null

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
          ) : filteredInstances.length === 0 ? (
            <div className="rounded-md p-8 flex flex-col items-center justify-center">
              <Search size={48} className="text-[var(--text-primary)] mb-3" strokeWidth={1.5} />
              <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">No instances found</h3>
              <p className="text-sm text-[var(--text-muted)]">Try adjusting your search query</p>
            </div>
          ) : (
            <div className="space-y-5">
              {visibleNamedGroups.map(({ name, instances: groupInstances }) => (
                <div key={name}>
                  {renderGroupHeader(name)}
                  {!collapsed[name] && (
                    <div className="grid grid-cols-2 gap-3">
                      {groupInstances.map(renderInstanceCard)}
                    </div>
                  )}
                </div>
              ))}

              {ungrouped.length > 0 && (
                <div>
                  {hasAnyGroups && (
                    <div
                      className="flex items-center gap-1.5 mb-2 select-none"
                    >
                      <ChevronDown
                        size={16}
                        strokeWidth={3}
                        className={`text-[var(--text-muted)] flex-shrink-0 transition-transform duration-150 ${collapsed[DEFAULT_GROUP] ? '-rotate-90' : ''}`}
                      />
                      <span className="text-sm font-semibold text-[var(--text-muted)] cursor-pointer" onClick={() => toggleCollapsed(DEFAULT_GROUP)}>Ungrouped</span>
                    </div>
                  )}
                  {!collapsed[DEFAULT_GROUP] && (
                    <div className="grid grid-cols-2 gap-3">
                      {sortInstances(ungrouped).map(renderInstanceCard)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Instance context menu */}
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
            { separator: true as const },
            {
              label: "Create group",
              icon: <FolderPlus size={16} />,
              onClick: () => {
                setGroupModal({ instance: contextMenu.instance })
                setGroupModalValue("")
                setContextMenu(null)
              },
            },
            ...(instanceGroup !== DEFAULT_GROUP ? [
              {
                label: "Remove from group",
                icon: <FolderX size={16} />,
                onClick: () => { handleRemoveFromGroup(contextMenu.instance); setContextMenu(null) },
                danger: true,
              },
            ] : []),
            ...(namedGroups.length > 0 ? [
              { separator: true as const },
              ...namedGroups
                .filter(g => g !== instanceGroup)
                .map(g => ({
                  label: `Move to "${g}"`,
                  icon: <FolderSymlink size={16} />,
                  onClick: () => { handleMoveToGroup(contextMenu.instance, g); setContextMenu(null) },
                })),
            ] : []),
            { separator: true as const },
            { label: "Delete", icon: <Trash2 size={16} />, onClick: () => onDeleteInstance?.(contextMenu.instance.name), danger: true },
          ]}
        />
      )}

      {/* Group header context menu */}
      {groupContextMenu && (
        <ContextMenu
          x={groupContextMenu.x}
          y={groupContextMenu.y}
          onClose={() => setGroupContextMenu(null)}
          items={[
            {
              label: "Delete group",
              icon: <Trash2 size={16} />,
              onClick: () => handleDeleteGroup(groupContextMenu.group),
              danger: true,
            },
          ]}
        />
      )}

      {/* Create group modal */}
      {groupModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setGroupModal(null)}
        >
          <div
            className="bg-[var(--bg-secondary)] rounded-lg p-5 w-80 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Create group</h3>
            <input
              ref={groupModalInputRef}
              type="text"
              placeholder="Group name"
              value={groupModalValue}
              onChange={e => setGroupModalValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && groupModalValue.trim()) {
                  handleCreateGroup(groupModal.instance, groupModalValue)
                  setGroupModal(null)
                }
                if (e.key === "Escape") setGroupModal(null)
              }}
              className="w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-md px-3 py-2 text-sm outline-none border border-transparent focus:border-[var(--accent-primary)] transition-colors"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setGroupModal(null)}
                className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (groupModalValue.trim()) {
                    handleCreateGroup(groupModal.instance, groupModalValue)
                    setGroupModal(null)
                  }
                }}
                disabled={!groupModalValue.trim()}
                className="px-3 py-1.5 text-sm bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
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