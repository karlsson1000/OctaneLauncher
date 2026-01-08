import { Package, Plus, Search, FolderOpen, Copy, Trash2, FileText, Download, ChevronDown, Play, FileDown, FileUp } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { invoke } from "@tauri-apps/api/core"
import { open, save } from '@tauri-apps/plugin-dialog'
import type { Instance } from "../../types"
import { ContextMenu } from "../modals/ContextMenu"
import { ConfirmModal, AlertModal } from "../modals/ConfirmModal"

interface InstanceTemplate {
  id: string
  name: string
  description: string | null
  created_at: string
  launcher_settings: LauncherSettings | null
  minecraft_options: MinecraftOptions | null
}

interface LauncherSettings {
  java_path: string | null
  memory_mb: number
}

interface MinecraftOptions {
  fov: number | null
  render_distance: number | null
  max_fps: number | null
  fullscreen: boolean | null
  vsync: boolean | null
  gui_scale: number | null
  brightness: number | null
  entity_shadows: boolean | null
  particles: string | null
  graphics: string | null
  smooth_lighting: boolean | null
  biome_blend: number | null
  master_volume: number | null
  music_volume: number | null
  mouse_sensitivity: number | null
  auto_jump: boolean | null
  keybinds: Record<string, string> | null
}

interface InstancesTabProps {
  instances: Instance[]
  selectedInstance: Instance | null
  isAuthenticated: boolean
  launchingInstanceName: string | null
  runningInstances: Set<string>
  onSetSelectedInstance: (instance: Instance) => void
  onLaunch: () => void
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
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    instance: Instance
  } | null>(null)
  const [instanceIcons, setInstanceIcons] = useState<Record<string, string | null>>({})
  const [showTemplateMenu, setShowTemplateMenu] = useState(false)
  const [showApplyMenu, setShowApplyMenu] = useState(false)
  const [templates, setTemplates] = useState<InstanceTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
    onConfirm: () => void
  } | null>(null)
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null>(null)
  const templateButtonRef = useRef<HTMLButtonElement>(null)
  const applyButtonRef = useRef<HTMLButtonElement>(null)
  const templateMenuRef = useRef<HTMLDivElement>(null)
  const applyMenuRef = useRef<HTMLDivElement>(null)

  const getMinecraftVersion = (instance: Instance): string => {
    if (instance.loader === "fabric") {
      const parts = instance.version.split('-')
      return parts[parts.length - 1]
    }
    return instance.version
  }

  const handleQuickLaunch = (instance: Instance) => {
    onSetSelectedInstance(instance)
    onLaunch()
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

  // Load templates
  const loadTemplates = async () => {
    try {
      const templateList = await invoke<InstanceTemplate[]>("get_templates")
      setTemplates(templateList)
    } catch (error) {
      console.error("Failed to load templates:", error)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        templateMenuRef.current &&
        !templateMenuRef.current.contains(event.target as Node) &&
        !templateButtonRef.current?.contains(event.target as Node)
      ) {
        setShowTemplateMenu(false)
      }
      if (
        applyMenuRef.current &&
        !applyMenuRef.current.contains(event.target as Node) &&
        !applyButtonRef.current?.contains(event.target as Node)
      ) {
        setShowApplyMenu(false)
        setSelectedTemplateId(null)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleContextMenu = (e: React.MouseEvent, instance: Instance) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      instance,
    })
  }

  const handleCreateTemplate = async (instanceName: string) => {
    setShowTemplateMenu(false)
    
    try {
      await invoke("create_template_from_instance", { 
        instanceName,
        templateName: `${instanceName} Template`,
        description: `Template created from ${instanceName}`
      })
      await loadTemplates()

      setAlertModal({
        isOpen: true,
        title: "Success",
        message: `Template created from "${instanceName}" successfully!`,
        type: "success"
      })
    } catch (error) {
      console.error("Failed to create template:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to create template: ${error}`,
        type: "danger"
      })
    }
  }

  const handleExportTemplate = async (templateId: string, templateName: string) => {
    try {
      const filePath = await save({
        defaultPath: `${templateName}.json`,
        filters: [{
          name: 'Template',
          extensions: ['json']
        }]
      })

      if (filePath) {
        await invoke("export_template", { 
          templateId, 
          exportPath: filePath 
        })
        setAlertModal({
          isOpen: true,
          title: "Success",
          message: `Template "${templateName}" exported successfully!`,
          type: "success"
        })
      }
    } catch (error) {
      console.error("Failed to export template:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to export template: ${error}`,
        type: "danger"
      })
    }
  }

  const handleImportTemplate = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Template',
          extensions: ['json']
        }]
      })

      if (selected && typeof selected === 'string') {
        await invoke("import_template", { importPath: selected })
        await loadTemplates()
        setAlertModal({
          isOpen: true,
          title: "Success",
          message: "Template imported successfully!",
          type: "success"
        })
      }
    } catch (error) {
      console.error("Failed to import template:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to import template: ${error}`,
        type: "danger"
      })
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await invoke("delete_template", { templateId })
      await loadTemplates()
    } catch (error) {
      console.error("Failed to delete template:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to delete template: ${error}`,
        type: "danger"
      })
    }
  }

  const handleApplyTemplate = async (templateId: string, instanceName: string) => {
    try {
      await invoke("apply_template_to_instance", { templateId, instanceName })
      setShowApplyMenu(false)
      setSelectedTemplateId(null)
      setAlertModal({
        isOpen: true,
        title: "Success",
        message: `Template applied to ${instanceName} successfully!`,
        type: "success"
      })
    } catch (error) {
      console.error("Failed to apply template:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to apply template: ${error}`,
        type: "danger"
      })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const filteredInstances = instances.filter(instance =>
    instance.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <>
      <div className="p-6 space-y-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-[#e6edf3] tracking-tight">Instances</h1>
              <p className="text-sm text-[#7d8590] mt-0.5">Manage all your instances</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                ref={templateButtonRef}
                onClick={() => {
                  setShowTemplateMenu(!showTemplateMenu)
                  setShowApplyMenu(false)
                }}
                className="w-10 h-10 hover:bg-[#1a1a1a] text-[#7d8590] hover:text-[#e6edf3] rounded flex items-center justify-center transition-all cursor-pointer"
              >
                <FileText size={24} strokeWidth={2} />
              </button>
              <button
                onClick={onCreateNew}
                className="px-4 h-8 bg-[#238636] hover:bg-[#2ea043] text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus size={16} />
                New
              </button>
            </div>
          </div>

          {instances.length > 0 && (
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7d8590]" strokeWidth={2} />
              <input
                type="text"
                placeholder="Search instances..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#141414] rounded-md pl-10 pr-4 py-2.5 text-sm text-[#e6edf3] placeholder-[#7d8590] border border-[#2a2a2a] focus:outline-none focus:ring-1 focus:ring-[#3a3a3a] transition-all"
              />
            </div>
          )}

          {instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-300px)]">
              <Package size={64} className="text-[#238636] mb-4" strokeWidth={1.5} />
              <h3 className="text-lg font-semibold text-[#e6edf3] mb-1">No instances yet</h3>
              <p className="text-sm text-[#7d8590] mb-4">Create your first instance to get started</p>
              <button
                onClick={onCreateNew}
                className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded font-medium text-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={16} strokeWidth={2} />
                <span>Create Instance</span>
              </button>
            </div>
          ) : filteredInstances.length === 0 ? (
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-md p-12 flex flex-col items-center justify-center">
              <Search size={64} className="text-[#238636] mb-4" strokeWidth={1.5} />
              <h3 className="text-lg font-semibold text-[#e6edf3] mb-1">No instances found</h3>
              <p className="text-sm text-[#7d8590]">Try adjusting your search query</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
              {filteredInstances.map((instance) => {
                const icon = instanceIcons[instance.name]
                const isLaunching = launchingInstanceName === instance.name
                const isRunning = runningInstances.has(instance.name)
                return (
                  <div
                    key={instance.name}
                    onClick={() => {
                      onSetSelectedInstance(instance)
                      onShowDetails(instance)
                    }}
                    onContextMenu={(e) => handleContextMenu(e, instance)}
                    className="group relative bg-[#141414] rounded-md overflow-hidden cursor-pointer transition-all hover:ring-1 hover:ring-[#2a2a2a] border border-[#2a2a2a]"
                  >
                    <div className="aspect-square bg-[#0f0f0f] flex items-center justify-center overflow-hidden">
                      {icon ? (
                        <img
                          src={icon}
                          alt={instance.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package size={88} className="text-[#3a3a3a]" strokeWidth={1.5} />
                      )}
                    </div>
                    
                    <div className="bg-[#141414] p-3 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-[#e6edf3] truncate mb-0.5">{instance.name}</h3>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-[#7d8590]">{getMinecraftVersion(instance)}</span>
                          <span className="text-[#3a3a3a]">•</span>
                          {instance.loader === "fabric" ? (
                            <span className="text-[#3b82f6]">Fabric</span>
                          ) : (
                            <span className="text-[#238636]">Vanilla</span>
                          )}
                        </div>
                      </div>
                      
                      {isAuthenticated && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (isRunning && onKillInstance) {
                              onKillInstance(instance)
                            } else {
                              handleQuickLaunch(instance)
                            }
                          }}
                          disabled={launchingInstanceName !== null && !isRunning}
                          className={`opacity-0 group-hover:opacity-100 flex-shrink-0 w-10 h-10 flex items-center justify-center rounded transition-all cursor-pointer ${
                            isRunning || isLaunching
                              ? "bg-red-500/10 text-red-400 opacity-100"
                              : "bg-[#238636]/10 hover:bg-[#238636]/20 text-[#238636]"
                          } disabled:opacity-50`}
                          title={isRunning ? "Stop instance" : "Launch instance"}
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
          )}
        </div>
      </div>

      {/* Template Menu Dropdown */}
      {showTemplateMenu && !showApplyMenu && createPortal(
        <div
          ref={templateMenuRef}
          className="fixed w-96 bg-[#141414] border border-[#2a2a2a] rounded z-[9999] overflow-hidden"
          style={{
            top: `${(templateButtonRef.current?.getBoundingClientRect().bottom || 0) + 8}px`,
            right: `${window.innerWidth - (templateButtonRef.current?.getBoundingClientRect().right || 0)}px`
          }}
        >
          <div className="p-4 pb-3">
            <h3 className="text-base font-semibold text-[#e6edf3]">Template Manager</h3>
            <p className="text-xs text-[#7d8590] mt-1">Create, apply, and manage templates</p>
          </div>
          <div className="h-px bg-[#2a2a2a]" />

          {/* Quick Actions */}
          <div className="p-3 space-y-2">
            <button
              onClick={() => {
                setShowTemplateMenu(false)
                setShowApplyMenu(true)
              }}
              disabled={templates.length === 0 || instances.length === 0}
              className="w-full p-3 bg-[#238636]/10 hover:bg-[#238636]/20 disabled:bg-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors text-left cursor-pointer flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-[#238636]/20 rounded flex items-center justify-center flex-shrink-0">
                <Download size={20} className="text-[#238636]" strokeWidth={2} />
              </div>
              <div>
                <div className="text-sm font-medium text-[#e6edf3]">Apply Template to Instance</div>
                <div className="text-xs text-[#7d8590] mt-0.5">
                  {templates.length === 0 ? "No templates available" : `${templates.length} template${templates.length !== 1 ? 's' : ''} available`}
                </div>
              </div>
            </button>

            <button
              onClick={handleImportTemplate}
              className="w-full p-3 bg-[#2a2a2a] hover:bg-[#333333] rounded transition-colors text-left cursor-pointer flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-[#333333] rounded flex items-center justify-center flex-shrink-0">
                <FileDown size={20} className="text-[#e6edf3]" strokeWidth={2} />
              </div>
              <div>
                <div className="text-sm font-medium text-[#e6edf3]">Import Template</div>
                <div className="text-xs text-[#7d8590] mt-0.5">From JSON file</div>
              </div>
            </button>
          </div>

          <div className="h-px bg-[#2a2a2a]" />

          {/* Create Template Section */}
          <div className="p-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-[#7d8590] uppercase tracking-wide">Create New Template</h4>
              <span className="text-xs text-[#3a3a3a]">{instances.length} instance{instances.length !== 1 ? 's' : ''}</span>
            </div>
            
            <div className="bg-[#0f0f0f] rounded overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                {instances.length === 0 ? (
                  <div className="p-6 text-center">
                    <Package size={32} className="text-[#3a3a3a] mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-xs text-[#7d8590]">No instances available</p>
                  </div>
                ) : (
                  instances.map((instance) => {
                    const icon = instanceIcons[instance.name]
                    return (
                      <button
                        key={instance.name}
                        onClick={() => handleCreateTemplate(instance.name)}
                        className="w-full p-3 hover:bg-[#141414] transition-colors text-left cursor-pointer flex items-center gap-3 group border-b border-[#1a1a1a] last:border-0"
                      >
                        <div className="w-10 h-10 bg-[#1a1a1a] rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {icon ? (
                            <img
                              src={icon}
                              alt={instance.name}
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <Package size={20} className="text-[#3a3a3a]" strokeWidth={1.5} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#e6edf3] truncate">{instance.name}</div>
                          <div className="text-xs text-[#7d8590]">{getMinecraftVersion(instance)} • {instance.loader === "fabric" ? "Fabric" : "Vanilla"}</div>
                        </div>
                        <Plus size={16} className="text-[#3a3a3a] group-hover:text-[#238636] transition-colors flex-shrink-0" strokeWidth={2} />
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Apply Template Menu */}
      {showApplyMenu && createPortal(
        <div
          ref={applyMenuRef}
          className="fixed w-96 bg-[#141414] border border-[#2a2a2a] rounded z-[9999] overflow-hidden"
          style={{
            top: `${(templateButtonRef.current?.getBoundingClientRect().bottom || 0) + 8}px`,
            right: `${window.innerWidth - (templateButtonRef.current?.getBoundingClientRect().right || 0)}px`
          }}
        >
          <div className="p-4 pb-3">
            <h3 className="text-base font-semibold text-[#e6edf3]">Apply Template</h3>
            <p className="text-xs text-[#7d8590] mt-1">Select a template and instance</p>
          </div>
          <div className="h-px bg-[#2a2a2a]" />
          
          {/* Templates List */}
          <div className="p-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-[#7d8590] uppercase tracking-wide">Available Templates</h4>
              <span className="text-xs text-[#3a3a3a]">{templates.length} template{templates.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="bg-[#0f0f0f] rounded overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                {templates.length === 0 ? (
                  <div className="p-6 text-center">
                    <FileText size={32} className="text-[#3a3a3a] mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-xs text-[#7d8590]">No templates available</p>
                  </div>
                ) : (
                  templates.map((template) => (
                    <div key={template.id} className="border-b border-[#1a1a1a] last:border-0">
                      <button
                        onClick={() => setSelectedTemplateId(selectedTemplateId === template.id ? null : template.id)}
                        className="w-full p-3 hover:bg-[#141414] transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 bg-[#238636]/20 rounded flex items-center justify-center flex-shrink-0">
                              <FileText size={20} className="text-[#238636]" strokeWidth={2} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-[#e6edf3] truncate">{template.name}</div>
                              <div className="text-xs text-[#7d8590]">{formatDate(template.created_at)}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleExportTemplate(template.id, template.name)
                              }}
                              className="p-1.5 hover:bg-[#1f1f1f] text-[#7d8590] hover:text-[#238636] rounded transition-all cursor-pointer"
                              title="Export Template"
                            >
                              <FileUp size={16} strokeWidth={2} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteTemplate(template.id)
                              }}
                              className="p-1.5 hover:bg-[#1f1f1f] text-[#7d8590] hover:text-red-400 rounded transition-all cursor-pointer"
                              title="Delete Template"
                            >
                              <Trash2 size={16} strokeWidth={2} />
                            </button>
                            <ChevronDown 
                              size={16} 
                              className={`text-[#7d8590] transition-transform ml-1 ${selectedTemplateId === template.id ? 'rotate-180' : ''}`} 
                            />
                          </div>
                        </div>
                      </button>
                      
                      {selectedTemplateId === template.id && (
                        <div className="bg-[#0a0a0a]">
                          <div className="px-3 py-2">
                            <h5 className="text-xs font-medium text-[#7d8590] uppercase tracking-wide mb-2">Apply to Instance</h5>
                          </div>
                          {instances.map((instance) => {
                            const icon = instanceIcons[instance.name]
                            return (
                              <button
                                key={instance.name}
                                onClick={() => handleApplyTemplate(template.id, instance.name)}
                                className="w-full p-3 hover:bg-[#141414] transition-colors text-left cursor-pointer flex items-center gap-3 group border-t border-[#1a1a1a] first:border-0"
                              >
                                <div className="w-10 h-10 bg-[#1a1a1a] rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                                  {icon ? (
                                    <img
                                      src={icon}
                                      alt={instance.name}
                                      className="w-full h-full object-contain p-1"
                                    />
                                  ) : (
                                    <Package size={20} className="text-[#3a3a3a]" strokeWidth={1.5} />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-[#e6edf3] truncate">{instance.name}</div>
                                  <div className="text-xs text-[#7d8590]">{getMinecraftVersion(instance)} • {instance.loader === "fabric" ? "Fabric" : "Vanilla"}</div>
                                </div>
                                <Download size={16} className="text-[#7d8590] group-hover:text-[#238636] transition-colors flex-shrink-0" strokeWidth={2} />
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

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

      {/* Confirmation Modal */}
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          confirmText="Delete"
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {/* Alert Modal */}
      {alertModal && (
        <AlertModal
          isOpen={alertModal.isOpen}
          title={alertModal.title}
          message={alertModal.message}
          type={alertModal.type}
          onClose={() => setAlertModal(null)}
        />
      )}
    </>
  )
}