import { useRef, useEffect, useState } from "react"
import { listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { Minus, Square, X, Terminal, Trash2, Upload, ExternalLink, Loader2, X as XIcon } from "lucide-react"
import type { ConsoleLog } from "../../types"

export function ConsoleWindow() {
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([])
  const [activeInstance, setActiveInstance] = useState<string | null>(null)
  const [uploadState, setUploadState] = useState<{
    loading: boolean
    url: string | null
    error: string | null
  }>({ loading: false, url: null, error: null })

  const consoleEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const previousInstancesRef = useRef<string[]>([])
  const scrollPositions = useRef<Record<string, number>>({})
  const appWindow = getCurrentWindow()

  useEffect(() => {
    const unlisten = listen<ConsoleLog>("console-log", (event) => {
      setConsoleLogs((prev) => [...prev, event.payload])
    })
    return () => { unlisten.then((fn) => fn()) }
  }, [])

  const instanceLogs = consoleLogs.reduce((acc, log) => {
    if (!acc[log.instance]) acc[log.instance] = []
    acc[log.instance].push(log)
    return acc
  }, {} as Record<string, ConsoleLog[]>)

  const instances = Object.keys(instanceLogs).sort()

  useEffect(() => {
    const prev = previousInstancesRef.current
    const newInstances = instances.filter(i => !prev.includes(i))

    if (newInstances.length > 0) {
      setActiveInstance(newInstances[newInstances.length - 1])
    } else if (instances.length > 0 && !activeInstance) {
      setActiveInstance(instances[instances.length - 1])
    } else if (activeInstance && !instances.includes(activeInstance)) {
      setActiveInstance(instances[instances.length - 1] || null)
    }

    previousInstancesRef.current = instances
  }, [instances.join(',')])

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [consoleLogs.length])

  useEffect(() => {
    if (containerRef.current && activeInstance) {
      const saved = scrollPositions.current[activeInstance]
      if (saved !== undefined) {
        containerRef.current.scrollTop = saved
      } else {
        containerRef.current.scrollTop = containerRef.current.scrollHeight
      }
    }
  }, [activeInstance])

  const handleScroll = () => {
    if (containerRef.current && activeInstance) {
      scrollPositions.current[activeInstance] = containerRef.current.scrollTop
    }
  }

  const activeLogs = activeInstance ? instanceLogs[activeInstance] || [] : []

  const formatLogs = () => {
    if (!activeInstance) return ""
    return activeLogs.map(log =>
      `${new Date().toLocaleTimeString()} [${log.instance}] ${log.message}`
    ).join('\n')
  }

  const handleUploadToMcLogs = async () => {
    setUploadState({ loading: true, url: null, error: null })
    try {
      const logContent = formatLogs()
      if (!logContent.trim()) {
        setUploadState({ loading: false, url: null, error: "No logs to upload" })
        setTimeout(() => setUploadState({ loading: false, url: null, error: null }), 3000)
        return
      }
      const formData = new URLSearchParams()
      formData.append('content', logContent)
      const response = await fetch('https://api.mclo.gs/1/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      })
      const data = await response.json()
      if (data.success) {
        await navigator.clipboard.writeText(data.url)
        window.open(data.url, '_blank')
        setUploadState({ loading: false, url: data.url, error: null })
        setTimeout(() => setUploadState({ loading: false, url: null, error: null }), 3000)
      } else {
        setUploadState({ loading: false, url: null, error: data.error || "Upload failed" })
        setTimeout(() => setUploadState({ loading: false, url: null, error: null }), 3000)
      }
    } catch {
      setUploadState({ loading: false, url: null, error: "Network error occurred" })
      setTimeout(() => setUploadState({ loading: false, url: null, error: null }), 3000)
    }
  }

  const handleClear = () => {
    if (!activeInstance) return
    setConsoleLogs(prev => prev.filter(log => log.instance !== activeInstance))
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans overflow-hidden">

      {/* Custom titlebar */}
      <div
        data-tauri-drag-region
        className="h-9 flex-shrink-0 flex items-center pl-4 pr-2 gap-2 select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <Terminal size={16} strokeWidth={2} className="text-[var(--accent-primary)] flex-shrink-0" />
        <span className="text-sm font-medium text-[var(--text-secondary)] flex-1">
          {activeInstance ? `Console - ${activeInstance}` : "Console - Octane Launcher"}
        </span>

        <div
          className="flex items-center"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={() => appWindow.minimize()}
            className="h-9 w-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <Minus size={18} strokeWidth={3} />
          </button>
          <button
            onClick={() => appWindow.toggleMaximize()}
            className="h-9 w-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <Square size={14} strokeWidth={3} />
          </button>
          <button
            onClick={() => appWindow.close()}
            className="h-9 w-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-red-500 transition-colors cursor-pointer"
          >
            <X size={18} strokeWidth={3} />
          </button>
        </div>
      </div>

      {instances.length > 1 && (
        <div
          className="flex items-center gap-1 px-3 pb-2 flex-shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <div className="flex items-center gap-1.5 bg-[var(--bg-secondary)] rounded-lg p-1">
            {instances.map(instance => (
              <button
                key={instance}
                onClick={() => setActiveInstance(instance)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                  activeInstance === instance
                    ? "bg-[var(--accent-primary)] text-white"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                {instance}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Log output */}
      <div className="flex-1 mx-3 bg-[var(--bg-tertiary)] rounded-lg overflow-hidden">
        {consoleLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Terminal size={40} className="text-[var(--accent-primary)] mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm text-[var(--text-primary)] mb-1">Waiting for output...</p>
              <p className="text-xs text-[var(--text-muted)]">Logs will appear here when an instance launches</p>
            </div>
          </div>
        ) : (
          <div
            className="h-full overflow-y-auto p-4 font-mono text-sm"
            ref={containerRef}
            onScroll={handleScroll}
          >
            {activeLogs.map((log, index) => {
              const isError = log.type === "stderr" || log.message.toLowerCase().includes("error") || log.message.toLowerCase().includes("failed")
              const isWarning = log.message.toLowerCase().includes("warning") || log.message.toLowerCase().includes("warn")
              return (
                <div
                  key={index}
                  className={`py-0.5 leading-relaxed ${
                    isError ? "text-red-400" : isWarning ? "text-yellow-400" : "text-[var(--text-primary)]"
                  }`}
                >
                  <span className="text-[var(--text-muted)] mr-2">{new Date().toLocaleTimeString()}</span>
                  <span className="text-[#16a34a] mr-2">[{log.instance}]</span>
                  <span>{log.message}</span>
                </div>
              )
            })}
            <div ref={consoleEndRef} />
          </div>
        )}
      </div>

      {/* Action bar */}
      <div
        className="flex items-center justify-end gap-2 px-3 py-3 flex-shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleUploadToMcLogs}
          disabled={!activeInstance || activeLogs.length === 0 || uploadState.loading}
          className={`px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            uploadState.url
              ? "bg-[#16a34a]/10 hover:bg-[#16a34a]/20 text-[#16a34a]"
              : uploadState.error
              ? "bg-red-500/10 hover:bg-red-500/20 text-red-400"
              : "bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover-strong)] text-[var(--text-primary)]"
          }`}
        >
          {uploadState.loading ? <Loader2 size={16} strokeWidth={2} className="animate-spin" />
            : uploadState.url ? <ExternalLink size={16} strokeWidth={2} />
            : uploadState.error ? <XIcon size={16} strokeWidth={2} />
            : <Upload size={16} strokeWidth={2} />}
          <span>
            {uploadState.loading ? "Uploading..."
              : uploadState.url ? "Uploaded & Copied!"
              : uploadState.error ? uploadState.error
              : "Upload to mclo.gs"}
          </span>
        </button>
        <button
          onClick={handleClear}
          disabled={!activeInstance || activeLogs.length === 0}
          className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover-strong)] text-[var(--text-primary)] rounded-md font-medium text-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 size={16} strokeWidth={2} />
          <span>Clear {activeInstance || "Console"}</span>
        </button>
      </div>
    </div>
  )
}