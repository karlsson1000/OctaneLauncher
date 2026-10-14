<script lang="ts">
  import { onMount, untrack } from "svelte"
  import { listen } from "@tauri-apps/api/event"
  import { invoke } from "@tauri-apps/api/core"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import { Minus, Square, X, SquareTerminal, Trash2, Upload, ExternalLink, Loader2 } from "lucide-svelte"
  import type { ConsoleLog } from "../../types"

  type UploadState = { loading: boolean; url: string | null; error: string | null }
  const IDLE: UploadState = { loading: false, url: null, error: null }

  const appWindow = getCurrentWindow()

  let consoleLogs = $state.raw<ConsoleLog[]>([])
  let activeInstance = $state<string | null>(null)
  let upload = $state<UploadState>(IDLE)
  let containerEl = $state<HTMLDivElement>()

  let previousInstances: string[] = []
  let resetTimer: ReturnType<typeof setTimeout> | undefined
  const scrollPositions = new Map<string, number>()
  const pinned = new Map<string, boolean>()
  const timestamps = new WeakMap<ConsoleLog, string>()

  let instanceLogs = $derived(consoleLogs.reduce((acc, log) => {
    (acc[log.instance] ??= []).push(log)
    return acc
  }, {} as Record<string, ConsoleLog[]>))
  let instances = $derived(Object.keys(instanceLogs).sort())
  let activeLogs = $derived(activeInstance ? instanceLogs[activeInstance] ?? [] : [])

  let uploadColor = $derived(
    upload.url
      ? "bg-[#16a34a]/10 hover:bg-[#16a34a]/20 text-[#16a34a]"
      : upload.error
        ? "bg-red-500/10 hover:bg-red-500/20 text-red-400"
        : "bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
  )
  let uploadLabel = $derived(
    upload.loading ? "Uploading..." : upload.url ? "Uploaded & Copied!" : (upload.error ?? "Upload to mclo.gs")
  )

  onMount(() => {
    const unlisten = listen<ConsoleLog>("console-log", (event) => {
      timestamps.set(event.payload, new Date().toLocaleTimeString())
      consoleLogs = [...consoleLogs, event.payload]
    })
    return () => { unlisten.then((fn) => fn()) }
  })

  $effect(() => () => clearTimeout(resetTimer))

  $effect(() => {
    const added = instances.filter(i => !previousInstances.includes(i))
    const current = untrack(() => activeInstance)

    if (added.length > 0) activeInstance = added[added.length - 1]
    else if (!current || !instances.includes(current)) activeInstance = instances[instances.length - 1] ?? null

    previousInstances = instances
  })

  $effect(() => {
    void activeLogs.length
    const inst = activeInstance
    if (!containerEl || !inst) return
    containerEl.scrollTop = (pinned.get(inst) ?? true) ? containerEl.scrollHeight : (scrollPositions.get(inst) ?? 0)
  })

  function handleScroll() {
    if (!containerEl || !activeInstance) return
    scrollPositions.set(activeInstance, containerEl.scrollTop)
    pinned.set(activeInstance, containerEl.scrollHeight - containerEl.scrollTop - containerEl.clientHeight < 40)
  }

  function getLogTime(log: ConsoleLog): string {
    let time = timestamps.get(log)
    if (!time) {
      time = new Date().toLocaleTimeString()
      timestamps.set(log, time)
    }
    return time
  }

  function getLogClass(log: ConsoleLog): string {
    const msg = log.message.toLowerCase()
    if (log.type === "stderr" || msg.includes("error") || msg.includes("failed")) return "text-red-400"
    if (msg.includes("warn")) return "text-yellow-400"
    return "text-[var(--text-primary)]"
  }

  function settleUpload(next: UploadState) {
    upload = next
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => { upload = IDLE }, 3000)
  }

  async function handleUploadToMcLogs() {
    upload = { loading: true, url: null, error: null }

    try {
      const content = activeLogs.map(log => `${getLogTime(log)} [${log.instance}] ${log.message}`).join("\n")
      if (!content.trim()) throw new Error("No logs to upload")

      let data: { success: boolean; url?: string; error?: string }
      try {
        const response = await fetch("https://api.mclo.gs/1/log", {
          method: "POST",
          body: new URLSearchParams({ content })
        })
        data = await response.json()
      } catch {
        throw new Error("Network error occurred")
      }

      if (!data.success || !data.url) throw new Error(data.error || "Upload failed")

      await navigator.clipboard.writeText(data.url).catch(() => {})
      invoke("open_url", { url: data.url }).catch(() => {})
      settleUpload({ loading: false, url: data.url, error: null })
    } catch (err) {
      settleUpload({ loading: false, url: null, error: err instanceof Error ? err.message : "Upload failed" })
    }
  }

  function handleClear() {
    if (!activeInstance) return
    consoleLogs = consoleLogs.filter(log => log.instance !== activeInstance)
  }
