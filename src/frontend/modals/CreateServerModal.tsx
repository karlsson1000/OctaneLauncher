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

  const testConnection = async () => {
    if (!serverAddress.trim() || !isValidPort) return

    setIsTesting(true)
    setTestResult(null)

    try {
      const fullAddress = portNumber === 25565 ? serverAddress : `${serverAddress}:${portNumber}`
      const response = await fetch(`https://api.mcsrvstat.us/3/${fullAddress}`, {
        headers: {
          'User-Agent': 'AtomicLauncher/1.0'
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
      onClose()
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
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#1a1a1a] rounded-md w-full max-w-md shadow-2xl">
          <div className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <Server size={32} className="text-[#16a34a]" strokeWidth={1.5} />
              <div>
                <h2 className="text-base font-semibold text-[#e8e8e8] tracking-tight">Add Server</h2>
                <p className="text-xs text-[#808080] mt-0.5">Add a new Minecraft server</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-1.5 hover:bg-[#0d0d0d] rounded transition-colors text-[#808080] hover:text-[#e8e8e8] cursor-pointer"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#808080] mb-2">Server Name</label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="My Server"
                className={`w-full bg-[#0d0d0d] rounded px-3 py-2.5 text-sm text-[#e8e8e8] placeholder-[#4a4a4a] focus:outline-none transition-colors ${
                  serverExists && serverName.trim()
                    ? 'ring-1 ring-red-500/50 focus:ring-red-500'
                    : 'focus:ring-1 focus:ring-[#16a34a]'
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
              <label className="block text-xs font-medium text-[#808080] mb-2">Server Address</label>
              <input
                type="text"
                value={serverAddress}
                onChange={(e) => setServerAddress(e.target.value)}
                placeholder="mc.hypixel.net"
                className="w-full bg-[#0d0d0d] rounded px-3 py-2.5 text-sm text-[#e8e8e8] placeholder-[#4a4a4a] focus:outline-none focus:ring-1 focus:ring-[#16a34a] transition-colors"
                disabled={isCreating}
              />
              <p className="text-xs text-[#4a4a4a] mt-1.5">Enter the server IP or domain</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#808080] mb-2">Server Port (Optional)</label>
              <input
                type="text"
                value={serverPort}
                onChange={(e) => setServerPort(e.target.value)}
                placeholder="25565"
                className={`w-full bg-[#0d0d0d] rounded px-3 py-2.5 text-sm text-[#e8e8e8] placeholder-[#4a4a4a] focus:outline-none transition-colors ${
                  serverPort && !isValidPort
                    ? 'ring-1 ring-red-500/50 focus:ring-red-500'
                    : 'focus:ring-1 focus:ring-[#16a34a]'
                }`}
                disabled={isCreating}
              />
              {serverPort && !isValidPort && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400">
                  <AlertCircle size={12} strokeWidth={2} />
                  <span>Port must be between 1 and 65535</span>
                </div>
              )}
              <p className="text-xs text-[#4a4a4a] mt-1.5">Leave empty to use default port (25565)</p>
            </div>

            {/* Test Connection Button */}
            <button
              onClick={testConnection}
              disabled={!serverAddress.trim() || !isValidPort || isTesting}
              className="w-full px-4 py-2.5 bg-[#2a2a2a] hover:bg-[#1f1f1f] disabled:opacity-50 disabled:cursor-not-allowed text-[#e8e8e8] rounded font-medium text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isTesting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Testing Connection...</span>
                </>
              ) : (
                <>
                  <Server size={14} />
                  <span>Test Connection</span>
                </>
              )}
            </button>

            {/* Test Result */}
            {testResult && (
              <div className={`flex items-start gap-2 p-3 rounded border ${
                testResult.success 
                  ? 'bg-[#16a34a]/10 border-[#16a34a]/20 text-[#16a34a]' 
                  : 'bg-[#dc2626]/10 border-[#dc2626]/20 text-[#dc2626]'
              }`}>
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" strokeWidth={2} />
                <span className="text-xs">{testResult.message}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 p-5">
            <button
              onClick={onClose}
              disabled={isCreating}
              className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#e8e8e8] rounded font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateServer}
              disabled={isCreateDisabled}
              className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white rounded font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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