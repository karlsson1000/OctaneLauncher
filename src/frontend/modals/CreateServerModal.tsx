import { useState } from "react"
import { X, Server, AlertCircle, Loader2 } from "lucide-react"
import { AlertModal } from "./ConfirmModal"

interface ServerInfo {
  name: string
  address: string
  port: number
  status: "online" | "offline" | "unknown"
  players_online?: number
  players_max?: number
  version?: string
  motd?: string
  favicon?: string
}

interface CreateServerModalProps {
  servers: ServerInfo[]
  onClose: () => void
  onSuccess: (server: ServerInfo) => void
}

export function CreateServerModal({ servers, onClose, onSuccess }: CreateServerModalProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [serverName, setServerName] = useState("")
  const [serverAddress, setServerAddress] = useState("")
  const [serverPort, setServerPort] = useState("")
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isClosing, setIsClosing] = useState(false)
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null>(null)

  // Check if server name already exists
  const serverExists = servers.some(
    server => server.name.toLowerCase() === serverName.trim().toLowerCase()
  )

  // Validate port number - empty string is valid (defaults to 25565)
  const portNumber = serverPort.trim() === "" ? 25565 : parseInt(serverPort)
  const isValidPort = serverPort.trim() === "" || (!isNaN(portNumber) && portNumber > 0 && portNumber <= 65535)

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 150)
  }

  const testConnection = async () => {
    if (!serverAddress.trim() || !isValidPort) return

    setIsTesting(true)
    setTestResult(null)

    try {
      const fullAddress = portNumber === 25565 ? serverAddress : `${serverAddress}:${portNumber}`
      const response = await fetch(`https://api.mcsrvstat.us/3/${fullAddress}`, {
        headers: {
          'User-Agent': 'OctaneLauncher/1.0'
        }
      })

      if (!response.ok) {
        setTestResult({ 
          success: false, 
          message: "Failed to connect to server status API" 
        })
        return
      }

      const data = await response.json()

      if (data.online) {
        setTestResult({ 
          success: true, 
          message: `Server is online! Version: ${data.protocol?.name || data.version || 'Unknown'}` 
        })
      } else {
        setTestResult({ 
          success: false, 
          message: "Server is offline or unreachable" 
        })
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: "Failed to test connection" 
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleCreateServer = async () => {
    if (!serverName.trim() || !serverAddress.trim() || !isValidPort || serverExists) return

    setIsCreating(true)
    
    try {
      const newServer: ServerInfo = {
        name: serverName.trim(),
        address: serverAddress.trim(),
        port: portNumber,
        status: "unknown"
      }

      onSuccess(newServer)
      handleClose()
    } catch (error) {
      console.error("Create server error:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to add server: ${error}`,
        type: "danger"
      })
    } finally {
      setIsCreating(false)
    }
  }

  const isCreateDisabled = 
    isCreating || 
    !serverName.trim() || 
    !serverAddress.trim() ||
    !isValidPort ||
    serverExists

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
          transition: none !important;
        }
        
        .blur-border:hover::before {
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.08),
            rgba(255, 255, 255, 0.04)
          );
        }
      `}</style>
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop ${isClosing ? 'closing' : ''}`}
        onClick={handleClose}
      >
        <div 
          className={`blur-border bg-[#181a1f] rounded w-full max-w-md shadow-2xl modal-content ${isClosing ? 'closing' : ''}`}
          onClick={(e) => e.stopPropagation()}
          style={{ pointerEvents: 'auto' }}
        >
          <div className="flex items-center justify-between px-6 pt-6 pb-5">
            <div>
              <h2 className="text-xl font-semibold text-[#e6e6e6] tracking-tight">Add Server</h2>
            </div>
            <button 
              onClick={handleClose} 
              className="p-1.5 hover:bg-[#3a3f4b] rounded transition-colors text-gray-400 hover:text-[#e6e6e6] cursor-pointer"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="px-6 pb-4 space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#e6e6e6] mb-2.5">Server Name</label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="My Server"
                className={`w-full bg-[#22252b] rounded px-4 py-3.5 text-sm text-[#e6e6e6] placeholder-gray-500 focus:outline-none transition-all ${
                  serverExists && serverName.trim()
                    ? 'ring-2 ring-red-500'
                    : ''
                }`}
                disabled={isCreating}
              />
              {serverExists && serverName.trim() && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400">
                  <AlertCircle size={12} strokeWidth={2} />
                  <span>A server with this name already exists</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#e6e6e6] mb-2.5">Server Address</label>
              <input
                type="text"
                value={serverAddress}
                onChange={(e) => setServerAddress(e.target.value)}
                placeholder="mc.hypixel.net"
                className="w-full bg-[#22252b] rounded px-4 py-3.5 text-sm text-[#e6e6e6] placeholder-gray-500 focus:outline-none transition-all"
                disabled={isCreating}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#e6e6e6] mb-2.5">Server Port (Optional)</label>
              <input
                type="text"
                value={serverPort}
                onChange={(e) => setServerPort(e.target.value)}
                placeholder="25565"
                className={`w-full bg-[#22252b] rounded px-4 py-3.5 text-sm text-[#e6e6e6] placeholder-gray-500 focus:outline-none transition-all ${
                  serverPort && !isValidPort
                    ? 'ring-2 ring-red-500'
                    : ''
                }`}
                disabled={isCreating}
              />
              {serverPort && !isValidPort && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400">
                  <AlertCircle size={12} strokeWidth={2} />
                  <span>Port must be between 1 and 65535</span>
                </div>
              )}
            </div>

            <button
              onClick={testConnection}
              disabled={!serverAddress.trim() || !isValidPort || isTesting}
              className="w-full px-4 py-3 bg-[#22252b] hover:bg-[#3a3f4b] disabled:opacity-50 disabled:cursor-not-allowed text-[#e6e6e6] rounded font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {isTesting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Testing Connection...</span>
                </>
              ) : (
                <>
                  <Server size={16} />
                  <span>Test Connection</span>
                </>
              )}
            </button>

            {testResult && (
              <div className={`flex items-start gap-2 p-3 rounded ${
                testResult.success 
                  ? 'bg-green-500/10 text-green-400' 
                  : 'bg-red-500/10 text-red-400'
              }`}>
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" strokeWidth={2} />
                <span className="text-xs">{testResult.message}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-3">
            <button
              onClick={handleClose}
              disabled={isCreating}
              className="px-5 py-3 bg-[#22252b] hover:bg-[#3a3f4b] text-[#e6e6e6] rounded font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateServer}
              disabled={isCreateDisabled}
              className="px-5 py-3 bg-[#4572e3] hover:bg-[#3461d1] text-white rounded font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <span>Add Server</span>
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