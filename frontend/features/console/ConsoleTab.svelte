<script lang="ts">
  import { onMount, untrack } from "svelte"
  import { SquareTerminal, Trash2, Upload, ExternalLink, Loader2, X, PictureInPicture, Search } from "lucide-svelte"
  import { invoke } from "@tauri-apps/api/core"
  import { WebviewWindow } from "@tauri-apps/api/webviewWindow"
  import { store, handleClearConsole } from "../../lib/launcherStore.svelte"
  import type { ConsoleLog } from "../../types"

  const ASCII = `
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⠴⠒⠒⠒⠲⢤⣄
⠀⠀⠀⠀⠀⠀⣀⡠⠤⠤⠤⠤⠤⠤⠔⠋⠁⠀⠀⠀⠀⠀⠀⠈⢧⡀
⠀⠀⠀⠀⢀⡾⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢷
⠀⠀⠀⢠⠏⠀⠀⠀⠀⠀⠀⠀⠀⠀⣦⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⡇
⠀⡔⠒⡿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠁⠀⠀⠀⠀⠀⠀⢀⢄⣴⣮⣼⠸⡄
⠘⣴⣿⣷⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⢣⣿⣟⣿⣿⡏⡇
⠀⠀⠉⠳⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣧⣾⣿⣿⣿⣿⡇⡇
⠀⠀⠀⠀⠀⠉⠒⠠⢄⣀⠀⠀⠀⠀⠀⠀⠀⠀⢸⢻⣻⣿⣿⣿⢿⡹⠁
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠲⣄⠀⠀⠀⣠⠔⠛⣎⡻⠿⢿⣫⠞⠁
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢰⣿⣿⣿⣿⠁⠀⠀⠀⠉⠉⠉
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡴⠃⠀⠈⠉⢻⠁
⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⠞⠀⠀⠀⡄⠂⠈⡇
⠀⠀⠀⠀⠀⠀⠀⠀⢠⡏⠀⠀⠀⠸⠀⠀⠀⣿
⠀⠀⠀⠀⠀⠀⠀⠀⣾⠁⠀⠀⠀⡇⠀⠀⠘⡟⡇
⠀⠀⠀⠀⠀⠀⠀⠀⠻⣦⠀⠀⠀⣇⠀⢠⣸⣷⣧⢀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠲⠀⠈⡉⠉⠀⡏⠣⠬⠭⠤⠄
⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣀⣰⠁⠀⡇⠀⠀⣇
⠀⠀⠀⠀⠀⠀⡔⢊⢉⠤⠒⠛⠒⠲⠃⠀⠀⠻⣄
⠀⠀⠀⠀⠀⠀⠧⣧⣧⢀⡔⠀⡄⠀⠀⠀⠀⠀⠀⣱
⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠑⠚⠛⠒⠓⠚⠈⠊⠉⠁
`;

  type UploadState = { loading: boolean; url: string | null; error: string | null }
  const IDLE: UploadState = { loading: false, url: null, error: null }

  let containerEl = $state<HTMLDivElement>()
  let upload = $state<UploadState>(IDLE)
  let isPoppedOut = $state(false)
  let activeInstance = $state<string | null>(null)
  let previousInstances: string[] = []
  let resetTimer: ReturnType<typeof setTimeout> | undefined
  const scrollPositions = new Map<string, number>()
  const pinned = new Map<string, boolean>()
  const timestamps = new WeakMap<ConsoleLog, string>()

  let instances = $derived([...new Set(store.consoleLogs.map(l => l.instance))].sort())
  let activeLogs = $derived(activeInstance ? store.consoleLogs.filter(l => l.instance === activeInstance) : [])
  let logSearchQuery = $state("")
  let filteredLogs = $derived(
    logSearchQuery.trim() === ""
      ? activeLogs
      : activeLogs.filter(l => l.message.toLowerCase().includes(logSearchQuery.trim().toLowerCase()))
  )

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

  onMount(async () => {
    const win = await WebviewWindow.getByLabel("console")
    if (win) watchPopout(win)
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
    void filteredLogs.length
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

  function highlightParts(message: string, query: string): { text: string; match: boolean }[] {
    const q = query.trim().toLowerCase()
    if (!q) return [{ text: message, match: false }]
    const lower = message.toLowerCase()
    const parts: { text: string; match: boolean }[] = []
    let i = 0
    while (true) {
      const idx = lower.indexOf(q, i)
      if (idx === -1) {
        if (i < message.length) parts.push({ text: message.slice(i), match: false })
        break
      }
      if (idx > i) parts.push({ text: message.slice(i, idx), match: false })
      parts.push({ text: message.slice(idx, idx + q.length), match: true })
      i = idx + q.length
    }
    return parts
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

  function onClear() {
    if (activeInstance) handleClearConsole(activeInstance)
  }

  function watchPopout(win: WebviewWindow) {
    isPoppedOut = true
    win.once("tauri://destroyed", () => { isPoppedOut = false })
  }

  async function handlePopOut() {
    const existing = await WebviewWindow.getByLabel("console")
    if (existing) {
      await existing.show()
      await existing.setFocus()
      watchPopout(existing)
      return
    }

    const win = new WebviewWindow("console", {
      url: "console.html",
      title: "Console",
      width: 600,
      height: 800,
      minWidth: 600,
      minHeight: 400,
      decorations: false,
      center: true,
    })

    win.once("tauri://created", () => watchPopout(win))
    win.once("tauri://error", () => { isPoppedOut = false })
  }
</script>

<div class="p-8 space-y-4">
  <div class="max-w-7xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <div class="relative rounded-md bg-[var(--bg-tertiary)]">
          <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-20 pointer-events-none" strokeWidth={2} />
          <input
            type="text"
            placeholder="Search logs..."
            bind:value={logSearchQuery}
            class="w-72 bg-transparent rounded-md pl-9 pr-3 py-1.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition-all relative z-10"
          />
        </div>
      </div>

      <div class="flex items-center gap-2">
          {#if !isPoppedOut && instances.length > 0}
            <div class="flex items-center gap-1.5 bg-[var(--bg-secondary)] rounded-lg p-0.5">
              {#each instances as instance (instance)}
                <button
                  onclick={() => activeInstance = instance}
                  class="px-3 py-1 rounded-md text-sm font-medium whitespace-nowrap cursor-pointer {activeInstance === instance ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}"
                >
                  {instance}
                </button>
              {/each}
            </div>
          {/if}

          {#if !isPoppedOut}
            <button
              onclick={handlePopOut}
              title="Open in new window"
              class="h-8 w-8 flex items-center justify-center rounded-md cursor-pointer bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <PictureInPicture size={22} strokeWidth={2} />
            </button>
          {/if}
      </div>
    </div>

    <div class="bg-[var(--bg-tertiary)] rounded-lg overflow-hidden" style="height: calc(100vh - 250px)">
      {#if isPoppedOut}
        <div class="h-full flex items-center justify-center">
          <div class="text-center">
            <PictureInPicture size={48} class="text-[var(--accent-primary)] mx-auto mb-3" strokeWidth={1.5} />
            <p class="text-base font-medium text-[var(--text-primary)] mb-1">Console detached</p>
            <p class="text-sm text-[var(--text-muted)]">Logs are showing in the separate window</p>
          </div>
        </div>
      {:else if store.consoleLogs.length === 0}
        <div class="h-full flex items-center justify-center">
          <div class="text-center">
            <pre class="font-mono text-xs text-[var(--accent-primary)] select-none text-left">{ASCII}</pre>
            <p class="text-base text-[var(--text-primary)] mt-4 mb-1">No console output yet</p>
            <p class="text-sm text-[var(--text-muted)]">Launch an instance to see logs</p>
          </div>
        </div>
      {:else if !activeInstance}
        <div class="h-full flex items-center justify-center">
          <div class="text-center">
            <SquareTerminal size={48} class="text-[var(--text-muted)] mx-auto mb-3" strokeWidth={1.5} />
            <p class="text-base text-[var(--text-primary)] mb-1">No instance selected</p>
            <p class="text-sm text-[var(--text-muted)]">Select an instance tab above</p>
          </div>
        </div>
      {:else if filteredLogs.length === 0 && logSearchQuery.trim() !== ""}
        <div class="h-full flex items-center justify-center">
          <div class="text-center">
            <p class="text-base text-[var(--text-primary)] mb-1">No matching lines</p>
            <p class="text-sm text-[var(--text-muted)]">Try a different search query</p>
          </div>
        </div>
      {:else}
        <div class="h-full overflow-y-auto p-4 font-mono text-sm" bind:this={containerEl} onscroll={handleScroll}>
          {#each filteredLogs as log}
            <div class="py-0.5 leading-relaxed log-line {getLogClass(log)}">
              <span class="text-[var(--text-muted)] mr-2">{getLogTime(log)}</span>
              <span class="text-[#16a34a] mr-2">[{log.instance}]</span>
              <span>{#each highlightParts(log.message, logSearchQuery) as part}{#if part.match}<span class="bg-yellow-400/30 rounded-[2px]">{part.text}</span>{:else}{part.text}{/if}{/each}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    {#if !isPoppedOut}
      <div class="flex items-center justify-end gap-2 mt-4">
        <button
          onclick={handleUploadToMcLogs}
          disabled={!activeInstance || activeLogs.length === 0 || upload.loading}
          class="px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed {uploadColor}"
          title="Upload logs to mclo.gs"
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
          onclick={onClear}
          disabled={!activeInstance || activeLogs.length === 0}
          class="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-md font-medium text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 size={16} strokeWidth={2} />
          <span>Clear {activeInstance || "Console"}</span>
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .log-line {
    animation: log-in 0.12s ease-out;
  }

  @keyframes log-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .log-line {
      animation: none;
    }
  }
</style>
