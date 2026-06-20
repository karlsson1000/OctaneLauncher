import { Server, Plus, Search, Trash2, Play, GripVertical } from "lucide-react"
import { useState, useEffect, useRef, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { CreateServerModal } from "./CreateServerModal"
import { ConfirmModal } from "../../components/ui/ConfirmModal"
import type { ServerInfo, McSrvStatResponse } from "../../types"

interface ServersTabProps {
  runningInstances: Set<string>
}

function PingDisplay({ ping, status }: { ping?: number; status: string }) {
  if (status !== "online") return null
  if (ping === undefined) {
    return (
      <span className="text-base font-medium text-[var(--text-muted)]">
        N/A
      </span>
    )
  }
  const color = ping < 80 ? "#16a34a" : ping < 200 ? "#eab308" : "#e93636"
  return (
    <span className="text-base font-medium" style={{ color }}>
      {ping}ms
    </span>
  )
}

export function ServersTab({ runningInstances }: ServersTabProps) {
  const [servers, setServers] = useState<ServerInfo[]>([])
  const serversRef = useRef(servers)
  serversRef.current = servers
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [serverToDelete, setServerToDelete] = useState<string | null>(null)
  const [launchingServer, setLaunchingServer] = useState<string | null>(null)
  const isAnyInstanceRunning = runningInstances.size > 0

  useEffect(() => { loadServers() }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      serversRef.current.forEach(server => refreshServerStatus(server))
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  const loadServers = async () => {
    try {
      const serverList = await invoke<ServerInfo[]>("get_servers")
      setServers(serverList)
      serverList.forEach(server => refreshServerStatus(server))
    } catch (error) {
      console.error("Failed to load servers:", error)
      setServers([])
    }
  }

  const fetchServerStatus = async (address: string, port: number): Promise<ServerInfo | null> => {
    try {
      const fullAddress = port === 25565 ? address : `${address}:${port}`
      const response = await fetch(`https://api.mcsrvstat.us/3/${fullAddress}`, {
        headers: { "User-Agent": "OctaneLauncher/1.0" },
      })

      if (!response.ok) throw new Error(`API returned ${response.status}`)

      const data: McSrvStatResponse = await response.json()

      let ping: number | undefined = undefined
      if (data.online) {
        try {
          ping = await invoke<number>("ping_server", { address, port })
        } catch (e) {
          console.error("Failed to ping server:", e)
        }
      }

      return {
        name: address,
        address,
        port,
        status: data.online ? "online" : "offline",
        players_online: data.players?.online,
        players_max: data.players?.max,
        players_list: data.players?.list,
        version: data.version || data.protocol?.name,
        motd: data.motd?.clean?.join("\n"),
        motd_html: data.motd?.html,
        favicon: data.icon ? `https://api.mcsrvstat.us/icon/${fullAddress}` : undefined,
        last_checked: Date.now(),
        ping,
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
        const updated = { ...statusData, name: server.name }
        setServers(prev => prev.map(s => s.name === server.name ? updated : s))
        try {
          await invoke("update_server_status", { serverName: server.name, status: statusData })
        } catch (e) { console.error("Failed to save server status:", e) }
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
    } catch (error) {
      console.error("Delete error:", error)
    } finally {
      setServerToDelete(null)
    }
  }

  const handleServerAdded = async (newServer: ServerInfo) => {
    try {
      await invoke("add_server", { name: newServer.name, address: newServer.address, port: newServer.port })
    } catch (error) {
      console.error("Failed to save server:", error)
      alert(`Failed to add server: ${error}`)
      return
    }

    const statusData = await fetchServerStatus(newServer.address, newServer.port)

    if (statusData) {
      const serverWithStatus = { ...statusData, name: newServer.name }
      setServers(prev => [...prev, serverWithStatus])
      try {
        await invoke("update_server_status", { serverName: newServer.name, status: statusData })
      } catch (e) { console.error("Failed to save server status:", e) }
    } else {
      setServers(prev => [...prev, { ...newServer, status: "unknown" }])
    }
  }

  const filteredServers = servers.filter(server =>
    server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    server.address.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const dragState = useRef<{
    fromIndex: number
    draggedOverIndex: number | null
  } | null>(null)

  const persistReorder = useCallback(async (ordered: ServerInfo[]) => {
    setServers(ordered)
    try {
      await invoke("reorder_servers", { serverNames: ordered.map(s => s.name) })
    } catch (e) {
      console.error("Failed to reorder servers:", e)
    }
  }, [])

  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null)

  const cleanupDrag = useCallback(() => {
    document.removeEventListener("pointermove", onPointerMove)
    document.removeEventListener("pointerup", onPointerUp)
    document.removeEventListener("pointercancel", onPointerCancel)
    dragState.current = null
    setDraggedOverIndex(null)
  }, [])

  const onPointerUp = useCallback((_e: PointerEvent) => {
    const state = dragState.current
    if (!state) return
    const fromIdx = state.fromIndex
    const toIdx = state.draggedOverIndex
    cleanupDrag()
    if (toIdx === null || fromIdx === toIdx) return

    const list = filteredServers
    const reordered = list.slice()
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    if (searchQuery) {
      const movedNames = new Set(reordered.map(s => s.name))
      const remaining = servers.filter(s => !movedNames.has(s.name))
      persistReorder([...reordered, ...remaining])
    } else {
      persistReorder(reordered)
    }
  }, [filteredServers, servers, searchQuery, persistReorder, cleanupDrag])

  const onPointerMove = useCallback((e: PointerEvent) => {
    const state = dragState.current
    if (!state) return
    const els = document.elementsFromPoint(e.clientX, e.clientY)
    for (const el of els) {
      const card = (el as HTMLElement).closest("[data-server-card]") as HTMLElement | null
      if (card) {
        const idx = Number(card.dataset.serverIndex)
        if (!isNaN(idx) && idx !== state.draggedOverIndex) {
          state.draggedOverIndex = idx
          setDraggedOverIndex(idx)
        }
        return
      }
    }
    if (state.draggedOverIndex !== null) {
      state.draggedOverIndex = null
      setDraggedOverIndex(null)
    }
  }, [])

  const onPointerCancel = useCallback((_e: PointerEvent) => {
    cleanupDrag()
  }, [cleanupDrag])

  const handleGripPointerDown = (e: React.PointerEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    dragState.current = { fromIndex: index, draggedOverIndex: index }
    setDraggedOverIndex(index)
    document.addEventListener("pointermove", onPointerMove)
    document.addEventListener("pointerup", onPointerUp)
    document.addEventListener("pointercancel", onPointerCancel)
  }

  const handleLaunchServer = async (server: ServerInfo, e: React.MouseEvent) => {
    e.stopPropagation()
    if (server.status !== "online") {
      alert("Server must be online to connect")
      return
    }
    setLaunchingServer(server.name)
    try {
      await invoke("launch_server", {
        serverAddress: server.address,
        serverPort: server.port,
        serverName: server.name,
      })
      setTimeout(() => setLaunchingServer(null), 1000)
    } catch (error) {
      console.error("Failed to launch server:", error)
      alert(`Failed to launch server: ${error}`)
      setLaunchingServer(null)
    }
  }

  return (
    <>
      <div className="p-8 space-y-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {servers.length > 0 && (
                <div className="relative rounded-md bg-[var(--bg-tertiary)]">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-20 pointer-events-none" strokeWidth={2} />
                  <input
                    type="text"
                    placeholder="Search servers..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-72 bg-transparent rounded-md pl-9 pr-3 py-1.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition-all relative z-10"
                  />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 h-8 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus size={16} />
                Add Server
              </button>
            </div>
          </div>

          {servers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14">
              <Server size={48} className="text-[var(--text-muted)] mb-3" strokeWidth={1.5} />
              <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">No servers added</h3>
              <p className="text-sm text-[var(--text-muted)] mb-4">Add your first server to get started</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded font-medium text-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={16} strokeWidth={2} />
                <span>Add Server</span>
              </button>
            </div>
          ) : filteredServers.length === 0 ? (
            <div className="rounded-md p-8 flex flex-col items-center justify-center">
              <Search size={48} className="text-[var(--text-primary)] mb-3" strokeWidth={1.5} />
              <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">No servers found</h3>
              <p className="text-sm text-[var(--text-muted)]">Try adjusting your search query</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredServers.map((server, index) => {
                const displayAddress = server.port === 25565 ? server.address : `${server.address}:${server.port}`
                const isLaunching = launchingServer === server.name
                const isOnline = server.status === "online"
                const isOver = draggedOverIndex === index

                return (
                  <div
                    key={server.name}
                    data-server-card
                    data-server-index={index}
                    className={`group flex items-center gap-3 px-4 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] ${isOver ? "outline outline-2 outline-[var(--accent-primary)]" : "transition-colors"}`}
                    style={{ height: 100 }}
                  >
                    <div
                      onPointerDown={e => handleGripPointerDown(e, index)}
                      className="flex-shrink-0 cursor-grab active:cursor-grabbing text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <GripVertical size={18} strokeWidth={2} />
                    </div>
                    <div className="flex-shrink-0">
                      {server.favicon ? (
                        <img
                          src={server.favicon}
                          alt={server.name}
                          className="w-20 h-20 rounded object-cover"
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : (
                        <div className="w-20 h-20 bg-[var(--bg-secondary)] rounded flex items-center justify-center">
                          <Server size={40} className="text-[var(--text-muted)]" strokeWidth={2} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xl text-[var(--text-primary)] truncate leading-none mb-2">{server.name}</p>
                      {server.motd_html ? (
                        <>
                          <p className="text-base truncate leading-snug" dangerouslySetInnerHTML={{ __html: server.motd_html[0] }} />
                          {server.motd_html[1] && (
                            <p className="text-base truncate leading-snug" dangerouslySetInnerHTML={{ __html: server.motd_html[1] }} />
                          )}
                        </>
                      ) : server.motd ? (
                        <>
                          <p className="text-base text-[var(--text-muted)] truncate leading-snug">{server.motd.split("\n")[0]}</p>
                          {server.motd.includes("\n") && (
                            <p className="text-base text-[var(--text-muted)] truncate leading-snug">{server.motd.split("\n")[1]}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-base text-[var(--text-muted)] truncate">{displayAddress}</p>
                      )}
                    </div>

                    <div className="flex-shrink-0 flex flex-col items-end gap-2 group-hover:hidden">
                      <PingDisplay ping={server.ping} status={server.status} />
                      {isOnline && server.players_online !== undefined ? (
                        <span className="text-base text-[var(--text-muted)]">
                          {server.players_online}/{server.players_max}
                        </span>
                      ) : (
                        <span className={`text-base font-medium ${server.status === "offline" ? "text-[#ef4444]" : "text-[var(--text-muted)]"}`}>
                          {server.status === "offline" ? "Offline" : "-"}
                        </span>
                      )}
                    </div>

                    <div className="flex-shrink-0 items-center gap-2 hidden group-hover:flex">
                      <button
                        onClick={e => { e.stopPropagation(); setServerToDelete(server.name) }}
                        className="w-10 h-10 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors cursor-pointer"
                      >
                        <Trash2 size={18} strokeWidth={2} />
                      </button>

                      <button
                        onClick={e => handleLaunchServer(server, e)}
                        disabled={!isOnline || isLaunching || isAnyInstanceRunning}
                        title={!isOnline ? "Server offline" : isAnyInstanceRunning ? "Instance already running" : undefined}
                        className={`flex-shrink-0 h-10 px-8 flex items-center justify-center gap-3 rounded transition-all active:scale-95 cursor-pointer ${
                          isLaunching || isAnyInstanceRunning
                            ? "bg-red-500/10 text-red-400 cursor-not-allowed"
                            : isOnline
                            ? "bg-[#16a34a] hover:bg-[#15803d] text-[#181a1f]"
                            : "bg-[var(--bg-hover-strong)] text-[var(--text-muted)] cursor-not-allowed"
                        } disabled:opacity-50`}
                      >
                        {isLaunching || isAnyInstanceRunning ? (
                          <div className="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                        ) : (
                          <>
                            <Play size={18} fill="currentColor" strokeWidth={0} />
                            <span className="text-base font-semibold">Join</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
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
        title="Remove Server"
        message={`Are you sure you want to remove "${serverToDelete}"? This action cannot be undone.`}
        confirmText="Remove"
        cancelText="Cancel"
        type="danger"
        onConfirm={handleDeleteServer}
        onCancel={() => setServerToDelete(null)}
      />
    </>
  )
}