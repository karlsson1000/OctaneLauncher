import { Package, Plus, Search, FolderOpen, Copy, Trash2 } from "lucide-react"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import type { Instance } from "../../types"
import { ContextMenu } from "../modals/ContextMenu"

interface InstancesTabProps {
  instances: Instance[]
  selectedInstance: Instance | null
  isAuthenticated: boolean
  onSetSelectedInstance: (instance: Instance) => void
  onLaunch: () => void
  onCreateNew: () => void
  onShowDetails: (instance: Instance) => void
  onOpenFolder?: (instance: Instance) => void
  onDuplicateInstance?: (instance: Instance) => void
  onDeleteInstance?: (instanceName: string) => void
}

export function InstancesTab({
  instances,
  onCreateNew,
  onSetSelectedInstance,
  onShowDetails,
  onOpenFolder,
  onDuplicateInstance,
  onDeleteInstance,
}: InstancesTabProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    instance: Instance
  } | null>(null)
  const [instanceIcons, setInstanceIcons] = useState<Record<string, string | null>>({})

  const getMinecraftVersion = (instance: Instance): string => {
    if (instance.loader === "fabric") {
      const parts = instance.version.split('-')
      return parts[parts.length - 1]
    }
    return instance.version
  }

  // Load icons for all instances
  useEffect(() => {
    const loadIcons = async () => {
      const icons: Record<string, string | null> = {}
      for (const instance of instances) {
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

    if (instances.length > 0) {
      loadIcons()
    }
  }, [instances])

  const handleContextMenu = (e: React.MouseEvent, instance: Instance) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      instance,
    })
  }

  const filteredInstances = instances.filter(instance =>
    instance.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-6 space-y-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#e8e8e8] tracking-tight">Instances</h1>
            <p className="text-sm text-[#808080] mt-0.5">Manage all your instances</p>
          </div>
          <button
            onClick={onCreateNew}
            className="w-10 h-10 hover:bg-[#1a1a1a] text-[#e8e8e8] rounded-lg flex items-center justify-center transition-all cursor-pointer"
            title="New Instance"
          >
            <Plus size={28} strokeWidth={2} />
          </button>
        </div>

        {instances.length > 0 && (
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a4a]" strokeWidth={2} />
            <input
              type="text"
              placeholder="Search instances..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-10 pr-4 py-2.5 text-sm text-[#e8e8e8] placeholder-[#4a4a4a] focus:outline-none focus:border-[#16a34a] transition-colors"
            />
          </div>
        )}

        {instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-300px)]">
            <Package size={64} className="text-[#16a34a] mb-4" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-[#e8e8e8] mb-1">No instances yet</h3>
            <p className="text-sm text-[#808080] mb-4">Create your first instance to get started</p>
            <button
              onClick={onCreateNew}
              className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus size={16} strokeWidth={2} />
              <span>Create Instance</span>
            </button>
          </div>
        ) : filteredInstances.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-12 flex flex-col items-center justify-center">
            <Search size={64} className="text-[#16a34a] mb-4" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-[#e8e8e8] mb-1">No instances found</h3>
            <p className="text-sm text-[#808080]">Try adjusting your search query</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
            {filteredInstances.map((instance) => {
              const icon = instanceIcons[instance.name]
              return (
                <div
                  key={instance.name}
                  onClick={() => {
                    onSetSelectedInstance(instance)
                    onShowDetails(instance)
                  }}
                  onContextMenu={(e) => handleContextMenu(e, instance)}
                  className={`group relative aspect-[3/4] bg-[#1a1a1a] border rounded-xl overflow-hidden cursor-pointer transition-all ${
                    instance.loader === "fabric"
                      ? "border-[#2a2a2a] hover:border-[#3b82f6]"
                      : "border-[#2a2a2a] hover:border-[#16a34a]"
                  }`}
                >
                  {icon ? (
                    <img
                      src={icon}
                      alt={instance.name}
                      className="absolute inset-0 w-full h-full object-contain p-4"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Package size={64} className="text-[#4a4a4a]" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-3">
                    <h3 className="text-sm font-semibold text-[#e8e8e8] truncate mb-0.5">{instance.name}</h3>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[#808080]">{getMinecraftVersion(instance)}</span>
                      <span className="text-[#4a4a4a]">•</span>
                      {instance.loader === "fabric" ? (
                        <span className="text-[#3b82f6]">Fabric</span>
                      ) : (
                        <span className="text-[#16a34a]">Vanilla</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: "Open",
              icon: <Package size={16} />,
              onClick: () => {
                onSetSelectedInstance(contextMenu.instance)
                onShowDetails(contextMenu.instance)
              },
            },
            {
              label: "Open Folder",
              icon: <FolderOpen size={16} />,
              onClick: () => {
                if (onOpenFolder) {
                  onOpenFolder(contextMenu.instance)
                }
              },
            },
            {
              label: "Duplicate",
              icon: <Copy size={16} />,
              onClick: () => {
                if (onDuplicateInstance) {
                  onDuplicateInstance(contextMenu.instance)
                }
              },
            },
            { separator: true },
            {
              label: "Delete",
              icon: <Trash2 size={16} />,
              onClick: () => {
                if (onDeleteInstance) {
                  onDeleteInstance(contextMenu.instance.name)
                }
              },
              danger: true,
            },
          ]}
        />
      )}
    </div>
  )
}