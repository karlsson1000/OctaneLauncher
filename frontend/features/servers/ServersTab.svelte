<script lang="ts">
  import { onMount } from "svelte"
  import { Server, Plus, Search, Trash2, Play, GripVertical } from "lucide-svelte"
  import { invoke } from "@tauri-apps/api/core"
  import CreateServerModal from "./CreateServerModal.svelte"
  import ConfirmModal from "../../components/ui/ConfirmModal.svelte"
  import type { ServerInfo, McSrvStatResponse } from "../../types"
  import { store } from "../../lib/launcherStore.svelte"
  import { sanitizeHtml } from "../../lib/sanitize"

  const DEFAULT_PORT = 25565
  const REFRESH_MS = 5 * 60 * 1000
  const FETCH_TIMEOUT_MS = 10_000
  const ROW_HEIGHT = 100

  const formatAddress = (address: string, port: number) =>
    port === DEFAULT_PORT ? address : `${address}:${port}`

  const pingColor = (ping: number) =>
    ping < 80 ? "#16a34a" : ping < 200 ? "#eab308" : "#e93636"

  function joinButtonClass(busy: boolean, online: boolean) {
    if (busy) return "bg-red-500/10 text-red-400 cursor-not-allowed"
    if (online) return "bg-[#16a34a] hover:bg-[#15803d] text-[#181a1f]"
    return "bg-[var(--bg-hover-strong)] text-[var(--text-muted)] cursor-not-allowed"
  }

  let servers = $state<ServerInfo[]>([])
  let searchQuery = $state("")
  let showAddModal = $state(false)
  let serverToDelete = $state<string | null>(null)
  let launchingServer = $state<string | null>(null)

  let isAnyInstanceRunning = $derived(store.runningInstances.size > 0)
  let hasServers = $derived(servers.length > 0)
  let isFiltering = $derived(searchQuery.trim() !== "")

  let filteredServers = $derived.by(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return servers
    return servers.filter(
      s => s.name.toLowerCase().includes(query) || s.address.toLowerCase().includes(query)
    )
  })

  onMount(() => {
    loadServers()
    return cleanupDrag
  })

  $effect(() => {
    if (!hasServers) return
    const id = setInterval(refreshAll, REFRESH_MS)
    return () => clearInterval(id)
  })

  async function pingServer(address: string, port: number): Promise<number | undefined> {
    try {
      return await invoke<number>("ping_server", { address, port })
    } catch (e) {
      return undefined
    }
  }

  async function fetchServerStatus(address: string, port: number): Promise<ServerInfo | null> {
    try {
      const fullAddress = formatAddress(address, port)
      const response = await fetch(`https://api.mcsrvstat.us/3/${fullAddress}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`API returned ${response.status}`)

      const data: McSrvStatResponse = await response.json()
      const ping = data.online ? await pingServer(address, port) : undefined

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
        motd_html: data.motd?.html?.map(line => sanitizeHtml(line)),
        favicon: data.icon ? `https://api.mcsrvstat.us/icon/${fullAddress}` : undefined,
        last_checked: Date.now(),
        ping,
      }
    } catch (error) {
      return null
    }
  }

  async function persistStatus(serverName: string, status: ServerInfo) {
    try {
      await invoke("update_server_status", { serverName, status })
    } catch (e) {
    }
  }

  async function refreshServerStatus(server: ServerInfo) {
    const status = await fetchServerStatus(server.address, server.port)
    if (!status) return
    if (!servers.some(s => s.name === server.name)) return

    servers = servers.map(s => (s.name === server.name ? { ...status, name: server.name } : s))
    await persistStatus(server.name, status)
  }

  function refreshAll() {
    servers.forEach(s => refreshServerStatus(s))
  }

  async function loadServers() {
    try {
      servers = await invoke<ServerInfo[]>("get_servers")
      refreshAll()
    } catch (error) {
      servers = []
    }
  }

  async function handleServerAdded(newServer: ServerInfo) {
    try {
      await invoke("add_server", {
        name: newServer.name,
        address: newServer.address,
        port: newServer.port,
      })
    } catch (error) {
      alert(`Failed to add server: ${error}`)
      return
    }

    servers = [...servers, { ...newServer, status: "unknown" }]
    refreshServerStatus(newServer)
  }

  async function handleDeleteServer() {
    const name = serverToDelete
    if (!name) return
    try {
      await invoke("delete_server", { serverName: name })
      servers = servers.filter(s => s.name !== name)
    } catch (error) {
    } finally {
      serverToDelete = null
    }
  }

  async function handleLaunchServer(server: ServerInfo, e: MouseEvent) {
    e.stopPropagation()
    launchingServer = server.name
    try {
      await invoke("launch_server", {
        serverAddress: server.address,
        serverPort: server.port,
        serverName: server.name,
      })
      setTimeout(() => { launchingServer = null }, 1000)
    } catch (error) {
      alert(`Failed to launch server: ${error}`)
      launchingServer = null
    }
  }

  interface DragState {
    fromIndex: number
    ghostEl: HTMLElement
    origCardEl: HTMLElement
    offsetY: number
    minY: number
    maxY: number
  }

  let dragState: DragState | null = null
  let draggedOverIndex = $state<number | null>(null)

  function cleanupDrag() {
    document.removeEventListener("pointermove", onPointerMove)
    document.removeEventListener("pointerup", onPointerUp)
    document.removeEventListener("pointercancel", cleanupDrag)
    if (dragState) {
      dragState.ghostEl.remove()
      dragState.origCardEl.style.opacity = ""
    }
    dragState = null
    draggedOverIndex = null
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragState) return
    const { ghostEl, offsetY, minY, maxY } = dragState

    ghostEl.style.top = `${Math.max(minY, Math.min(e.clientY - offsetY, maxY))}px`

    const card = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>("[data-server-card]")
    const idx = card ? Number(card.dataset.serverIndex) : NaN
    draggedOverIndex = Number.isNaN(idx) ? null : idx
  }

  function onPointerUp() {
    if (!dragState) return
    const from = dragState.fromIndex
    const to = draggedOverIndex
    cleanupDrag()
    if (to === null || to === from) return

    const reordered = servers.slice()
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    persistReorder(reordered)
  }

  async function persistReorder(ordered: ServerInfo[]) {
    servers = ordered
    try {
      await invoke("reorder_servers", { serverNames: ordered.map(s => s.name) })
    } catch (e) {
    }
  }

  function handleGripPointerDown(e: PointerEvent, index: number) {
    if (isFiltering) return
    e.preventDefault()
    e.stopPropagation()

    const cardEl = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-server-card]")
    if (!cardEl) return

    const rect = cardEl.getBoundingClientRect()
    const listRect = cardEl.parentElement?.getBoundingClientRect()

    const ghost = cardEl.cloneNode(true) as HTMLElement
    ghost.removeAttribute("data-server-card")
    Object.assign(ghost.style, {
      position: "fixed",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      pointerEvents: "none",
      zIndex: "9999",
      transform: "scale(1.03)",
      opacity: "0.95",
      transition: "none",
      outline: "none",
      willChange: "transform, top",
    })
    document.body.appendChild(ghost)
    cardEl.style.opacity = "0.3"

    dragState = {
      fromIndex: index,
      ghostEl: ghost,
      origCardEl: cardEl,
      offsetY: e.clientY - rect.top,
      minY: listRect?.top ?? -Infinity,
      maxY: listRect ? listRect.bottom - rect.height : Infinity,
    }
    draggedOverIndex = index

    document.addEventListener("pointermove", onPointerMove)
    document.addEventListener("pointerup", onPointerUp)
    document.addEventListener("pointercancel", cleanupDrag)
  }
