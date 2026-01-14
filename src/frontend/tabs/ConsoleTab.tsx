import { useRef, useEffect, useState } from "react"
import { Terminal, Trash2, Upload, ExternalLink, Loader2, X } from "lucide-react"
import type { ConsoleLog } from "../../types"

interface ConsoleTabProps {
  consoleLogs: ConsoleLog[]
  onClearConsole: (instanceName: string) => void
}

export function ConsoleTab({ consoleLogs, onClearConsole }: ConsoleTabProps) {
  const consoleEndRef = useRef<HTMLDivElement>(null)
  const [uploadState, setUploadState] = useState<{
    loading: boolean
    url: string | null
    error: string | null
  }>({ loading: false, url: null, error: null })
  
  // Group logs by instance
  const instanceLogs = consoleLogs.reduce((acc, log) => {
    if (!acc[log.instance]) {
      acc[log.instance] = []
    }
    acc[log.instance].push(log)
    return acc
  }, {} as Record<string, ConsoleLog[]>)

  const instances = Object.keys(instanceLogs).sort()
  const [activeInstance, setActiveInstance] = useState<string | null>(null)
  const previousInstancesRef = useRef<string[]>([])

  useEffect(() => {
    const previousInstances = previousInstancesRef.current

    const newInstances = instances.filter(i => !previousInstances.includes(i))
    
    if (newInstances.length > 0) {
      setActiveInstance(newInstances[newInstances.length - 1])
    } else if (instances.length > 0 && !activeInstance) {
      setActiveInstance(instances[instances.length - 1])
    } else if (activeInstance && !instances.includes(activeInstance)) {
      setActiveInstance(instances[instances.length - 1] || null)
    }

    previousInstancesRef.current = instances
  }, [instances.join(',')])

  const scrollPositions = useRef<Record<string, number>>({})
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (consoleEndRef.current && activeInstance && containerRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [consoleLogs.length])

  useEffect(() => {
    if (containerRef.current && activeInstance) {
      const savedPosition = scrollPositions.current[activeInstance]
      if (savedPosition !== undefined) {
        containerRef.current.scrollTop = savedPosition
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
        setUploadState({ loading: false, url: null, error: 'No logs to upload' })
        setTimeout(() => setUploadState({ loading: false, url: null, error: null }), 3000)
        return
      }

      const formData = new URLSearchParams()
      formData.append('content', logContent)

      const response = await fetch('https://api.mclo.gs/1/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        // Auto-copy the URL to clipboard
        await navigator.clipboard.writeText(data.url)
        // Open the link immediately
        window.open(data.url, '_blank')
        setUploadState({ loading: false, url: data.url, error: null })
        // Clear success message after 3 seconds
        setTimeout(() => setUploadState({ loading: false, url: null, error: null }), 3000)
      } else {
        setUploadState({ loading: false, url: null, error: data.error || 'Upload failed' })
        setTimeout(() => setUploadState({ loading: false, url: null, error: null }), 3000)
      }
    } catch (err) {
      console.error('Failed to upload logs:', err)
      setUploadState({ loading: false, url: null, error: 'Network error occurred' })
      setTimeout(() => setUploadState({ loading: false, url: null, error: null }), 3000)
    }
  }

  const handleClearConsole = () => {
    if (activeInstance) {
      onClearConsole(activeInstance)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <style>{`
        .blur-border {
          position: relative;
        }

        .blur-border::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 2px;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.08),
            rgba(255, 255, 255, 0.04)
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          backdrop-filter: blur(8px);
          z-index: 10;
        }

        .blur-border:hover::before {
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.14),
            rgba(255, 255, 255, 0.08)
          );
        }

        .console-border {
          position: relative;
        }

        .console-border::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 2px;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.08),
            rgba(255, 255, 255, 0.04)
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          backdrop-filter: blur(8px);
          z-index: 10;
        }
      `}</style>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-[#e6e6e6] tracking-tight">Console</h1>
              <p className="text-sm text-[#7d8590] mt-0.5">View game output and logs</p>
            </div>
            
            {/* Instance Tabs */}
            {instances.length > 0 && (
              <div className="flex items-center gap-1.5 bg-[#181a1f] rounded-lg p-1">
                {instances.map((instance) => (
                  <button
                    key={instance}
                    onClick={() => setActiveInstance(instance)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                      activeInstance === instance
                        ? "bg-[#4572e3] text-white"
                        : "text-[#7d8590] hover:text-[#e6e6e6] hover:bg-[#22252b]"
                    }`}
                  >
                    {instance}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Console Display */}
        <div className="console-border bg-[#1a1d23] rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 225px)' }}>
          {consoleLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Terminal size={48} className="text-[#4572e3] mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-base text-[#e6e6e6] mb-1">No console output yet</p>
                <p className="text-sm text-[#7d8590]">Launch an instance to see logs</p>
              </div>
            </div>
          ) : !activeInstance ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Terminal size={48} className="text-[#7d8590] mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-base text-[#e6e6e6] mb-1">No instance selected</p>
                <p className="text-sm text-[#7d8590]">Select an instance tab above</p>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-4 font-mono text-sm" ref={containerRef} onScroll={handleScroll}>
              {activeLogs.map((log, index) => {
                const isError = log.type === "stderr" || log.message.toLowerCase().includes("error") || log.message.toLowerCase().includes("failed");
                const isWarning = log.message.toLowerCase().includes("warning") || log.message.toLowerCase().includes("warn");
                
                return (
                  <div
                    key={index}
                    className={`py-0.5 leading-relaxed ${
                      isError 
                        ? "text-red-400" 
                        : isWarning 
                        ? "text-yellow-400" 
                        : "text-[#e6e6e6]"
                    }`}
                  >
                    <span className="text-[#7d8590] mr-2">{new Date().toLocaleTimeString()}</span>
                    <span className="text-[#16a34a] mr-2">[{log.instance}]</span>
                    <span>{log.message}</span>
                  </div>
                );
              })}
              <div ref={consoleEndRef} />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            onClick={handleUploadToMcLogs}
            disabled={!activeInstance || activeLogs.length === 0 || uploadState.loading}
            className={`px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              uploadState.url
                ? "bg-[#16a34a]/10 hover:bg-[#16a34a]/20 text-[#16a34a]"
                : uploadState.error
                ? "bg-red-500/10 hover:bg-red-500/20 text-red-400"
                : "bg-[#22252b] hover:bg-[#3a3f4b] text-[#e6e6e6]"
            }`}
            title="Upload logs to mclo.gs"
          >
            {uploadState.loading ? (
              <Loader2 size={16} strokeWidth={2} className="animate-spin" />
            ) : uploadState.url ? (
              <ExternalLink size={16} strokeWidth={2} />
            ) : uploadState.error ? (
              <X size={16} strokeWidth={2} />
            ) : (
              <Upload size={16} strokeWidth={2} />
            )}
            <span>
              {uploadState.loading 
                ? 'Uploading...' 
                : uploadState.url
                ? 'Uploaded & Copied!'
                : uploadState.error
                ? uploadState.error
                : 'Upload to mclo.gs'}
            </span>
          </button>
          <button
            onClick={handleClearConsole}
            disabled={!activeInstance || activeLogs.length === 0}
            className="px-4 py-2 bg-[#22252b] hover:bg-[#3a3f4b] text-[#e6e6e6] rounded-md font-medium text-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={16} strokeWidth={2} />
            <span>Clear {activeInstance || 'Console'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}