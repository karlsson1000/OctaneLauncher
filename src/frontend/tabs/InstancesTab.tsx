import { Package, Plus, Search, FolderOpen, Copy, Trash2, FileText, Download, ChevronDown, Play, FileDown, FileUp, FileArchive } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { invoke } from "@tauri-apps/api/core"
import { open, save } from '@tauri-apps/plugin-dialog'
import { useTranslation } from "react-i18next"
import type { Instance } from "../../types"
import { ContextMenu } from "../modals/ContextMenu"
import { ConfirmModal, AlertModal } from "../modals/ConfirmModal"
import { ExportModal } from "../modals/ExportModal"

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
  const { t } = useTranslation()
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
  const [exportModalInstance, setExportModalInstance] = useState<Instance | null>(null)
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
        title: t('instances.templates.createSuccess.title'),
        message: t('instances.templates.createSuccess.message', { name: instanceName }),
        type: "success"
      })
    } catch (error) {
      console.error("Failed to create template:", error)
      setAlertModal({
        isOpen: true,
        title: t('common.errors.title'),
        message: t('instances.templates.createError', { error: String(error) }),
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
          title: t('instances.templates.exportSuccess.title'),
          message: t('instances.templates.exportSuccess.message', { name: templateName }),
          type: "success"
        })
      }
    } catch (error) {
      console.error("Failed to export template:", error)
      setAlertModal({
        isOpen: true,
        title: t('common.errors.title'),
        message: t('instances.templates.exportError', { error: String(error) }),
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
          title: t('instances.templates.importSuccess.title'),
          message: t('instances.templates.importSuccess.message'),
          type: "success"
        })
      }
    } catch (error) {
      console.error("Failed to import template:", error)
      setAlertModal({
        isOpen: true,
        title: t('common.errors.title'),
        message: t('instances.templates.importError', { error: String(error) }),
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
        title: t('common.errors.title'),
        message: t('instances.templates.deleteError', { error: String(error) }),
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
        title: t('instances.templates.applySuccess.title'),
        message: t('instances.templates.applySuccess.message', { name: instanceName }),
        type: "success"
      })
    } catch (error) {
      console.error("Failed to apply template:", error)
      setAlertModal({
        isOpen: true,
        title: t('common.errors.title'),
        message: t('instances.templates.applyError', { error: String(error) }),
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

        .blur-border-input::before {
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

        .blur-border-input:focus-within::before {
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.14),
            rgba(255, 255, 255, 0.08)
          );
        }
      `}</style>
      <div className="p-6 space-y-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-[#e6e6e6] tracking-tight">{t('instances.title')}</h1>
              <p className="text-sm text-[#7d8590] mt-0.5">{t('instances.subtitle')}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                ref={templateButtonRef}
                onClick={() => {
                  setShowTemplateMenu(!showTemplateMenu)
                  setShowApplyMenu(false)
                }}
                className="w-8 h-8 hover:bg-[#22252b] text-[#7d8590] hover:text-[#e6e6e6] rounded flex items-center justify-center transition-colors cursor-pointer"
              >
                <FileText size={22} strokeWidth={2} />
              </button>
              {instances.length > 0 && (
                <div className="relative blur-border-input rounded-md bg-[#22252b]">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7d8590] z-20 pointer-events-none" strokeWidth={2} />
                  <input
                    type="text"
                    placeholder={t('instances.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-56 bg-transparent rounded-md pl-9 pr-3 py-1.5 text-sm text-[#e6e6e6] placeholder-[#7d8590] focus:outline-none transition-all relative z-10"
                  />
                </div>
              )}
              <button
                onClick={onCreateNew}
                className="px-4 h-8 bg-[#4572e3] hover:bg-[#3461d1] text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus size={16} />
                {t('instances.newButton')}
              </button>
            </div>
          </div>

          {instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14">
              <Package size={48} className="text-[#7d8590] mb-3" strokeWidth={1.5} />
              <h3 className="text-base font-semibold text-[#e6e6e6] mb-1">{t('instances.noInstances.title')}</h3>
              <p className="text-sm text-[#7d8590] mb-4">{t('instances.noInstances.description')}</p>
              <button
                onClick={onCreateNew}
                className="px-4 py-2 bg-[#4572e3] hover:bg-[#3461d1] text-white rounded font-medium text-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={16} strokeWidth={2} />
                <span>{t('instances.noInstances.createButton')}</span>
              </button>
            </div>
          ) : filteredInstances.length === 0 ? (
            <div className="rounded-md p-8 flex flex-col items-center justify-center">
              <Search size={48} className="text-[#e6e6e6] mb-3" strokeWidth={1.5} />
              <h3 className="text-base font-semibold text-[#e6e6e6] mb-1">{t('instances.noSearchResults.title')}</h3>
              <p className="text-sm text-[#7d8590]">{t('instances.noSearchResults.description')}</p>
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
                    className="blur-border group relative bg-[#22252b] rounded-md overflow-hidden cursor-pointer transition-all"
                  >
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
                    
                    <div className="bg-[#22252b] p-3 flex items-center justify-between gap-2 relative z-0">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-[#e6e6e6] truncate mb-0.5">{instance.name}</h3>
                        <div className="flex items-center gap-1.5 text-xs min-w-0">
                          <span className="text-[#7d8590] truncate">{getMinecraftVersion(instance)}</span>
                          <span className="text-[#3a3f4b] flex-shrink-0">•</span>
                          {instance.loader === "fabric" ? (
                            <span className="text-[#3b82f6] flex-shrink-0">{t('common.loaders.fabric')}</span>
                          ) : (
                            <span className="text-[#16a34a] flex-shrink-0">{t('common.loaders.vanilla')}</span>
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
                              : "bg-[#16a34a]/10 hover:bg-[#16a34a]/20 text-[#16a34a]"
                          } disabled:opacity-50`}
                          title={isRunning ? t('instances.instance.stopTooltip') : t('instances.instance.launchTooltip')}
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
          className="fixed w-96 bg-[#22252b] border border-[#3a3f4b] rounded z-[9999] overflow-hidden"
          style={{
            top: `${(templateButtonRef.current?.getBoundingClientRect().bottom || 0) + 8}px`,
            right: `${window.innerWidth - (templateButtonRef.current?.getBoundingClientRect().right || 0)}px`
          }}
        >
          <div className="p-4 pb-3">
            <h3 className="text-base font-semibold text-[#e6e6e6]">{t('instances.templates.manager.title')}</h3>
            <p className="text-xs text-[#7d8590] mt-1">{t('instances.templates.manager.description')}</p>
          </div>
          <div className="h-px bg-[#3a3f4b]" />

          <div className="p-3 space-y-2">
            <button
              onClick={() => {
                setShowTemplateMenu(false)
                setShowApplyMenu(true)
              }}
              disabled={templates.length === 0 || instances.length === 0}
              className="w-full p-3 bg-[#16a34a]/10 hover:bg-[#16a34a]/20 disabled:bg-[#3a3f4b] disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors text-left cursor-pointer flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-[#16a34a]/20 rounded flex items-center justify-center flex-shrink-0">
                <Download size={20} className="text-[#16a34a]" strokeWidth={2} />
              </div>
              <div>
                <div className="text-sm font-medium text-[#e6e6e6]">{t('instances.templates.applyButton')}</div>
                <div className="text-xs text-[#7d8590] mt-0.5">
                  {templates.length === 0 ? t('instances.templates.noTemplates') : t('instances.templates.templatesAvailable', { count: templates.length })}
                </div>
              </div>
            </button>

            <button
              onClick={handleImportTemplate}
              className="w-full p-3 bg-[#3a3f4b] hover:bg-[#4a4f5b] rounded transition-colors text-left cursor-pointer flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-[#4a4f5b] rounded flex items-center justify-center flex-shrink-0">
                <FileDown size={20} className="text-[#e6e6e6]" strokeWidth={2} />
              </div>
              <div>
                <div className="text-sm font-medium text-[#e6e6e6]">{t('instances.templates.importButton')}</div>
                <div className="text-xs text-[#7d8590] mt-0.5">{t('instances.templates.importFromFile')}</div>
              </div>
            </button>
          </div>

          <div className="h-px bg-[#3a3f4b]" />

          <div className="p-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-[#7d8590] uppercase tracking-wide">{t('instances.templates.createNew')}</h4>
              <span className="text-xs text-[#3a3f4b]">{t('instances.templates.instanceCount', { count: instances.length })}</span>
            </div>
            
            <div className="bg-[#181a1f] rounded overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                {instances.length === 0 ? (
                  <div className="p-6 text-center">
                    <Package size={32} className="text-[#3a3f4b] mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-xs text-[#7d8590]">{t('instances.templates.noInstancesAvailable')}</p>
                  </div>
                ) : (
                  instances.map((instance) => {
                    const icon = instanceIcons[instance.name]
                    return (
                      <button
                        key={instance.name}
                        onClick={() => handleCreateTemplate(instance.name)}
                        className="w-full p-3 hover:bg-[#22252b] transition-colors text-left cursor-pointer flex items-center gap-3 group border-b border-[#22252b] last:border-0"
                      >
                        <div className="w-10 h-10 bg-[#22252b] rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {icon ? (
                            <img
                              src={icon}
                              alt={instance.name}
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <Package size={20} className="text-[#3a3f4b]" strokeWidth={1.5} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#e6e6e6] truncate">{instance.name}</div>
                          <div className="text-xs text-[#7d8590]">{getMinecraftVersion(instance)} • {instance.loader === "fabric" ? t('common.loaders.fabric') : t('common.loaders.vanilla')}</div>
                        </div>
                        <Plus size={16} className="text-[#3a3f4b] group-hover:text-[#16a34a] transition-colors flex-shrink-0" strokeWidth={2} />
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
          className="fixed w-96 bg-[#22252b] border border-[#3a3f4b] rounded z-[9999] overflow-hidden"
          style={{
            top: `${(templateButtonRef.current?.getBoundingClientRect().bottom || 0) + 8}px`,
            right: `${window.innerWidth - (templateButtonRef.current?.getBoundingClientRect().right || 0)}px`
          }}
        >
          <div className="p-4 pb-3">
            <h3 className="text-base font-semibold text-[#e6e6e6]">{t('instances.templates.applyTemplate.title')}</h3>
            <p className="text-xs text-[#7d8590] mt-1">{t('instances.templates.applyTemplate.description')}</p>
          </div>
          <div className="h-px bg-[#3a3f4b]" />
          
          <div className="p-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-[#7d8590] uppercase tracking-wide">{t('instances.templates.availableTemplates')}</h4>
              <span className="text-xs text-[#3a3f4b]">{t('instances.templates.templateCount', { count: templates.length })}</span>
            </div>

            <div className="bg-[#181a1f] rounded overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                {templates.length === 0 ? (
                  <div className="p-6 text-center">
                    <FileText size={32} className="text-[#3a3f4b] mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-xs text-[#7d8590]">{t('instances.templates.noTemplates')}</p>
                  </div>
                ) : (
                  templates.map((template) => (
                    <div key={template.id} className="border-b border-[#22252b] last:border-0">
                      <button
                        onClick={() => setSelectedTemplateId(selectedTemplateId === template.id ? null : template.id)}
                        className="w-full p-3 hover:bg-[#22252b] transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 bg-[#16a34a]/20 rounded flex items-center justify-center flex-shrink-0">
                              <FileText size={20} className="text-[#16a34a]" strokeWidth={2} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-[#e6e6e6] truncate">{template.name}</div>
                              <div className="text-xs text-[#7d8590]">{formatDate(template.created_at)}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleExportTemplate(template.id, template.name)
                              }}
                              className="p-1.5 hover:bg-[#2a2f3b] text-[#7d8590] hover:text-[#16a34a] rounded transition-all cursor-pointer"
                              title={t('instances.templates.exportTooltip')}
                            >
                              <FileUp size={16} strokeWidth={2} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteTemplate(template.id)
                              }}
                              className="p-1.5 hover:bg-[#2a2f3b] text-[#7d8590] hover:text-red-400 rounded transition-all cursor-pointer"
                              title={t('instances.templates.deleteTooltip')}
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
                        <div className="bg-[#181a1f]">
                          <div className="px-3 py-2">
                            <h5 className="text-xs font-medium text-[#7d8590] uppercase tracking-wide mb-2">{t('instances.templates.applyToInstance')}</h5>
                          </div>
                          {instances.map((instance) => {
                            const icon = instanceIcons[instance.name]
                            return (
                              <button
                                key={instance.name}
                                onClick={() => handleApplyTemplate(template.id, instance.name)}
                                className="w-full p-3 hover:bg-[#22252b] transition-colors text-left cursor-pointer flex items-center gap-3 group border-t border-[#22252b] first:border-0"
                              >
                                <div className="w-10 h-10 bg-[#22252b] rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                                  {icon ? (
                                    <img
                                      src={icon}
                                      alt={instance.name}
                                      className="w-full h-full object-contain p-1"
                                    />
                                  ) : (
                                    <Package size={20} className="text-[#3a3f4b]" strokeWidth={1.5} />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-[#e6e6e6] truncate">{instance.name}</div>
                                  <div className="text-xs text-[#7d8590]">{getMinecraftVersion(instance)} • {instance.loader === "fabric" ? t('common.loaders.fabric') : t('common.loaders.vanilla')}</div>
                                </div>
                                <Download size={16} className="text-[#7d8590] group-hover:text-[#16a34a] transition-colors flex-shrink-0" strokeWidth={2} />
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
              label: t('instances.contextMenu.open'),
              icon: <Package size={16} />,
              onClick: () => {
                onSetSelectedInstance(contextMenu.instance)
                onShowDetails(contextMenu.instance)
              },
            },
            {
              label: t('instances.contextMenu.openFolder'),
              icon: <FolderOpen size={16} />,
              onClick: () => {
                if (onOpenFolder) {
                  onOpenFolder(contextMenu.instance)
                }
              },
            },
            {
              label: t('instances.contextMenu.duplicate'),
              icon: <Copy size={16} />,
              onClick: () => {
                if (onDuplicateInstance) {
                  onDuplicateInstance(contextMenu.instance)
                }
              },
            },
            {
              label: t('instances.contextMenu.export'),
              icon: <FileArchive size={16} />,
              onClick: () => {
                setExportModalInstance(contextMenu.instance)
              },
            },
            { separator: true },
            {
              label: t('instances.contextMenu.delete'),
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
          confirmText={t('common.actions.delete')}
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

      {/* Export Modal */}
      {exportModalInstance && (
        <ExportModal
          instanceName={exportModalInstance.name}
          onClose={() => setExportModalInstance(null)}
        />
      )}
    </>
  )
}