</script>

<div class="p-8 space-y-4">
  <div class="max-w-7xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        {#if hasServers}
          <div class="relative rounded-md bg-[var(--bg-tertiary)]">
            <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-20 pointer-events-none" strokeWidth={2} />
            <input
              type="text"
              placeholder="Search servers..."
              bind:value={searchQuery}
              class="w-72 bg-transparent rounded-md pl-9 pr-3 py-1.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition-all relative z-10"
            />
          </div>
        {/if}
      </div>
      <div class="flex items-center gap-2">
        <button
          onclick={() => showAddModal = true}
          class="px-4 h-8 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Plus size={16} />
          Add Server
        </button>
      </div>
    </div>

    {#if !hasServers}
      <div class="flex flex-col items-center justify-center py-14">
        <Server size={48} class="text-[var(--text-muted)] mb-3" strokeWidth={1.5} />
        <h3 class="text-base font-semibold text-[var(--text-primary)] mb-1">No servers added</h3>
        <p class="text-sm text-[var(--text-muted)] mb-4">Add your first server to get started</p>
        <button
          onclick={() => showAddModal = true}
          class="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded font-medium text-sm flex items-center gap-2 transition-all cursor-pointer"
        >
          <Plus size={16} strokeWidth={2} />
          <span>Add Server</span>
        </button>
      </div>
    {:else if filteredServers.length === 0}
      <div class="rounded-md p-8 flex flex-col items-center justify-center">
        <Search size={48} class="text-[var(--text-primary)] mb-3" strokeWidth={1.5} />
        <h3 class="text-base font-semibold text-[var(--text-primary)] mb-1">No servers found</h3>
        <p class="text-sm text-[var(--text-muted)]">Try adjusting your search query</p>
      </div>
    {:else}
      <div class="space-y-4">
        {#each filteredServers as server, index (server.name)}
          {@const isLaunching = launchingServer === server.name}
          {@const isOnline = server.status === "online"}
          {@const isBusy = isLaunching || isAnyInstanceRunning}
          {@const isOver = draggedOverIndex === index}
          <div
            data-server-card
            data-server-index={index}
            class="group flex items-center gap-3 px-4 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] {isOver ? 'outline outline-1 outline-[var(--accent-primary)]' : 'transition-colors'}"
            style="height: {ROW_HEIGHT}px"
          >
            <div
              role="presentation"
              aria-label="Drag to reorder"
              onpointerdown={e => handleGripPointerDown(e, index)}
              class="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <GripVertical size={18} strokeWidth={2} />
            </div>

            <div class="flex-shrink-0">
              {#if server.favicon}
                <img
                  src={server.favicon}
                  alt={server.name}
                  class="w-20 h-20 rounded object-cover"
                  style="image-rendering: pixelated"
                />
              {:else}
                <div class="w-20 h-20 bg-[var(--bg-secondary)] rounded flex items-center justify-center">
                  <Server size={40} class="text-[var(--text-muted)]" strokeWidth={2} />
                </div>
              {/if}
            </div>

            <div class="flex-1 min-w-0">
              <p class="font-semibold text-xl text-[var(--text-primary)] truncate leading-none mb-2">{server.name}</p>
              {#if server.motd_html}
                {#each server.motd_html.slice(0, 2) as line}
                  <p class="text-base truncate leading-snug">{@html line}</p>
                {/each}
              {:else if server.motd}
                {#each server.motd.split("\n").slice(0, 2) as line}
                  <p class="text-base text-[var(--text-muted)] truncate leading-snug">{line}</p>
                {/each}
              {:else}
                <p class="text-base text-[var(--text-muted)] truncate">{formatAddress(server.address, server.port)}</p>
              {/if}
            </div>

            <div class="flex-shrink-0 flex flex-col items-end gap-2 group-hover:hidden">
              {#if isOnline}
                {#if server.ping === undefined}
                  <span class="text-base font-medium text-[var(--text-muted)]">N/A</span>
                {:else}
                  <span class="text-base font-medium" style="color: {pingColor(server.ping)}">{server.ping}ms</span>
                {/if}
              {/if}
              {#if isOnline && server.players_online !== undefined}
                <span class="text-base text-[var(--text-muted)]">
                  {server.players_online}/{server.players_max}
                </span>
              {:else}
                <span class="text-base font-medium {server.status === 'offline' ? 'text-[#ef4444]' : 'text-[var(--text-muted)]'}">
                  {server.status === "offline" ? "Offline" : "-"}
                </span>
              {/if}
            </div>

            <div class="flex-shrink-0 items-center gap-2 hidden group-hover:flex">
              <button
                onclick={e => { e.stopPropagation(); serverToDelete = server.name }}
                aria-label="Remove server"
                class="w-10 h-10 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors cursor-pointer"
              >
                <Trash2 size={18} strokeWidth={2} />
              </button>

              <button
                onclick={e => handleLaunchServer(server, e)}
                disabled={!isOnline || isBusy}
                title={!isOnline ? "Server offline" : isAnyInstanceRunning ? "Instance already running" : undefined}
                class="flex-shrink-0 h-10 px-8 flex items-center justify-center gap-3 rounded transition-all cursor-pointer disabled:opacity-50 {joinButtonClass(isBusy, isOnline)}"
              >
                {#if isBusy}
                  <div class="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
                {:else}
                  <Play size={18} fill="currentColor" strokeWidth={0} />
                  <span class="text-base font-semibold">Join</span>
                {/if}
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

{#if showAddModal}
  <CreateServerModal
    {servers}
    onClose={() => showAddModal = false}
    onSuccess={handleServerAdded}
  />
{/if}

<ConfirmModal
  isOpen={serverToDelete !== null}
  title="Remove Server"
  message={`Are you sure you want to remove "${serverToDelete}"? This action cannot be undone.`}
  confirmText="Remove"
  cancelText="Cancel"
  type="danger"
  onConfirm={handleDeleteServer}
  onCancel={() => serverToDelete = null}
/>
