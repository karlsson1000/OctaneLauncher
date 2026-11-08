<script lang="ts">
  import { listen } from "@tauri-apps/api/event"
  import { showToast, upsertProgress, dismissProgress } from "../../../lib/toastStore.svelte"

  interface ProgressPayload {
    instance: string
    progress: number
    stage?: string
  }

  type ProgressKind = "creation" | "duplication" | "modpack"

  const KIND_LABELS: Record<ProgressKind, { done: string; failed: string }> = {
    creation: { done: "created", failed: `Failed to create` },
    duplication: { done: "duplicated", failed: `Failed to duplicate` },
    modpack: { done: "installed", failed: `Failed to install` },
  }

  let { instanceName, onError, onDismiss }: {
    instanceName: string
    onError: () => void
    onDismiss: () => void
  } = $props()

  let progress = $state(0)
  let stage = $state("")
  let status = $state<"creating" | "success" | "error">("creating")
  let kind = $state<ProgressKind>("creation")
  let hasReceivedProgress = $state(false)

  let isCompleting = false
  let errorTimer: ReturnType<typeof setInterval> | undefined
  let lastProgressTime = Date.now()
  let unlistenFns: Array<() => void> = []

  $effect(() => {
    if (status === "success" || status === "error") {
      const t = setTimeout(
        () => {
          dismissProgress(instanceName)
          onDismiss()
        },
        status === "success" ? 500 : 0,
      )
      return () => clearTimeout(t)
    }
  })

  $effect(() => {
    upsertProgress({ id: instanceName, title: instanceName, stage: label, progress, status })
  })

  $effect(() => {
    const setupListeners = async () => {
      try {
        const makeHandler = (progressKind: ProgressKind) => (e: { payload: ProgressPayload }) => {
          if (e.payload.instance !== instanceName) return
          hasReceivedProgress = true
          lastProgressTime = Date.now()
          progress = e.payload.progress
          if (e.payload.stage) stage = e.payload.stage
          kind = progressKind
          if (e.payload.progress >= 100 && !isCompleting) {
            isCompleting = true
            status = "success"
            showToast("success", `${instanceName} ${KIND_LABELS[progressKind].done}`)
          }
        }

        const [u1, u2, u3] = await Promise.all([
          listen<ProgressPayload>("duplication-progress", makeHandler("duplication")),
          listen<ProgressPayload>("creation-progress", makeHandler("creation")),
          listen<ProgressPayload>("modpack-install-progress", makeHandler("modpack")),
        ])

        unlistenFns = [u1, u2, u3]

        errorTimer = setInterval(() => {
          if (!isCompleting && Date.now() - lastProgressTime > 60000) {
            clearInterval(errorTimer)
            status = "error"
            stage = "Operation timed out"
            showToast("error", `${KIND_LABELS[kind].failed} ${instanceName}`)
            onError()
          }
        }, 5000)
      } catch {
        status = "error"
        stage = "Failed to initialize"
        showToast("error", `Failed to start ${instanceName}`)
        onError()
      }
    }

    setupListeners()

    return () => {
      if (errorTimer) clearInterval(errorTimer)
      unlistenFns.forEach((fn) => { try { fn() } catch {} })
      unlistenFns = []
      dismissProgress(instanceName)
    }
  })

  let label = $derived(
    stage ||
    (status === "success"
      ? "Complete"
      : status === "error"
        ? "Failed"
        : hasReceivedProgress
          ? "Processing…"
          : "Starting…")
  )

</script>
