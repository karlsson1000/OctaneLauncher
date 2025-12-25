import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { X, FileText } from "lucide-react"
import { AlertModal } from "./ConfirmModal"

interface Instance {
  name: string
  version: string
}

interface CreateTemplateModalProps {
  instances: Instance[]
  onClose: () => void
  onSuccess: () => void
}

export function CreateTemplateModal({ instances, onClose, onSuccess }: CreateTemplateModalProps) {
  const [selectedInstance, setSelectedInstance] = useState<string>(instances[0]?.name || "")
  const [templateName, setTemplateName] = useState("")
  const [description, setDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState("")
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null>(null)

  const handleCreate = async () => {
    if (!templateName.trim()) {
      setError("Please enter a template name")
      return
    }

    if (!selectedInstance) {
      setError("Please select an instance")
      return
    }

    setIsCreating(true)
    setError("")

    try {
      await invoke("create_template_from_instance", {
        instanceName: selectedInstance,
        templateName: templateName.trim(),
        description: description.trim() || null,
      })

      onSuccess()
      onClose()
    } catch (err) {
      setError("")
      setIsCreating(false)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to create template: ${err}`,
        type: "danger"
      })
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl max-w-md w-full shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
            <div className="flex items-center gap-3">
              <FileText size={32} className="text-[#16a34a]" strokeWidth={1.5} />
              <div>
                <h2 className="text-lg font-semibold text-[#e8e8e8]">Create Template</h2>
                <p className="text-xs text-[#808080]">Save instance as a template</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#808080] hover:text-[#e8e8e8] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-500">
                {error}
              </div>
            )}

            {/* Instance Selection */}
            <div>
              <label className="block text-sm font-medium text-[#e8e8e8] mb-2">
                Select Instance
              </label>
              <select
                value={selectedInstance}
                onChange={(e) => setSelectedInstance(e.target.value)}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-[#e8e8e8] focus:outline-none focus:border-[#16a34a] transition-colors"
              >
                {instances.map((instance) => (
                  <option key={instance.name} value={instance.name}>
                    {instance.name} ({instance.version})
                  </option>
                ))}
              </select>
              <p className="text-xs text-[#808080] mt-1.5">
                Game settings and launcher configuration will be saved from this instance
              </p>
            </div>

            {/* Template Name */}
            <div>
              <label className="block text-sm font-medium text-[#e8e8e8] mb-2">
                Template Name
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Modded Survival, Performance Optimized"
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-[#e8e8e8] placeholder-[#4a4a4a] focus:outline-none focus:border-[#16a34a] transition-colors"
                maxLength={100}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-[#e8e8e8] mb-2">
                Description <span className="text-[#808080] font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this template..."
                rows={3}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-[#e8e8e8] placeholder-[#4a4a4a] focus:outline-none focus:border-[#16a34a] transition-colors resize-none"
                maxLength={500}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-[#2a2a2a]">
            <button
              onClick={onClose}
              disabled={isCreating}
              className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#e8e8e8] rounded-lg font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating || !templateName.trim() || !selectedInstance}
              className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Template</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Alert Modal */}
      {alertModal && (
        <AlertModal
          isOpen={alertModal.isOpen}
          title={alertModal.title}
          message={alertModal.message}
          type={alertModal.type}
          onClose={() => {
            setAlertModal(null)
            onClose()
          }}
        />
      )}
    </>
  )
}