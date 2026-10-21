<script lang="ts">
  import { untrack } from "svelte"
  import { invoke } from "@tauri-apps/api/core"
  import { store, handleClearConsole } from "../../lib/launcherStore.svelte"
  import { getLogTime, IDLE_UPLOAD, type UploadState } from "./components/console-log"
  import ConsoleToolbar from "./components/console-toolbar.svelte"
  import ConsoleOutput from "./components/console-output.svelte"
  import ConsoleActions from "./components/console-actions.svelte"

  let upload = $state<UploadState>(IDLE_UPLOAD)
  let activeInstance = $state<string | null>(null)
  let previousInstances: string[] = []
  let resetTimer: ReturnType<typeof setTimeout> | undefined
  let logSearchQuery = $state("")

  let instances = $derived([...new Set(store.consoleLogs.map(l => l.instance))].sort())
  let activeLogs = $derived(activeInstance ? store.consoleLogs.filter(l => l.instance === activeInstance) : [])
  let canUpload = $derived(!!activeInstance && activeLogs.length > 0 && !upload.loading)
  let canClear = $derived(!!activeInstance && activeLogs.length > 0)

  $effect(() => () => clearTimeout(resetTimer))

  $effect(() => {
    const added = instances.filter(i => !previousInstances.includes(i))
    const current = untrack(() => activeInstance)

    if (added.length > 0) activeInstance = added[added.length - 1]
    else if (!current || !instances.includes(current)) activeInstance = instances[instances.length - 1] ?? null

    previousInstances = instances
  })

  function settleUpload(next: UploadState) {
    upload = next
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => { upload = IDLE_UPLOAD }, 3000)
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
</script>

<div class="p-8 space-y-4">
  <div class="max-w-7xl mx-auto">
    <ConsoleToolbar
      {instances}
      {activeInstance}
      bind:searchQuery={logSearchQuery}
      onSelect={(instance) => activeInstance = instance}
    />

    <ConsoleOutput
      logs={activeLogs}
      searchQuery={logSearchQuery}
      hasAnyLogs={store.consoleLogs.length > 0}
      {activeInstance}
    />

    <ConsoleActions
      {upload}
      {canUpload}
      {canClear}
      {activeInstance}
      onUpload={handleUploadToMcLogs}
      onClear={onClear}
    />
  </div>
</div>