</script>

<div class="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans overflow-hidden">
  <div
    data-tauri-drag-region
    class="h-9 flex-shrink-0 flex items-center pl-4 pr-2 gap-2 select-none"
    style="-webkit-app-region: drag"
  >
    <SquareTerminal size={16} strokeWidth={2} class="text-[var(--accent-primary)] shrink-0" />
    <span class="text-sm font-medium text-[var(--text-secondary)] flex-1">
      {activeInstance ? `Console - ${activeInstance}` : "Console - Octane Launcher"}
    </span>

    <div class="flex items-center" style="-webkit-app-region: no-drag">
      <button
        onclick={() => appWindow.minimize()}
        class="h-9 w-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
      >
        <Minus size={18} strokeWidth={3} />
      </button>
      <button
        onclick={() => appWindow.toggleMaximize()}
        class="h-9 w-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
      >
        <Square size={14} strokeWidth={3} />
      </button>
      <button
        onclick={() => appWindow.close()}
        class="h-9 w-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-red-500 cursor-pointer"
      >
        <X size={18} strokeWidth={3} />
      </button>
    </div>
  </div>

  {#if instances.length > 1}
    <div class="flex items-center gap-1 px-3 pb-2 flex-shrink-0" style="-webkit-app-region: no-drag">
      <div class="flex items-center gap-1.5 bg-[var(--bg-secondary)] rounded-lg p-1">
        {#each instances as instance (instance)}
          <button
            onclick={() => activeInstance = instance}
            class="px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap cursor-pointer {activeInstance === instance ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}"
          >
            {instance}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="flex-1 mx-3 bg-[var(--bg-tertiary)] rounded-lg overflow-hidden">
    {#if !activeInstance}
      <div class="h-full flex items-center justify-center">
        <div class="text-center">
          <SquareTerminal size={40} class="text-[var(--accent-primary)] mx-auto mb-3" strokeWidth={1.5} />
          <p class="text-sm text-[var(--text-primary)] mb-1">Waiting for output...</p>
          <p class="text-xs text-[var(--text-muted)]">Logs will appear here when an instance launches</p>
        </div>
      </div>
    {:else}
      <div class="h-full overflow-y-auto p-4 font-mono text-sm" bind:this={containerEl} onscroll={handleScroll}>
        {#each activeLogs as log}
          <div class="py-0.5 leading-relaxed {getLogClass(log)}">
            <span class="text-[var(--text-muted)] mr-2">{getLogTime(log)}</span>
            <span class="text-[#16a34a] mr-2">[{log.instance}]</span>
            <span>{log.message}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="flex items-center justify-end gap-2 px-3 py-3 flex-shrink-0" style="-webkit-app-region: no-drag">
    <button
      onclick={handleUploadToMcLogs}
      disabled={!activeInstance || activeLogs.length === 0 || upload.loading}
      class="px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed {uploadColor}"
    >
      {#if upload.loading}
        <Loader2 size={16} strokeWidth={2} class="animate-spin" />
      {:else if upload.url}
        <ExternalLink size={16} strokeWidth={2} />
      {:else if upload.error}
        <X size={16} strokeWidth={2} />
      {:else}
        <Upload size={16} strokeWidth={2} />
      {/if}
      <span>{uploadLabel}</span>
    </button>
    <button
      onclick={handleClear}
      disabled={!activeInstance || activeLogs.length === 0}
      class="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-md font-medium text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Trash2 size={16} strokeWidth={2} />
      <span>Clear {activeInstance || "Console"}</span>
    </button>
  </div>
</div>
