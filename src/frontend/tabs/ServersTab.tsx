import { Server, Plus, Search, Trash2, Play, MoreHorizontal } from "lucide-react"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { useTranslation } from "react-i18next"
import { CreateServerModal } from "../modals/CreateServerModal"
import { ConfirmModal } from "../modals/ConfirmModal"

interface PlayerInfo {
  name: string
  uuid: string
}

interface ServerInfo {
  name: string
  address: string
  port: number
  status: "online" | "offline" | "unknown"
  players_online?: number
  players_max?: number
  players_list?: PlayerInfo[]
  version?: string
  motd?: string
  favicon?: string
  last_checked?: number
}

interface McSrvStatResponse {
  online: boolean
  ip?: string
  port?: number
  hostname?: string
  version?: string
  protocol?: {
    version: number
    name?: string
  }
  icon?: string
  motd?: {
    clean?: string[]
  }
  players?: {
    online: number
    max: number
    list?: PlayerInfo[]
  }
}

interface ServersTabProps {
  launchingInstanceName: string | null
  runningInstances: Set<string>
}

export function ServersTab({ runningInstances }: ServersTabProps) {
  const { t } = useTranslation()
  const [servers, setServers] = useState<ServerInfo[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedServer, setSelectedServer] = useState<ServerInfo | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [serverToDelete, setServerToDelete] = useState<string | null>(null)
  const [launchingServer, setLaunchingServer] = useState<string | null>(null)
  const isAnyInstanceRunning = runningInstances.size > 0

  useEffect(() => {
    loadServers()
  }, [])

  // Auto-refresh all servers every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      servers.forEach(server => {
        refreshServerStatus(server)
      })
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [servers])

  const loadServers = async () => {
    try {
      const serverList = await invoke<ServerInfo[]>("get_servers")
      setServers(serverList)
      // Refresh status for all servers on load
      serverList.forEach(server => {
        refreshServerStatus(server)
      })
    } catch (error) {
      console.error("Failed to load servers:", error)
      setServers([])
    }
  }

  const fetchServerStatus = async (address: string, port: number): Promise<ServerInfo | null> => {
    try {
      const fullAddress = port === 25565 ? address : `${address}:${port}`
      const response = await fetch(`https://api.mcsrvstat.us/3/${fullAddress}`, {
        headers: {
          'User-Agent': 'AtomicLauncher/1.0'
        }
      })
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const data: McSrvStatResponse = await response.json()
      
      console.log('API Response for', fullAddress, ':', data)
      console.log('Players list:', data.players?.list)
      
      return {
        name: address,
        address: address,
        port: port,
        status: data.online ? "online" : "offline",
        players_online: data.players?.online,
        players_max: data.players?.max,
        players_list: data.players?.list,
        version: data.version || data.protocol?.name,
        motd: data.motd?.clean?.join('\n'),
        favicon: data.icon ? `https://api.mcsrvstat.us/icon/${fullAddress}` : undefined,
        last_checked: Date.now()
      }
    } catch (error) {
      console.error("Failed to fetch server status:", error)
      return null
    }
  }

  const refreshServerStatus = async (server: ServerInfo) => {
    try {
      const statusData = await fetchServerStatus(server.address, server.port)
      
      if (statusData) {
        // Update server in list
        setServers(prev => prev.map(s => 
          s.name === server.name 
            ? { ...statusData, name: server.name } 
            : s
        ))
        
        // Update selected server if it's the one being refreshed
        if (selectedServer?.name === server.name) {
          setSelectedServer({ ...statusData, name: server.name })
        }

        // Save updated status to backend
        try {
          await invoke("update_server_status", {
            serverName: server.name,
            status: statusData
          })
        } catch (error) {
          console.error("Failed to save server status:", error)
        }
      }
    } catch (error) {
      console.error("Failed to refresh server:", error)
    }
  }

  const handleDeleteServer = async () => {
    if (!serverToDelete) return

    try {
      await invoke("delete_server", { serverName: serverToDelete })
      await loadServers()
      if (selectedServer?.name === serverToDelete) {
        setSelectedServer(null)
      }
    } catch (error) {
      console.error("Delete error:", error)
    } finally {
      setServerToDelete(null)
    }
  }

  const handleServerAdded = async (newServer: ServerInfo) => {
    // First, save the server to backend
    try {
      await invoke("add_server", {
        name: newServer.name,
        address: newServer.address,
        port: newServer.port,
      })
    } catch (error) {
      console.error("Failed to save server:", error)
      alert(`Failed to add server: ${error}`)
      return
    }

    // Then fetch initial status for the new server
    const statusData = await fetchServerStatus(newServer.address, newServer.port)
    
    if (statusData) {
      const serverWithStatus = { ...statusData, name: newServer.name }
      setServers(prev => [...prev, serverWithStatus])
      
      // Update backend with status
      try {
        await invoke("update_server_status", {
          serverName: newServer.name,
          status: statusData
        })
      } catch (error) {
        console.error("Failed to save server status:", error)
      }
    } else {
      // Add server even if status fetch failed
      setServers(prev => [...prev, { ...newServer, status: "unknown" }])
    }
  }

  const handleLaunchServer = async (server: ServerInfo, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (server.status !== "online") {
      alert(t('servers.errors.serverNotOnline'))
      return
    }

    setLaunchingServer(server.name)

    try {
      await invoke("launch_server", {
        serverAddress: server.address,
        serverPort: server.port,
        serverName: server.name
      })

      setTimeout(() => {
        setLaunchingServer(null)
      }, 1000)
    } catch (error) {
      console.error("Failed to launch server:", error)
      alert(`${t('servers.errors.launchFailed')}: ${error}`)
      setLaunchingServer(null)
    }
  }

  const filteredServers = servers.filter(server =>
    server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    server.address.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "text-[#16a34a]"
      case "offline": return "text-[#dc2626]"
      default: return "text-[#7d8590]"
    }
  }

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case "online": return "bg-[#16a34a]/10"
      case "offline": return "bg-[#dc2626]/10"
      default: return "bg-[#7d8590]/10"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "online": return t('servers.status.online')
      case "offline": return t('servers.status.offline')
      default: return t('servers.status.unknown')
    }
  }

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
              <h1 className="text-2xl font-semibold text-[#e6e6e6] tracking-tight">{t('servers.title')}</h1>
              <p className="text-sm text-[#7d8590] mt-0.5">{t('servers.subtitle')}</p>
            </div>
            <div className="flex items-center gap-2">
              {servers.length > 0 && (
                <div className="relative blur-border-input rounded-md bg-[#22252b]">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7d8590] z-20 pointer-events-none" strokeWidth={2} />
                  <input
                    type="text"
                    placeholder={t('servers.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-56 bg-transparent rounded-md pl-9 pr-3 py-1.5 text-sm text-[#e6e6e6] placeholder-[#7d8590] focus:outline-none transition-all relative z-10"
                  />
                </div>
              )}
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 h-8 bg-[#4572e3] hover:bg-[#3461d1] text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus size={16} />
                {t('servers.addButton')}
              </button>
            </div>
          </div>

          {servers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14">
              <Server size={48} className="text-[#7d8590] mb-3" strokeWidth={1.5} />
              <h3 className="text-base font-semibold text-[#e6e6e6] mb-1">{t('servers.noServers.title')}</h3>
              <p className="text-sm text-[#7d8590] mb-4">{t('servers.noServers.description')}</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-[#4572e3] hover:bg-[#3461d1] text-white rounded font-medium text-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={16} strokeWidth={2} />
                <span>{t('servers.noServers.addButton')}</span>
              </button>
            </div>
          ) : filteredServers.length === 0 ? (
            <div className="rounded-md p-8 flex flex-col items-center justify-center">
              <Search size={48} className="text-[#e6e6e6] mb-3" strokeWidth={1.5} />
              <h3 className="text-base font-semibold text-[#e6e6e6] mb-1">{t('servers.noSearchResults.title')}</h3>
              <p className="text-sm text-[#7d8590]">{t('servers.noSearchResults.description')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredServers.map((server) => {
                const displayAddress = server.port === 25565 
                  ? server.address 
                  : `${server.address}:${server.port}`
                
                const isLaunching = launchingServer === server.name
                
                return (
                  <div
                    key={server.name}
                    onClick={() => setSelectedServer(server)}
                    className="blur-border group bg-[#22252b] rounded-md p-4 cursor-pointer transition-all relative"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setServerToDelete(server.name)
                      }}
                      className="absolute top-4 right-4 px-3 py-2 bg-[#dc2626]/10 hover:bg-[#dc2626]/20 text-[#dc2626] rounded text-xs font-medium transition-all cursor-pointer z-20"
                      title={t('servers.removeTooltip')}
                    >
                      <Trash2 size={14} />
                    </button>

                    <div className="flex gap-3 mb-2 pr-10 relative z-0">
                      {server.favicon ? (
                        <img 
                          src={server.favicon} 
                          alt={server.name} 
                          className="w-16 h-16 rounded object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-[#181a1f] rounded flex items-center justify-center flex-shrink-0">
                          <Server size={28} className="text-[#3a3f4b]" strokeWidth={1.5} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base text-[#e6e6e6] truncate mb-0">
                          {server.name}
                        </h3>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-[#7d8590] truncate">
                            {displayAddress}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBgColor(server.status)} ${getStatusColor(server.status)}`}>
                            {getStatusText(server.status)}
                          </span>
                          {server.version && (
                            <span className="text-xs text-[#7d8590] truncate">{server.version}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {server.motd && (
                      <p className="text-xs text-[#7d8590] mb-2 truncate leading-relaxed relative z-0">
                        {server.motd}
                      </p>
                    )}

                    {server.status === "online" && server.players_online !== undefined && (
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-[#e6e6e6]">{t('servers.players')}</span>
                        <div className="flex items-center gap-3">
                          {server.players_list && server.players_list.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <div className="flex items-center -space-x-1.5">
                                {server.players_list.slice(0, 5).map((player, index) => (
                                  <img
                                    key={player.uuid}
                                    src={`https://cravatar.eu/avatar/${player.name}/32`}
                                    alt={player.name}
                                    title={player.name}
                                    className="w-5 h-5 rounded border-2 border-[#22252b] relative"
                                    style={{ zIndex: 5 - index }}
                                  />
                                ))}
                              </div>
                              {server.players_list.length > 5 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // Handle showing all players
                                    console.log('Show all players for', server.name)
                                  }}
                                  className="flex items-center justify-center w-5 h-5 rounded hover:bg-[#3a3f4b] transition-colors cursor-pointer"
                                  title={`${server.players_list.length - 5} more players`}
                                >
                                  <MoreHorizontal size={12} className="text-[#7d8590] hover:text-[#e6e6e6]" strokeWidth={2.5} />
                                </button>
                              )}
                            </div>
                          )}
                          <span className="text-sm font-medium text-[#e6e6e6]">
                            {server.players_online.toLocaleString()} / {server.players_max?.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={(e) => handleLaunchServer(server, e)}
                      disabled={server.status !== "online" || isLaunching || isAnyInstanceRunning}
                      className={`w-full py-2.5 rounded font-medium text-sm flex items-center justify-center gap-2 transition-all relative z-20 ${
                        isAnyInstanceRunning
                          ? "bg-red-500/10 text-red-400 cursor-not-allowed"
                          : isLaunching
                          ? "bg-red-500/10 text-red-400 cursor-not-allowed"
                          : server.status === "online"
                          ? "bg-[#16a34a]/10 hover:bg-[#16a34a]/20 text-[#16a34a] cursor-pointer"
                          : "bg-[#3a3f4b] text-[#7d8590] cursor-not-allowed"
                      }`}
                    >
                      {isAnyInstanceRunning || isLaunching ? (
                        <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                      ) : (
                        <Play size={16} fill="currentColor" strokeWidth={0} />
                      )}
                      <span>
                        {isAnyInstanceRunning ? t('servers.instanceRunning') : isLaunching ? t('servers.launching') : t('servers.play')}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {showAddModal && (
          <CreateServerModal
            servers={servers}
            onClose={() => setShowAddModal(false)}
            onSuccess={handleServerAdded}
          />
        )}

        <ConfirmModal
          isOpen={serverToDelete !== null}
          title={t('servers.confirmRemove.title')}
          message={t('servers.confirmRemove.message', { name: serverToDelete })}
          confirmText={t('servers.confirmRemove.confirm')}
          cancelText={t('common.actions.cancel')}
          type="danger"
          onConfirm={handleDeleteServer}
          onCancel={() => setServerToDelete(null)}
        />
      </div>
    </>
  )
}