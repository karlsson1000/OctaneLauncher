import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { save, open } from "@tauri-apps/plugin-dialog"
import { Download, Upload, Archive, Trash2, RotateCcw, Check, X, Loader2, AlertCircle } from "lucide-react"
import { AlertModal } from "../modals/ConfirmModal"

interface Snapshot {
  id: string
  name: string
  created_at: string
  size_bytes: number
  file_path: string
}

interface SnapshotManagerProps {
  isOpen: boolean
  onClose: () => void
}

export function SnapshotManager({ isOpen, onClose }: SnapshotManagerProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [showNameInput, setShowNameInput] = useState(false)
  const [snapshotName, setSnapshotName] = useState("")
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null>(null)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadSnapshots()
    }
  }, [isOpen])

  const loadSnapshots = async () => {
    setIsLoading(true)
    try {
      const snapshotList = await invoke<Snapshot[]>("get_launcher_snapshots")
      setSnapshots(snapshotList)
    } catch (error) {
      console.error("Failed to load snapshots:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to load snapshots: ${error}`,
        type: "danger"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateSnapshot = async () => {
    if (!snapshotName.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Invalid Name",
        message: "Please enter a name for the snapshot",
        type: "warning"
      })
      return
    }

    setIsCreating(true)
    try {
      await invoke("create_launcher_snapshot", { name: snapshotName })
      setSnapshotName("")
      setShowNameInput(false)
      await loadSnapshots()
      setAlertModal({
        isOpen: true,
        title: "Success",
        message: "Snapshot created successfully!",
        type: "success"
      })
    } catch (error) {
      console.error("Failed to create snapshot:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to create snapshot: ${error}`,
        type: "danger"
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleRestoreSnapshot = async (snapshotId: string, _name: string) => {
    setIsLoading(true)
    try {
      await invoke("restore_launcher_snapshot", { snapshotId })
      setAlertModal({
        isOpen: true,
        title: "Success",
        message: "Snapshot restored successfully! Please restart the launcher for changes to take effect.",
        type: "success"
      })
    } catch (error) {
      console.error("Failed to restore snapshot:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to restore snapshot: ${error}`,
        type: "danger"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteSnapshot = async (snapshotId: string, _snapshotName: string) => {
    setIsLoading(true)
    try {
      await invoke("delete_launcher_snapshot", { snapshotId })
      await loadSnapshots()
      setAlertModal({
        isOpen: true,
        title: "Success",
        message: "Snapshot deleted successfully",
        type: "success"
      })
    } catch (error) {
      console.error("Failed to delete snapshot:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to delete snapshot: ${error}`,
        type: "danger"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportSnapshot = async (snapshotId: string, snapshotName: string) => {
    try {
      const filePath = await save({
        defaultPath: `${snapshotName}.octsnap`,
        filters: [{
          name: "Octane Snapshot",
          extensions: ["octsnap"]
        }]
      })

      if (!filePath) return

      await invoke("export_launcher_snapshot", {
        snapshotId,
        exportPath: filePath
      })

      setAlertModal({
        isOpen: true,
        title: "Success",
        message: "Snapshot exported successfully",
        type: "success"
      })
    } catch (error) {
      console.error("Failed to export snapshot:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to export snapshot: ${error}`,
        type: "danger"
      })
    }
  }

  const handleImportSnapshot = async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [{
          name: "Octane Snapshot",
          extensions: ["octsnap"]
        }]
      })

      if (!filePath) return

      const name = window.prompt("Enter a name for the imported snapshot:")
      if (!name) return

      await invoke("import_launcher_snapshot", {
        importPath: filePath,
        name
      })

      await loadSnapshots()
      setAlertModal({
        isOpen: true,
        title: "Success",
        message: "Snapshot imported successfully",
        type: "success"
      })
    } catch (error) {
      console.error("Failed to import snapshot:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to import snapshot: ${error}`,
        type: "danger"
      })
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 150)
  }

  if (!isOpen) return null

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
          className={`bg-[#1a1d23] rounded w-full max-w-4xl max-h-[600px] flex flex-col shadow-2xl modal-content ${isClosing ? 'closing' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-[#252932]">
            <div className="flex items-center gap-3">
              <Archive size={20} className="text-[#4572e3]" />
              <h2 className="text-xl font-semibold text-white">Octane Snapshots</h2>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-[#252932] rounded transition-colors text-gray-400 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Info Banner */}
          <div className="bg-[#252932] border-l-4 border-[#4572e3] p-4 m-5 rounded">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-[#4572e3] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-300 leading-relaxed">
                  Snapshots backup your entire launcher configuration including instances, settings, templates, servers, and custom backgrounds. 
                  Making a snapshot might take a while.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 px-5 pb-4">
            {!showNameInput ? (
              <>
                <button
                  onClick={() => setShowNameInput(true)}
                  disabled={isLoading || isCreating}
                  className="flex items-center gap-2 px-4 py-2 bg-[#4572e3] hover:bg-[#3461d9] disabled:bg-[#2d3139] disabled:cursor-not-allowed text-white rounded text-sm font-medium cursor-pointer transition-colors"
                >
                  <Archive size={16} />
                  <span>Create Snapshot</span>
                </button>
                <button
                  onClick={handleImportSnapshot}
                  disabled={isLoading || isCreating}
                  className="flex items-center gap-2 px-4 py-2 bg-[#252932] hover:bg-[#2d3139] disabled:bg-[#1f2229] disabled:cursor-not-allowed text-white rounded text-sm font-medium cursor-pointer transition-colors"
                >
                  <Upload size={16} />
                  <span>Import</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  placeholder="Enter snapshot name..."
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateSnapshot()
                    if (e.key === "Escape") {
                      setShowNameInput(false)
                      setSnapshotName("")
                    }
                  }}
                  className="flex-1 bg-[#252932] rounded px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#4572e3]"
                  autoFocus
                />
                <button
                  onClick={handleCreateSnapshot}
                  disabled={isCreating || !snapshotName.trim()}
                  className="p-2 bg-[#4572e3] hover:bg-[#3461d9] disabled:bg-[#2d3139] disabled:cursor-not-allowed text-white rounded cursor-pointer transition-colors"
                >
                  {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                </button>
                <button
                  onClick={() => {
                    setShowNameInput(false)
                    setSnapshotName("")
                  }}
                  disabled={isCreating}
                  className="p-2 bg-[#252932] hover:bg-[#2d3139] disabled:cursor-not-allowed text-white rounded cursor-pointer transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 pt-0">
            {isLoading && snapshots.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-gray-400" />
              </div>
            ) : snapshots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Archive size={48} className="text-gray-600 mb-4" />
                <p className="text-gray-400 text-sm">No snapshots yet</p>
                <p className="text-gray-500 text-xs mt-1">Create your first snapshot to backup your launcher</p>
              </div>
            ) : (
              <div className="space-y-3">
                {snapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="bg-[#252932] rounded p-4 hover:bg-[#2a2e36] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">{snapshot.name}</h3>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                          <span>{formatDate(snapshot.created_at)}</span>
                          <span>•</span>
                          <span>{formatBytes(snapshot.size_bytes)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRestoreSnapshot(snapshot.id, snapshot.name)}
                          disabled={isLoading}
                          className="p-2 hover:bg-[#3a3f4b] disabled:opacity-50 disabled:cursor-not-allowed rounded text-green-400 hover:text-green-300 transition-colors cursor-pointer"
                          title="Restore snapshot"
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button
                          onClick={() => handleExportSnapshot(snapshot.id, snapshot.name)}
                          disabled={isLoading}
                          className="p-2 hover:bg-[#3a3f4b] disabled:opacity-50 disabled:cursor-not-allowed rounded text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                          title="Export snapshot"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteSnapshot(snapshot.id, snapshot.name)}
                          disabled={isLoading}
                          className="p-2 hover:bg-[#3a3f4b] disabled:opacity-50 disabled:cursor-not-allowed rounded text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                          title="Delete snapshot"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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