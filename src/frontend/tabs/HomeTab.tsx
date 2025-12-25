import { Package, Play, Plus, Info, ChevronDown, Folder, FolderOpen, Copy, Trash2 } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import type { Instance } from "../../types"
import { ContextMenu } from "../modals/ContextMenu"

interface HomeTabProps {
  selectedInstance: Instance | null
  instances: Instance[]
  isAuthenticated: boolean
  isLaunching: boolean
  onSetSelectedInstance: (instance: Instance) => void
  onLaunch: () => void
  onOpenFolder: () => void
  onDeleteInstance: (name: string) => void
  onCreateNew: () => void
  onShowDetails: (instance: Instance) => void
  onOpenFolderByInstance?: (instance: Instance) => void
  onDuplicateInstance?: (instance: Instance) => void
}

export function HomeTab({
  selectedInstance,
  instances,
  isAuthenticated,
  isLaunching,
  onSetSelectedInstance,
  onLaunch,
  onCreateNew,
  onShowDetails,
  onOpenFolderByInstance,
  onDuplicateInstance,
  onDeleteInstance,
}: HomeTabProps) {
  const [showInstanceDropdown, setShowInstanceDropdown] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    instance: Instance
  } | null>(null)
  const [instanceIcons, setInstanceIcons] = useState<Record<string, string | null>>({})
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowInstanceDropdown(false)
      }
    }

    if (showInstanceDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showInstanceDropdown])

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

  const handleOpenInstanceFolder = async () => {
    if (!selectedInstance) return
    try {
      await invoke("open_instance_folder", { instanceName: selectedInstance.name })
    } catch (error) {
      console.error("Failed to open instance folder:", error)
    }
  }

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
    return instance.version
  }

  return (
    <div className="p-6 space-y-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#e8e8e8] tracking-tight">Home</h1>
            <p className="text-sm text-[#808080] mt-0.5">Recently played instances</p>
          </div>
          <button
            onClick={onCreateNew}
            className="w-10 h-10 hover:bg-[#1a1a1a] text-[#e8e8e8] rounded-lg flex items-center justify-center transition-all cursor-pointer"
            title="New Instance"
          >
            <Plus size={28} strokeWidth={2} />
          </button>
        </div>

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
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {instances.map((instance) => {
              const icon = instanceIcons[instance.name]
              return (
                <div
                  key={instance.name}
                  onClick={() => {
                    onSetSelectedInstance(instance)
                  }}
                  onContextMenu={(e) => handleContextMenu(e, instance)}
                  className={`group relative aspect-[3/4] bg-[#1a1a1a] border rounded-xl overflow-hidden cursor-pointer transition-all ${
                    selectedInstance?.name === instance.name
                      ? instance.loader === "fabric"
                        ? "border-[#3b82f6] ring-1 ring-[#3b82f6]/50 hover:border-[#3b82f6]"
                        : "border-[#16a34a] ring-1 ring-[#16a34a]/50 hover:border-[#16a34a]"
                      : instance.loader === "fabric"
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

        {selectedInstance && (
          <div className="fixed bottom-6 left-64 right-6 z-40 flex items-center gap-3 max-w-3xl mx-auto">
            {/* Left - Instance Selector Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowInstanceDropdown(!showInstanceDropdown)}
                className="flex items-center gap-2.5 px-4 py-2 bg-[#1a1a1a]/95 backdrop-blur-md border border-[#2a2a2a] hover:bg-[#1f1f1f] rounded-lg cursor-pointer transition-colors h-11"
              >
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-[#e8e8e8] whitespace-nowrap leading-tight">{selectedInstance.name}</h3>
                  <div className="flex items-center gap-1 text-xs leading-tight mt-0.5">
                    <span className="text-[#808080]">{getMinecraftVersion(selectedInstance)}</span>
                    <span className="text-[#4a4a4a]">•</span>
                    {selectedInstance.loader === "fabric" ? (
                      <span className="text-[#3b82f6]">Fabric</span>
                    ) : (
                      <span className="text-[#16a34a]">Vanilla</span>
                    )}
                  </div>
                </div>
                <ChevronDown size={16} className={`text-[#808080] transition-transform ${showInstanceDropdown ? 'rotate-180' : ''}`} strokeWidth={2} />
              </button>

              {/* Dropdown Menu */}
              {showInstanceDropdown && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden min-w-[240px] max-h-[400px] overflow-y-auto">
                  {instances.map((instance) => {
                    const icon = instanceIcons[instance.name]
                    return (
                      <button
                        key={instance.name}
                        onClick={() => {
                          onSetSelectedInstance(instance)
                          setShowInstanceDropdown(false)
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm cursor-pointer transition-colors ${
                          selectedInstance.name === instance.name
                            ? instance.loader === "fabric"
                              ? "bg-[#3b82f6]/10 text-[#e8e8e8]"
                              : "bg-[#16a34a]/10 text-[#e8e8e8]"
                            : "text-[#808080] hover:bg-[#0d0d0d]"
                        }`}
                      >
                        {icon ? (
                          <img
                            src={icon}
                            alt={instance.name}
                            className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                            <Package size={24} className="text-[#4a4a4a]" strokeWidth={1.5} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[#e8e8e8] truncate">{instance.name}</div>
                          <div className="flex items-center gap-1 text-xs">
                            <span>{getMinecraftVersion(instance)}</span>
                            <span>•</span>
                            {instance.loader === "fabric" ? (
                              <span className="text-[#3b82f6]">Fabric</span>
                            ) : (
                              <span className="text-[#16a34a]">Vanilla</span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Center - Wide Play Button */}
            <button
              onClick={onLaunch}
              disabled={isLaunching || !isAuthenticated}
              className={`flex-1 h-14 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center justify-center gap-2.5 cursor-pointer transition-colors ${
                isLaunching 
                  ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                  : "bg-gradient-to-r from-[#16a34a] to-[#15803d] hover:from-[#15803d] hover:to-[#14532d]"
              }`}
            >
              {isLaunching ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-white font-semibold text-lg">Launching...</span>
                </>
              ) : (
                <>
                  <Play size={24} fill="white" className="text-white" strokeWidth={0} />
                  <span className="text-white font-semibold text-lg">Play</span>
                </>
              )}
            </button>

            {/* Right - Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenInstanceFolder}
                className="w-11 h-11 bg-[#1a1a1a]/95 backdrop-blur-md border border-[#2a2a2a] hover:bg-[#1f1f1f] rounded-lg flex items-center justify-center text-[#808080] cursor-pointer transition-colors"
                title="Open Folder"
              >
                <Folder size={20} strokeWidth={2} />
              </button>
              <button
                onClick={() => onShowDetails(selectedInstance)}
                className="w-11 h-11 bg-[#1a1a1a]/95 backdrop-blur-md border border-[#2a2a2a] hover:bg-[#1f1f1f] rounded-lg flex items-center justify-center text-[#808080] cursor-pointer transition-colors"
                title="View Details"
              >
                <Info size={20} strokeWidth={2} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
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
                if (onOpenFolderByInstance) {
                  onOpenFolderByInstance(contextMenu.instance)
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
                onDeleteInstance(contextMenu.instance.name)
              },
              danger: true,
            },
          ]}
        />
      )}
    </div>
  )
}