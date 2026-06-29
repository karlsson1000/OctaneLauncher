<script lang="ts">
  import { X, Server, AlertCircle, Loader2 } from "lucide-svelte"
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
</script>

<div
  class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop"
  class:closing={isClosing}
  role="presentation"
  onkeydown={(e) => { if (e.key === 'Enter') handleClose() }}
  onclick={handleClose}
>
  <div
    class="blur-border bg-[var(--bg-secondary)] rounded w-full max-w-md shadow-2xl modal-content"
    class:closing={isClosing}
    role="presentation"
    onclick={(e) => e.stopPropagation()}
    style="pointer-events: auto"
  >
    <div class="flex items-center justify-between px-6 pt-6 pb-5">
      <div>
        <h2 class="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Add Server</h2>
      </div>
      <button
        onclick={handleClose}
        class="p-1.5 hover:bg-[var(--bg-hover-strong)] rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
      >
        <X size={18} strokeWidth={2} />
      </button>
    </div>

    <div class="px-6 pb-4 space-y-5">
      <div>
        <label for="server-name" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Server Name</label>
        <input
          type="text"
          id="server-name"
          bind:value={serverName}
          placeholder="My Server"
          class="w-full bg-[var(--bg-tertiary)] rounded px-4 py-3.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none transition-all {serverExists && serverName.trim() ? 'ring-2 ring-red-500' : ''}"
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
        <input
          type="text"
          id="server-address"
          bind:value={serverAddress}
          placeholder="mc.hypixel.net"
          class="w-full bg-[var(--bg-tertiary)] rounded px-4 py-3.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none transition-all"
          disabled={isCreating}
        />
      </div>

      <div>
        <label for="server-port" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Server Port (Optional)</label>
        <input
          type="text"
          id="server-port"
          bind:value={serverPort}
          placeholder="25565"
          class="w-full bg-[var(--bg-tertiary)] rounded px-4 py-3.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none transition-all {serverPort && !isValidPort ? 'ring-2 ring-red-500' : ''}"
          disabled={isCreating}
        />
        {#if serverPort && !isValidPort}
          <div class="flex items-center gap-1.5 mt-2 text-xs text-red-400">
            <AlertCircle size={12} strokeWidth={2} />
            <span>Port must be between 1 and 65535</span>
          </div>
        {/if}
      </div>

      <button
        onclick={testConnection}
        disabled={!serverAddress.trim() || !isValidPort || isTesting}
        class="w-full px-4 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover-strong)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-primary)] rounded font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
      >
        {#if isTesting}
          <Loader2 size={16} class="animate-spin" />
          <span>Testing Connection...</span>
        {:else}
          <Server size={16} />
          <span>Test Connection</span>
        {/if}
      </button>

      {#if testResult}
        <div class="flex items-start gap-2 p-3 rounded {testResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
          <AlertCircle size={14} class="mt-0.5 flex-shrink-0" strokeWidth={2} />
          <span class="text-xs">{testResult.message}</span>
        </div>
      {/if}
    </div>

    <div class="flex items-center justify-end gap-3 px-6 pb-6 pt-3">
      <button
        onclick={handleClose}
        disabled={isCreating}
        class="px-5 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover-strong)] text-[var(--text-primary)] rounded font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        Cancel
      </button>
      <button
        onclick={handleCreateServer}
        disabled={isCreateDisabled}
        class="px-5 py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
