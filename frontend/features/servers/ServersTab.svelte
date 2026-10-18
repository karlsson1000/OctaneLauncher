<script lang="ts">
  import { onMount } from "svelte"
  import { Server, Plus, Search, Trash2, Play, ArrowUp, ArrowDown } from "lucide-svelte"
  import { invoke } from "@tauri-apps/api/core"
  import CreateServerModal from "./CreateServerModal.svelte"
  import ConfirmModal from "../../components/ui/ConfirmModal.svelte"
  import type { ServerInfo, McSrvStatResponse } from "../../types"
  import { store } from "../../lib/launcherStore.svelte"
  import { sanitizeHtml } from "../../lib/sanitize"

  const DEFAULT_PORT = 25565
  const REFRESH_MS = 5 * 60 * 1000
  const FETCH_TIMEOUT_MS = 10_000
  const LAUNCH_COOLDOWN_MS = 1000
  const ROW_HEIGHT = 100

  const formatAddress = (address: string, port: number) =>
    port === DEFAULT_PORT ? address : `${address}:${port}`

  const pingColor = (ping: number) =>
    ping < 80 ? "#16a34a" : ping < 200 ? "#eab308" : "#e93636"

  function joinButtonClass(launching: boolean, online: boolean) {
    if (launching) return "bg-red-500/10 text-red-400 cursor-not-allowed"
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
  })

  $effect(() => {
    if (!hasServers) return
    const id = setInterval(refreshAll, REFRESH_MS)
    return () => clearInterval(id)
  })

  async function pingServer(address: string, port: number): Promise<number | undefined> {
    try {
      return await invoke<number>("ping_server", { address, port })
    } catch {
      return undefined
    }
  }

  async function fetchServerStatus(address: string, port: number): Promise<Omit<ServerInfo, "name"> | null> {
    const fullAddress = formatAddress(address, port)
    try {
      const response = await fetch(`https://api.mcsrvstat.us/3/${fullAddress}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`API returned ${response.status}`)

      const data: McSrvStatResponse = await response.json()
      const ping = data.online ? await pingServer(address, port) : undefined

      return {
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
    } catch {
      return null
    }
  }

  async function refreshServerStatus(server: ServerInfo) {
    const status = await fetchServerStatus(server.address, server.port)
    if (!status) return
    if (!servers.some(s => s.name === server.name)) return

    const updated: ServerInfo = { ...status, name: server.name }
    servers = servers.map(s => (s.name === server.name ? updated : s))

    try {
      await invoke("update_server_status", { serverName: server.name, status: updated })
    } catch {}
  }

  function refreshAll() {
    servers.forEach(refreshServerStatus)
  }

  async function loadServers() {
    try {
      servers = await invoke<ServerInfo[]>("get_servers")
      refreshAll()
    } catch {
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

    servers = [...servers, newServer]
    refreshServerStatus(newServer)
  }

  async function handleDeleteServer() {
    const name = serverToDelete
    if (!name) return
    try {
      await invoke("delete_server", { serverName: name })
      servers = servers.filter(s => s.name !== name)
    } catch {} finally {
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
      setTimeout(() => { launchingServer = null }, LAUNCH_COOLDOWN_MS)
    } catch (error) {
      alert(`Failed to launch server: ${error}`)
      launchingServer = null
    }
  }

  async function moveServer(index: number, direction: -1 | 1) {
    const target = index + direction
    if (isFiltering || target < 0 || target >= servers.length) return

    const reordered = servers.slice()
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    servers = reordered

    try {
      await invoke("reorder_servers", { serverNames: reordered.map(s => s.name) })
    } catch {}
  }
</script>

{#snippet addServerButton(extraClass: string)}
  <button
    onclick={() => showAddModal = true}
    class="bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-medium flex items-center gap-2 cursor-pointer {extraClass}"
  >
    <Plus size={16} strokeWidth={2} />
    Add Server
  </button>
{/snippet}

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
      {@render addServerButton("px-4 h-8 rounded-md text-sm")}
    </div>

    {#if !hasServers}
      <div class="flex flex-col items-center justify-center py-14">
        <Server size={48} class="text-[var(--text-muted)] mb-3" strokeWidth={1.5} />
        <h3 class="text-base font-semibold text-[var(--text-primary)] mb-1">No servers added</h3>
        <p class="text-sm text-[var(--text-muted)] mb-4">Add your first server to get started</p>
        {@render addServerButton("px-4 py-2 rounded text-sm")}
      </div>
    {:else if filteredServers.length === 0}
      <div class="rounded-md p-8 flex flex-col items-center justify-center">
        <Search size={48} class="text-[var(--text-muted)] mb-3" strokeWidth={1.5} />
        <h3 class="text-base font-semibold text-[var(--text-primary)] mb-1">No servers found</h3>
        <p class="text-sm text-[var(--text-muted)]">Try adjusting your search query</p>
      </div>
    {:else}
      <div class="space-y-4">
        {#each filteredServers as server, index (server.name)}
          {@const isOnline = server.status === "online"}
          {@const isLaunching = launchingServer === server.name}
          {@const isDisabled = !isOnline || isLaunching || isAnyInstanceRunning}
          {@const showPlayers = isOnline && server.players_online !== undefined}
          <div
            class="group flex items-center gap-3 px-4 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]"
            style="height: {ROW_HEIGHT}px"
          >
            <div class="flex-shrink-0 flex flex-col gap-1">
              <button
                onclick={() => moveServer(index, -1)}
                disabled={isFiltering || index === 0}
                aria-label="Move up"
                title="Move up"
                class="w-8 h-8 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover-strong)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[var(--text-muted)]"
              >
                <ArrowUp size={20} strokeWidth={3} />
              </button>
              <button
                onclick={() => moveServer(index, 1)}
                disabled={isFiltering || index === servers.length - 1}
                aria-label="Move down"
                title="Move down"
                class="w-8 h-8 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover-strong)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[var(--text-muted)]"
              >
                <ArrowDown size={20} strokeWidth={3} />
              </button>
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
              {#if showPlayers}
                <span class="text-base text-[var(--text-muted)]">
                  {server.players_online}/{server.players_max}
                </span>
              {:else if server.status === "offline"}
                <span class="text-base font-medium text-[#ef4444]">Offline</span>
              {:else}
                <span class="text-base font-medium text-[var(--text-muted)]">-</span>
              {/if}
            </div>

            <div class="flex-shrink-0 items-center gap-2 hidden group-hover:flex">
              <button
                onclick={e => { e.stopPropagation(); serverToDelete = server.name }}
                aria-label="Remove server"
                class="w-10 h-10 flex items-center justify-center rounded-md cursor-pointer shrink-0 text-[var(--text-secondary)] hover:bg-[var(--bg-hover-strong)] hover:text-red-400"
              >
                <Trash2 size={20} strokeWidth={2.5} />
              </button>

              <button
                onclick={e => handleLaunchServer(server, e)}
                disabled={isDisabled}
                title={!isOnline ? "Server offline" : isLaunching ? "Launching..." : isAnyInstanceRunning ? "Instance already running" : undefined}
                class="flex-shrink-0 h-10 px-8 flex items-center justify-center gap-3 rounded cursor-pointer disabled:opacity-50 {joinButtonClass(isLaunching, isOnline)}"
              >
                {#if isLaunching}
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