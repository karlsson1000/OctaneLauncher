import { useState } from "react"
import { X, AlertCircle, Download } from "lucide-react"
import type { Instance } from "../../types"

interface ImportModpackModalProps {
  instances: Instance[]
  defaultName?: string
  onConfirm: (instanceName: string) => void
  onCancel: () => void
}

export function ImportModpackModal({ 
  instances, 
  defaultName = "",
  onConfirm, 
  onCancel 
}: ImportModpackModalProps) {
  const [instanceName, setInstanceName] = useState(defaultName)

  const instanceExists = instances.some(
    instance => instance.name.toLowerCase() === instanceName.trim().toLowerCase()
  )

  const handleConfirm = () => {
    if (!instanceName.trim() || instanceExists) return
    onConfirm(instanceName.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && instanceName.trim() && !instanceExists) {
      handleConfirm()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  const isConfirmDisabled = !instanceName.trim() || instanceExists

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <Download size={32} className="text-[#16a34a]" strokeWidth={1.5} />
            <div>
              <h2 className="text-base font-semibold text-[#e8e8e8] tracking-tight">Import Modpack</h2>
              <p className="text-xs text-[#808080] mt-0.5">Choose a name for this instance</p>
            </div>
          </div>
          <button 
            onClick={onCancel} 
            className="p-1.5 hover:bg-[#0d0d0d] rounded-lg transition-colors text-[#808080] hover:text-[#e8e8e8] cursor-pointer"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#808080] mb-2">Instance Name</label>
            <input
              type="text"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="My Modpack"
              autoFocus
              className={`w-full bg-[#0d0d0d] rounded-lg px-3 py-2.5 text-sm text-[#e8e8e8] placeholder-[#4a4a4a] focus:outline-none transition-colors ${
                instanceExists && instanceName.trim()
                  ? 'ring-1 ring-red-500/50 focus:ring-red-500'
                  : 'focus:ring-1 focus:ring-[#16a34a]'
              }`}
            />
            {instanceExists && instanceName.trim() && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400">
                <AlertCircle size={12} strokeWidth={2} />
                <span>An instance with this name already exists</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#e8e8e8] rounded-lg font-medium text-sm transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download size={16} strokeWidth={2} />
            <span>Import</span>
          </button>
        </div>
      </div>
    </div>
  )
}