<script lang="ts">
  import { X, AlertCircle, Loader2, Plug, RotateCw } from "lucide-svelte"
  import AlertModal from "../../components/ui/AlertModal.svelte"
  import type { ServerInfo } from "../../types"

  let { servers, onClose, onSuccess }: {
    servers: ServerInfo[]
    onClose: () => void
    onSuccess: (server: ServerInfo) => void
  } = $props()

  let isCreating = $state(false)
  let serverName = $state("")
  let serverAddress = $state("")
  let serverPort = $state("")
  let isTesting = $state(false)
  let testResult = $state<{ success: boolean; message: string } | null>(null)
  let isClosing = $state(false)
  let alertModal = $state<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null>(null)

  let serverExists = $derived(
    servers.some(server => server.name.toLowerCase() === serverName.trim().toLowerCase())
  )

  let portNumber = $derived(serverPort.trim() === "" ? 25565 : parseInt(serverPort))
  let isValidPort = $derived(
    serverPort.trim() === "" || (!isNaN(portNumber) && portNumber > 0 && portNumber <= 65535)
  )

  function handleClose() {
    isClosing = true
    setTimeout(() => {
      isClosing = false
      onClose()
    }, 150)
  }

  async function testConnection() {
    if (!serverAddress.trim() || !isValidPort) return

    isTesting = true
    testResult = null

    try {
      const fullAddress = portNumber === 25565 ? serverAddress : `${serverAddress}:${portNumber}`
      const response = await fetch(`https://api.mcsrvstat.us/3/${fullAddress}`, {
        headers: { 'User-Agent': 'OctaneLauncher/1.0' }
      })

      if (!response.ok) {
        testResult = { success: false, message: "Failed to connect to server status API" }
        return
      }

      const data = await response.json()

      if (data.online) {
        testResult = { success: true, message: `Server is online! Version: ${data.protocol?.name || data.version || 'Unknown'}` }
      } else {
        testResult = { success: false, message: "Server is offline or unreachable" }
      }
    } catch (error) {
      testResult = { success: false, message: "Failed to test connection" }
    } finally {
      isTesting = false
    }
  }

  async function handleCreateServer() {
    if (!serverName.trim() || !serverAddress.trim() || !isValidPort || serverExists) return

    isCreating = true

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
      alertModal = {
        isOpen: true,
        title: "Error",
        message: `Failed to add server: ${error}`,
        type: "danger"
      }
    } finally {
      isCreating = false
    }
  }

  let isCreateDisabled = $derived(
    isCreating || !serverName.trim() || !serverAddress.trim() || !isValidPort || serverExists
  )

  let backdropArmed = false
</script>

<div
  class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop"
  class:closing={isClosing}
  role="presentation"
  onkeydown={(e) => { if (e.key === 'Enter') handleClose() }}
  onmousedown={(e) => { backdropArmed = e.target === e.currentTarget }}
  onmouseup={(e) => { backdropArmed = backdropArmed && e.target === e.currentTarget }}
  onclick={() => { if (backdropArmed) handleClose() }}
>
  <div
    class="bg-[var(--content-bg)] rounded border border-[var(--border-subtle)] shadow-md w-full max-w-2xl modal-content"
    class:closing={isClosing}
    role="presentation"
    onclick={(e) => e.stopPropagation()}
    style="pointer-events: auto"
  >
    <div class="flex items-center justify-between px-5 pt-5 pb-4">
      <div>
        <h2 class="text-lg font-semibold text-[var(--text-primary)] tracking-tight">Add Server</h2>
      </div>
      <button
        onclick={handleClose}
        class="p-1.5 hover:bg-[var(--bg-hover)] rounded-sm transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
      >
        <X size={18} strokeWidth={2} />
      </button>
    </div>

    <div class="px-5 pb-4 grid grid-cols-2 gap-5">
      <div class="space-y-5">
        <div>
          <label for="server-name" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Server Name</label>
          <input
            type="text"
            id="server-name"
            bind:value={serverName}
            placeholder="My Server"
            class="w-full bg-[var(--bg-tertiary)] rounded-sm px-4 py-3.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none transition-all {serverExists && serverName.trim() ? 'ring-2 ring-red-500' : ''}"
            disabled={isCreating}
          />
          {#if serverExists && serverName.trim()}
            <div class="flex items-center gap-1.5 mt-2 text-xs text-red-400">
              <AlertCircle size={12} strokeWidth={2} />
              <span>A server with this name already exists</span>
            </div>
          {/if}
        </div>

        <div>
          <label for="server-address" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Server Address</label>
          <div class="relative">
            <input
              type="text"
              id="server-address"
              bind:value={serverAddress}
              placeholder="mc.hypixel.net"
              class="w-full bg-[var(--bg-tertiary)] rounded-sm pl-4 pr-10 py-3.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none transition-all"
              disabled={isCreating}
            />
            <button
              onclick={testConnection}
              disabled={!serverAddress.trim() || !isValidPort || isTesting}
              title={isTesting ? "Testing connection..." : testResult?.success ? "Connection OK — test again" : "Test connection"}
              class="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 h-6 w-6 flex items-center justify-center rounded transition-colors cursor-pointer disabled:cursor-not-allowed {testResult && !isTesting ? (testResult.success ? 'text-green-400 hover:text-green-300' : 'text-red-400 hover:text-red-300') : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40'}"
            >
              {#if isTesting}
                <Loader2 size={16} class="animate-spin" />
              {:else if testResult}
                <RotateCw size={16} strokeWidth={2.5} />
              {:else}
                <Plug size={16} strokeWidth={2} />
              {/if}
            </button>
          </div>
        </div>
      </div>

      <div class="space-y-5">
        <div>
          <label for="server-port" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Server Port (Optional)</label>
          <input
            type="text"
            id="server-port"
            bind:value={serverPort}
            placeholder="25565"
            class="w-full bg-[var(--bg-tertiary)] rounded-sm px-4 py-3.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none transition-all {serverPort && !isValidPort ? 'ring-2 ring-red-500' : ''}"
            disabled={isCreating}
          />
          {#if serverPort && !isValidPort}
            <div class="flex items-center gap-1.5 mt-2 text-xs text-red-400">
              <AlertCircle size={12} strokeWidth={2} />
              <span>Port must be between 1 and 65535</span>
            </div>
          {/if}
        </div>

        {#if testResult}
          <div>
            <p class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Status</p>
            <div class="flex items-center gap-2 px-4 h-12 rounded-sm {testResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
              <AlertCircle size={14} class="flex-shrink-0" strokeWidth={2} />
              <span class="text-[13px] truncate">{testResult.message}</span>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <div class="flex items-center justify-end gap-2 px-5 pb-5 pt-1">
      <button
        onclick={handleClose}
        disabled={isCreating}
        class="h-8 px-4 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-md font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        Cancel
      </button>
      <button
        onclick={handleCreateServer}
        disabled={isCreateDisabled}
        class="h-8 px-4 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-md font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {#if isCreating}
          <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          <span>Adding...</span>
        {:else}
          <span>Add Server</span>
        {/if}
      </button>
    </div>
  </div>
</div>

{#if alertModal}
  <AlertModal
    isOpen={alertModal.isOpen}
    title={alertModal.title}
    message={alertModal.message}
    type={alertModal.type}
    onClose={() => alertModal = null}
  />
{/if}
