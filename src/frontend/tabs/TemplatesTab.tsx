import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { invoke } from "@tauri-apps/api/core"
import { FileText, Trash2, Download, ChevronDown } from "lucide-react"
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

interface Instance {
  name: string
  version: string
}

interface TemplatesTabProps {
  instances: Instance[]
  onApplyTemplate: (templateId: string, instanceName: string) => void
  onCreateNew: () => void
}

export function TemplatesTab({ instances, onApplyTemplate, onCreateNew }: TemplatesTabProps) {
  const [templates, setTemplates] = useState<InstanceTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null)
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
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({})

  useEffect(() => {
    loadTemplates()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        const clickedButton = Object.values(buttonRefs.current).some(btn => btn?.contains(event.target as Node))
        if (!clickedButton) {
          setOpenDropdownId(null)
          setDropdownPosition(null)
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const loadTemplates = async () => {
    setIsLoading(true)
    try {
      const templateList = await invoke<InstanceTemplate[]>("get_templates")
      setTemplates(templateList)
    } catch (error) {
      console.error("Failed to load templates:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTemplate = async (templateId: string, templateName: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Template",
      message: `Are you sure you want to delete "${templateName}"?\n\nThis action cannot be undone.`,
      type: "danger",
      onConfirm: async () => {
        try {
          await invoke("delete_template", { templateId })
          await loadTemplates()
          setConfirmModal(null)
        } catch (error) {
          console.error("Failed to delete template:", error)
          setConfirmModal(null)
          setAlertModal({
            isOpen: true,
            title: "Error",
            message: `Failed to delete template: ${error}`,
            type: "danger"
          })
        }
      }
    })
  }

  const handleApplyToInstance = (templateId: string, instanceName: string) => {
    onApplyTemplate(templateId, instanceName)
    setOpenDropdownId(null)
    setDropdownPosition(null)
  }

  const toggleDropdown = (templateId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (openDropdownId === templateId) {
      setOpenDropdownId(null)
      setDropdownPosition(null)
    } else {
      const button = event.currentTarget
      const rect = button.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      })
      setOpenDropdownId(templateId)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <>
      <div className="p-6 space-y-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-[#e8e8e8] tracking-tight">Templates</h1>
              <p className="text-sm text-[#808080] mt-0.5">Save and reuse your favorite instance configurations</p>
            </div>
            {instances.length > 0 && (
              <button
                onClick={onCreateNew}
                className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <Download size={16} strokeWidth={2} />
                <span>New Template</span>
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#16a34a] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-300px)]">
              <FileText size={64} className="text-[#16a34a] mb-4" strokeWidth={1.5} />
              <h3 className="text-lg font-semibold text-[#e8e8e8] mb-1">No templates yet</h3>
              <p className="text-sm text-[#808080] mb-4 text-center max-w-md">
                Create templates from your instances to save settings, mods, and configurations
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => {
                const isOpen = openDropdownId === template.id
                return (
                  <div
                    key={template.id}
                    className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden transition-all"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <FileText size={32} className="text-[#16a34a] flex-shrink-0" strokeWidth={1.5} />
                            <div>
                              <h3 className="text-lg font-semibold text-[#e8e8e8]">{template.name}</h3>
                              <p className="text-xs text-[#808080]">Created {formatDate(template.created_at)}</p>
                            </div>
                          </div>
                          {template.description && (
                            <p className="text-sm text-[#808080] mt-2 ml-11">{template.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Apply Dropdown */}
                          <div className="relative">
                            <button
                              ref={(el) => { buttonRefs.current[template.id] = el }}
                              onClick={(e) => toggleDropdown(template.id, e)}
                              disabled={instances.length === 0}
                              className="px-3 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              title={instances.length === 0 ? "No instances available" : "Apply to Instance"}
                            >
                              <Download size={16} strokeWidth={2} />
                              <span>Apply</span>
                              <ChevronDown size={16} strokeWidth={2} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                          </div>

                          <button
                            onClick={() => handleDeleteTemplate(template.id, template.name)}
                            className="w-9 h-9 bg-[#1a1a1a] hover:bg-[#1f1f1f] border border-[#2a2a2a] text-[#808080] hover:text-red-400 hover:border-red-500/30 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                            title="Delete Template"
                          >
                            <Trash2 size={18} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dropdown Portal */}
      {openDropdownId && dropdownPosition && instances.length > 0 && createPortal(
        <div
          ref={dropdownRef}
          className="fixed w-64 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg z-[9999] overflow-hidden"
          style={{
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`
          }}
        >
          <div className="max-h-64 overflow-y-auto">
            {instances.map((instance) => (
              <button
                key={instance.name}
                onClick={() => handleApplyToInstance(openDropdownId, instance.name)}
                className="w-full p-3 hover:bg-[#2a2a2a] transition-colors text-left cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="text-sm font-medium text-[#e8e8e8]">{instance.name}</div>
                  <div className="text-xs text-[#808080]">{instance.version}</div>
                </div>
                <Download size={14} className="text-[#808080] group-hover:text-[#16a34a] transition-colors" />
              </button>
            ))}
          </div>
        </div>,
        document.body
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