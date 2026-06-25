import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { save } from '@tauri-apps/plugin-dialog'
import { X, Download } from "lucide-react"
import { AlertModal } from "../../components/ui/ConfirmModal"

interface ExportModalProps {
  instanceName: string
  onClose: () => void
}

export function ExportModal({ instanceName, onClose }: ExportModalProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    const main = document.querySelector('main')
    if (main) {
      const prev = main.style.overflowY
      main.style.overflowY = 'hidden'
      return () => { main.style.overflowY = prev }
    }
  }, [])
  const [exportFormat, setExportFormat] = useState<'zip' | 'mrpack'>('mrpack')
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
      const defaultExtension = exportFormat === 'mrpack' ? 'mrpack' : 'zip';
      const defaultFileName = `${instanceName}.${defaultExtension}`;
      
      const savePath = await save({
        defaultPath: defaultFileName,
        filters: [{
          name: exportFormat === 'mrpack' ? 'Modrinth Modpack' : 'ZIP Archive',
          extensions: [defaultExtension]
        }]
      });

      if (!savePath) return;

      setIsExporting(true);

      await invoke("export_instance", {
        instanceName: instanceName,
        outputPath: savePath,
        exportFormat: exportFormat,
        includeWorlds: includeWorlds,
        includeResourcePacks: includeResourcePacks,
        includeShaderPacks: includeShaderPacks,
        includeMods: includeMods,
        includeConfig: includeConfig,
      });

      setAlertModal({
        isOpen: true,
        title: "Success",
        message: `Instance exported successfully to ${savePath}`,
        type: "success"
      });

      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      console.error("Export error:", error);
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to export instance: ${error}`,
        type: "danger"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop ${isClosing ? 'closing' : ''}`}
        onClick={handleClose}
      >
        <div 
          className={`blur-border bg-[var(--bg-secondary)] rounded w-full max-w-md shadow-2xl modal-content ${isClosing ? 'closing' : ''}`}
          onClick={(e) => e.stopPropagation()}
          style={{ pointerEvents: 'auto' }}
        >
          <div className="flex items-center justify-between px-6 pt-6 pb-5">
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Export Instance</h2>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">{instanceName}</p>
            </div>
            <button 
              onClick={handleClose} 
              className="p-1.5 hover:bg-[var(--bg-hover-strong)] rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="px-6 pb-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Export Format</label>
              <div className="bg-[var(--bg-tertiary)] rounded p-4 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    checked={exportFormat === 'mrpack'}
                    onChange={() => setExportFormat('mrpack')}
                    disabled={isExporting}
                    className="w-4 h-4 text-[var(--accent-primary)] border-gray-500 focus:ring-[var(--accent-primary)] cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                      Modrinth Modpack (.mrpack)
                    </span>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Standard modpack format
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    checked={exportFormat === 'zip'}
                    onChange={() => setExportFormat('zip')}
                    disabled={isExporting}
                    className="w-4 h-4 text-[var(--accent-primary)] border-gray-500 focus:ring-[var(--accent-primary)] cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                      Standard ZIP Archive (.zip)
                    </span>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Direct backup of instance folder structure
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Include in Export</label>
              <div className="bg-[var(--bg-tertiary)] rounded p-4 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={includeWorlds}
                    onChange={(e) => setIncludeWorlds(e.target.checked)}
                    disabled={isExporting}
                    className="w-4 h-4 rounded border-2 border-gray-500 bg-transparent checked:bg-[var(--accent-primary)] checked:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-0 transition-all cursor-pointer flex-shrink-0"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                      Worlds (saves/)
                    </span>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Include all saved worlds and maps
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={includeResourcePacks}
                    onChange={(e) => setIncludeResourcePacks(e.target.checked)}
                    disabled={isExporting}
                    className="w-4 h-4 rounded border-2 border-gray-500 bg-transparent checked:bg-[var(--accent-primary)] checked:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-0 transition-all cursor-pointer flex-shrink-0"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                      Resource Packs
                    </span>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Include installed resource packs
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={includeShaderPacks}
                    onChange={(e) => setIncludeShaderPacks(e.target.checked)}
                    disabled={isExporting}
                    className="w-4 h-4 rounded border-2 border-gray-500 bg-transparent checked:bg-[var(--accent-primary)] checked:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-0 transition-all cursor-pointer flex-shrink-0"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                      Shader Packs
                    </span>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Include installed shader packs
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={includeMods}
                    onChange={(e) => setIncludeMods(e.target.checked)}
                    disabled={isExporting}
                    className="w-4 h-4 rounded border-2 border-gray-500 bg-transparent checked:bg-[var(--accent-primary)] checked:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-0 transition-all cursor-pointer flex-shrink-0"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                      Mods
                    </span>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Include all installed mods
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={includeConfig}
                    onChange={(e) => setIncludeConfig(e.target.checked)}
                    disabled={isExporting}
                    className="w-4 h-4 rounded border-2 border-gray-500 bg-transparent checked:bg-[var(--accent-primary)] checked:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-0 transition-all cursor-pointer flex-shrink-0"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                      Configuration
                    </span>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Include config files and settings
                    </p>
                  </div>
                </label>
              </div>
            </div>

          </div>

          <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-3">
            <button
              onClick={handleClose}
              disabled={isExporting}
              className="px-5 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover-strong)] text-[var(--text-primary)] rounded font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-5 py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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