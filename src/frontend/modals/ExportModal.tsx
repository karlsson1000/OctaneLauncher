import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { save } from '@tauri-apps/plugin-dialog'
import { X, AlertCircle, Download } from "lucide-react"
import { AlertModal } from "./ConfirmModal"

interface ExportModalProps {
  instanceName: string
  onClose: () => void
}

export function ExportModal({ instanceName, onClose }: ExportModalProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [includeWorlds, setIncludeWorlds] = useState(true)
  const [includeResourcePacks, setIncludeResourcePacks] = useState(true)
  const [includeShaderPacks, setIncludeShaderPacks] = useState(true)
  const [includeMods, setIncludeMods] = useState(true)
  const [includeConfig, setIncludeConfig] = useState(true)
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null>(null)

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 150)
  }

  const handleExport = async () => {
    try {
      const defaultFileName = `${instanceName}.zip`
      
      const savePath = await save({
        defaultPath: defaultFileName,
        filters: [{
          name: 'ZIP Archive',
          extensions: ['zip']
        }]
      })

      if (!savePath) return

      setIsExporting(true)

      await invoke("export_instance", {
        instanceName: instanceName,
        outputPath: savePath,
        includeWorlds: includeWorlds,
        includeResourcePacks: includeResourcePacks,
        includeShaderPacks: includeShaderPacks,
        includeMods: includeMods,
        includeConfig: includeConfig,
      })

      setAlertModal({
        isOpen: true,
        title: "Success",
        message: `Instance exported successfully to ${savePath}`,
        type: "success"
      })

      setTimeout(() => {
        handleClose()
      }, 1500)
    } catch (error) {
      console.error("Export error:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to export instance: ${error}`,
        type: "danger"
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes scaleIn {
          from { 
            opacity: 0;
            transform: scale(0.95);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes scaleOut {
          from { 
            opacity: 1;
            transform: scale(1);
          }
          to { 
            opacity: 0;
            transform: scale(0.95);
          }
        }
        .modal-backdrop {
          animation: fadeIn 0.15s ease-out forwards;
        }
        .modal-backdrop.closing {
          animation: fadeOut 0.15s ease-in forwards;
        }
        .modal-content {
          animation: scaleIn 0.15s ease-out forwards;
        }
        .modal-content.closing {
          animation: scaleOut 0.15s ease-in forwards;
        }
      `}</style>
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop ${isClosing ? 'closing' : ''}`}
        onClick={handleClose}
      >
        <div 
          className={`bg-[#181a1f] rounded w-full max-w-md shadow-2xl modal-content ${isClosing ? 'closing' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 pt-6 pb-5">
            <div>
              <h2 className="text-xl font-semibold text-[#e6e6e6] tracking-tight">Export Instance</h2>
              <p className="text-sm text-[#7d8590] mt-0.5">{instanceName}</p>
            </div>
            <button 
              onClick={handleClose} 
              className="p-1.5 hover:bg-[#3a3f4b] rounded transition-colors text-gray-400 hover:text-[#e6e6e6] cursor-pointer"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="px-6 pb-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#e6e6e6] mb-2.5">Include in Export</label>
              <div className="bg-[#22252b] rounded p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      checked={includeWorlds}
                      onChange={(e) => setIncludeWorlds(e.target.checked)}
                      disabled={isExporting}
                      className="w-4 h-4 rounded border-2 border-gray-500 bg-transparent checked:bg-[#4572e3] checked:border-[#4572e3] focus:ring-2 focus:ring-[#4572e3] focus:ring-offset-0 transition-all cursor-pointer"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-[#e6e6e6] group-hover:text-white transition-colors">
                      Worlds (saves/)
                    </span>
                    <p className="text-xs text-[#7d8590] mt-0.5">
                      Include all saved worlds and maps
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      checked={includeResourcePacks}
                      onChange={(e) => setIncludeResourcePacks(e.target.checked)}
                      disabled={isExporting}
                      className="w-4 h-4 rounded border-2 border-gray-500 bg-transparent checked:bg-[#4572e3] checked:border-[#4572e3] focus:ring-2 focus:ring-[#4572e3] focus:ring-offset-0 transition-all cursor-pointer"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-[#e6e6e6] group-hover:text-white transition-colors">
                      Resource Packs
                    </span>
                    <p className="text-xs text-[#7d8590] mt-0.5">
                      Include installed resource packs
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      checked={includeShaderPacks}
                      onChange={(e) => setIncludeShaderPacks(e.target.checked)}
                      disabled={isExporting}
                      className="w-4 h-4 rounded border-2 border-gray-500 bg-transparent checked:bg-[#4572e3] checked:border-[#4572e3] focus:ring-2 focus:ring-[#4572e3] focus:ring-offset-0 transition-all cursor-pointer"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-[#e6e6e6] group-hover:text-white transition-colors">
                      Shader Packs
                    </span>
                    <p className="text-xs text-[#7d8590] mt-0.5">
                      Include installed shader packs
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      checked={includeMods}
                      onChange={(e) => setIncludeMods(e.target.checked)}
                      disabled={isExporting}
                      className="w-4 h-4 rounded border-2 border-gray-500 bg-transparent checked:bg-[#4572e3] checked:border-[#4572e3] focus:ring-2 focus:ring-[#4572e3] focus:ring-offset-0 transition-all cursor-pointer"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-[#e6e6e6] group-hover:text-white transition-colors">
                      Mods
                    </span>
                    <p className="text-xs text-[#7d8590] mt-0.5">
                      Include all installed mods
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      checked={includeConfig}
                      onChange={(e) => setIncludeConfig(e.target.checked)}
                      disabled={isExporting}
                      className="w-4 h-4 rounded border-2 border-gray-500 bg-transparent checked:bg-[#4572e3] checked:border-[#4572e3] focus:ring-2 focus:ring-[#4572e3] focus:ring-offset-0 transition-all cursor-pointer"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-[#e6e6e6] group-hover:text-white transition-colors">
                      Configuration
                    </span>
                    <p className="text-xs text-[#7d8590] mt-0.5">
                      Include config files and settings
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="bg-[#22252b] rounded p-4 border border-[#3a3f4b]">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-[#3b82f6] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-[#e6e6e6] font-medium mb-1">Standard ZIP Format</p>
                  <p className="text-xs text-[#7d8590] leading-relaxed">
                    Export creates a standard ZIP archive containing your selected instance data. This can be used for backups or sharing.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-3">
            <button
              onClick={handleClose}
              disabled={isExporting}
              className="px-5 py-3 bg-[#22252b] hover:bg-[#3a3f4b] text-[#e6e6e6] rounded font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-5 py-3 bg-[#4572e3] hover:bg-[#3461d1] text-white rounded font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download size={16} strokeWidth={2} />
                  <span>Export Instance</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

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