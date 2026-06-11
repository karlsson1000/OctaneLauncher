import { useState, useEffect, useRef } from "react"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { listen } from "@tauri-apps/api/event"

interface CreationProgressToastProps {
  instanceName: string
  onError: () => void
  onDismiss: () => void
}

interface ProgressPayload {
  instance: string
  progress: number
  stage?: string
  current_file?: string
}

export function CreationProgressToast({
  instanceName,
  onError,
  onDismiss,
}: CreationProgressToastProps) {
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState<string>("")
  const [status, setStatus] = useState<"creating" | "success" | "error">("creating")
  const [hasReceivedProgress, setHasReceivedProgress] = useState(false)

  const isCompletingRef = useRef(false)
  const errorTimerRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const lastProgressTimeRef = useRef(Date.now())
  const unlistenFunctionsRef = useRef<Array<() => void>>([])
  const onDismissRef = useRef(onDismiss)

  useEffect(() => {
    onDismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    if (status === "success" || status === "error") {
      const t = setTimeout(() => onDismissRef.current(), 3000)
      return () => clearTimeout(t)
    }
  }, [status])

  useEffect(() => {
    const setupListeners = async () => {
      try {
        const handleProgress = (e: { payload: ProgressPayload }) => {
          if (e.payload.instance !== instanceName) return
          setHasReceivedProgress(true)
          lastProgressTimeRef.current = Date.now()
          setProgress(e.payload.progress)
          if (e.payload.stage) setStage(e.payload.stage)
          if (e.payload.progress >= 100 && !isCompletingRef.current) {
            isCompletingRef.current = true
            setStatus("success")
          }
        }

        const [u1, u2, u3] = await Promise.all([
          listen<ProgressPayload>("duplication-progress", handleProgress),
          listen<ProgressPayload>("creation-progress", handleProgress),
          listen<ProgressPayload>("modpack-install-progress", handleProgress),
        ])

        unlistenFunctionsRef.current = [u1, u2, u3]

        const watchdog = setInterval(() => {
          if (!isCompletingRef.current && Date.now() - lastProgressTimeRef.current > 60000) {
            clearInterval(watchdog)
            setStatus("error")
            setStage("Operation timed out")
            onError()
          }
        }, 5000)

        errorTimerRef.current = watchdog
      } catch {
        setStatus("error")
        setStage("Failed to initialize")
        onError()
      }
    }

    setupListeners()

    return () => {
      if (errorTimerRef.current) clearInterval(errorTimerRef.current)
      unlistenFunctionsRef.current.forEach((fn) => { try { fn() } catch {} })
      unlistenFunctionsRef.current = []
    }
  }, [instanceName, onError])

  const label =
    stage ||
    (status === "success"
      ? "Complete"
      : status === "error"
      ? "Failed"
      : hasReceivedProgress
      ? "Processing…"
      : "Starting…")

  const barColor =
    status === "error"
      ? "bg-red-500"
      : status === "success"
      ? "bg-[#16a34a]"
      : "bg-[#16a34a]"

  return (
    <div>
      {/* Info row */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#181a1f]">
        <div className="flex items-center gap-2 min-w-0">
          {status === "creating" && (
            <Loader2 size={12} className="animate-spin text-[#16a34a] flex-shrink-0" />
          )}
          {status === "success" && (
            <CheckCircle size={12} className="text-[#16a34a] flex-shrink-0" />
          )}
          {status === "error" && (
            <XCircle size={12} className="text-red-500 flex-shrink-0" />
          )}
          <span className="text-xs text-[#8a94a6] truncate">
            <span className="text-[#e6e6e6]">{instanceName}</span>
            {" - "}
            {label}
          </span>
        </div>
        <span className="text-xs text-[#8a94a6] flex-shrink-0 ml-4 tabular-nums">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Progress bar track */}
      <div className="h-[3px] bg-[#22252b] w-full">
        <div
          className={`h-full transition-all duration-300 ease-out ${barColor}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}