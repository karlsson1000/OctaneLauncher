import { useState, useEffect, useRef, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Loader2, Coffee, Cpu, ImagePlus, FolderOpen, X, Check, ChevronDown, Info, Terminal, Paintbrush, Trash2 } from "lucide-react"
import { AlertModal } from "../../components/ui/ConfirmModal"
import type { LauncherSettings } from "../../types"

interface SystemInfo {
  total_memory_mb: number
  available_memory_mb: number
  recommended_max_memory_mb: number
}

interface StorageCategory {
  name: string
  size_bytes: number
}

interface SettingsModalProps {
  isOpen: boolean
  settings: LauncherSettings | null
  launcherDirectory: string
  onClose: () => void
  onSettingsChange: (settings: LauncherSettings) => void
  onBackgroundChanged?: () => void
}

function TrashSection({ onAlert }: { onAlert: (alert: any) => void }) {
  const [count, setCount] = useState(0)
  const [totalSize, setTotalSize] = useState(0)
  const [loading, setLoading] = useState(false)
  const [emptying, setEmptying] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const loadTrash = useCallback(async () => {
    setLoading(true)
    try {
      const [c, s] = await invoke<[number, number]>("get_trash_size")
      setCount(c)
      setTotalSize(s)
    } catch {
      setCount(0)
      setTotalSize(0)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadTrash() }, [loadTrash])

  const handleEmptyTrash = async () => {
    if (!confirmClear) {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 3000)
      return
    }
    setEmptying(true)
    try {
      await invoke("empty_trash")
      setCount(0)
      setTotalSize(0)
      setConfirmClear(false)
    } catch (e) {
      onAlert({ isOpen: true, title: "Error", message: `Failed to empty trash: ${e}`, type: "danger" })
    }
    setEmptying(false)
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[var(--text-primary)]">
        <Trash2 size={16} className="text-red-400" />
        <span className="font-medium text-sm">Trash</span>
      </div>
      <div className="bg-[var(--bg-elevated)] rounded p-3 space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Loader2 size={14} className="animate-spin" />
            <span>Loading trash...</span>
          </div>
        ) : count === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">Trash is empty</p>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)]">
              {count} item{count !== 1 ? "s" : ""} ({formatBytes(totalSize)})
            </span>
            <button
              onClick={handleEmptyTrash}
              disabled={emptying}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                confirmClear
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10"
              }`}
            >
              {emptying ? <Loader2 size={12} className="animate-spin" /> : confirmClear ? "Click again to confirm" : "Empty Trash"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function SettingsModal({
  isOpen,
  settings,
  launcherDirectory,
  onClose,
  onSettingsChange,
  onBackgroundChanged
}: SettingsModalProps) {
  const [javaInstallations, setJavaInstallations] = useState<string[]>([])
  const [isLoadingJava, setIsLoadingJava] = useState(false)
  const [showCustomPath, setShowCustomPath] = useState(false)
  const [customPathValue, setCustomPathValue] = useState("")
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [sidebarBgPreview, setSidebarBgPreview] = useState<string | null>(null)
  const [appVersion, setAppVersion] = useState<string>("")
  const [semanticVersion, setSemanticVersion] = useState<string>("")
  const [storageCategories, setStorageCategories] = useState<StorageCategory[]>([])
  const [storageLoading, setStorageLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null>(null)
  const [isClosing, setIsClosing] = useState(false)
  const [isJavaDropdownOpen, setIsJavaDropdownOpen] = useState(false)
  const javaDropdownRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    if (isOpen) {
      loadSystemInfo()
      loadSidebarBackground()
      loadJavaInstallations()
      loadAppVersion()
      loadStorageUsage()
    }

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (javaDropdownRef.current && !javaDropdownRef.current.contains(event.target as Node)) {
        setIsJavaDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!settings?.java_path) {
      setShowCustomPath(false)
      setCustomPathValue("")
      return
    }

    if (javaInstallations.length > 0) {
      const isCustom = !javaInstallations.includes(settings.java_path)
      setShowCustomPath(isCustom)
      if (isCustom) setCustomPathValue(settings.java_path)
      else setCustomPathValue("")
    }
  }, [settings?.java_path, javaInstallations])

  const loadAppVersion = async () => {
    try {
      const version = await invoke<string>("get_app_version")
      setAppVersion(version)
      setSemanticVersion(version.split('-')[0])
    } catch (error) {
      console.error("Failed to get app version:", error)
    }
  }

  const loadStorageUsage = async () => {
    setStorageLoading(true)
    try {
      const data = await invoke<StorageCategory[]>("get_storage_usage")
      setStorageCategories(data)
    } catch (error) {
      console.error("Failed to load storage usage:", error)
    } finally {
      setStorageLoading(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  const totalBytes = storageCategories.reduce((sum, c) => sum + c.size_bytes, 0)

  const storageColors: Record<string, string> = {
    Instances: "#3b82f6",
    Cache: "#f59e0b",
    Trash: "#ef4444",
    Other: "#6b7280",
  }

  const loadSystemInfo = async () => {
    try {
      const info = await invoke<SystemInfo>("get_system_info")
      setSystemInfo(info)
    } catch (error) {
      console.error("Failed to get system info:", error)
    }
  }

  const loadSidebarBackground = async () => {
    try {
      const bg = await invoke<string | null>("get_background")
      setSidebarBgPreview(bg)
    } catch (error) {
      console.error("Failed to load background:", error)
    }
  }

  const loadJavaInstallations = async () => {
    setIsLoadingJava(true)
    try {
      const installations = await invoke<string[]>("detect_java_installations")
      setJavaInstallations(installations)
    } catch (error) {
      console.error("Failed to detect Java installations:", error)
    } finally {
      setIsLoadingJava(false)
    }
  }

  const handleSettingChange = async (newSettings: LauncherSettings) => {
    try {
      await invoke("save_settings", { settings: newSettings })
      localStorage.setItem('octane_theme', newSettings.theme ?? 'octane')
      onSettingsChange(newSettings)
    } catch (error) {
      console.error("Failed to save settings:", error)
      setAlertModal({ isOpen: true, title: "An error occurred", message: "Failed to save settings" + `: ${error}`, type: "danger" })
    }
  }

  const handleSettingChangeDebounced = (newSettings: LauncherSettings) => {
    onSettingsChange(newSettings)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => handleSettingChange(newSettings), 500)
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setAlertModal({ isOpen: true, title: "Invalid File", message: "Please select an image file (PNG, JPG, etc.)", type: "warning" })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setAlertModal({ isOpen: true, title: "File Too Large", message: "Image must be smaller than 10MB", type: "warning" })
      return
    }

    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = e.target?.result as string
        
        try {
          await invoke("set_background", { imageData: base64 })
          setSidebarBgPreview(base64)
          onBackgroundChanged?.()
        } catch (error) {
          console.error("Failed to save background:", error)
          setAlertModal({ isOpen: true, title: "An error occurred", message: "Failed to save background" + `: ${error}`, type: "danger" })
        }
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error("Failed to read file:", error)
      setAlertModal({ isOpen: true, title: "An error occurred", message: "Failed to read image file", type: "danger" })
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveBackground = async () => {
    try {
      await invoke("remove_background")
      setSidebarBgPreview(null)
      onBackgroundChanged?.()
    } catch (error) {
      console.error("Failed to remove background:", error)
      setAlertModal({ isOpen: true, title: "An error occurred", message: "Failed to remove background" + `: ${error}`, type: "danger" })
    }
  }

  const handleOpenDirectory = async (path: string) => {
    try {
      await invoke("open_directory", { path })
    } catch (error) {
      console.error("Failed to open directory:", error)
      setAlertModal({ isOpen: true, title: "An error occurred", message: "Failed to open directory" + `: ${error}`, type: "danger" })
    }
  }

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => { setIsClosing(false); onClose() }, 150)
  }

  if (!isOpen) return null

  if (!settings) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-[var(--bg-primary)] rounded p-8">
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-base">
            <Loader2 size={20} className="animate-spin" />
            <span>Loading settings...</span>
          </div>
        </div>
      </div>
    )
  }

  const ramPercent = ((settings.memory_mb - 1024) / ((systemInfo?.total_memory_mb || 32768) - 1024)) * 100

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop ${isClosing ? 'closing' : ''}`}
        onClick={handleClose}
      >
        <div
          className={`blur-border bg-[var(--bg-primary)] rounded w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl modal-content ${isClosing ? 'closing' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border-default)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Settings</h2>
            <div className="flex items-center gap-3">
              {appVersion && (
                <span className="bg-[var(--bg-elevated)] px-2.5 py-1 rounded text-xs text-[var(--text-muted)]">
                  {"Build"} {appVersion.split('-')[1] || appVersion}
                </span>
              )}
              <button onClick={handleClose} className="p-1.5 hover:bg-[var(--bg-hover)] rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Memory */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <Cpu size={16} className="text-[var(--accent-primary)]" />
                <span className="font-medium text-sm">Memory Allocation</span>
              </div>
              <div className="bg-[var(--bg-elevated)] rounded p-3 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-bold text-[var(--text-primary)]">{(settings.memory_mb / 1024).toFixed(1)} GB</span>
                  <span className="text-xs text-[var(--text-muted)]">of {systemInfo ? (systemInfo.total_memory_mb / 1024).toFixed(0) : '16'} GB total</span>
                </div>
                <div className="relative h-6 flex items-center">
                  <div className="absolute inset-x-0 h-2 bg-[var(--bg-primary)] rounded-full" />
                  <div className="absolute h-2 rounded-full" style={{ width: `${ramPercent}%`, background: 'var(--accent-primary)' }} />
                  <div className="absolute w-4 h-4 rounded-full bg-[var(--accent-primary)] -translate-x-1/2 shadow-md" style={{ left: `${ramPercent}%` }} />
                  <input
                    type="range" min="1024" max={systemInfo?.total_memory_mb || 32768} step="512"
                    value={settings.memory_mb}
                    onChange={(e) => handleSettingChangeDebounced({ ...settings, memory_mb: parseInt(e.target.value) })}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  />
                </div>
                {systemInfo && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Available</span>
                    <span className="text-[var(--text-primary)] font-medium">{(systemInfo.available_memory_mb / 1024).toFixed(1)} GB</span>
                  </div>
                )}
              </div>
            </div>

            {/* Java */}
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <Coffee size={16} className="text-[var(--accent-primary)]" />
                <span className="font-medium text-sm">Java Runtime</span>
              </div>
              <div className="flex gap-2 min-w-0">
                <div className="relative flex-1 min-w-0" ref={javaDropdownRef}>
                  <button
                    onClick={() => setIsJavaDropdownOpen(!isJavaDropdownOpen)}
                    className={`w-full bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] text-left flex items-center justify-between cursor-pointer min-w-0 rounded`}
                  >
                    <span className="truncate">
                      {showCustomPath ? "Custom Path..." : (settings.java_path || "Auto-detect (Recommended)")}
                    </span>
                    <ChevronDown size={14} className={`flex-shrink-0 ml-2 transition-transform ${isJavaDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isJavaDropdownOpen && (
                    <div className="absolute z-[60] w-full bg-[var(--bg-elevated)] rounded shadow-lg max-h-60 overflow-y-auto mt-1">
                      <button
                        onClick={() => { setShowCustomPath(false); setCustomPathValue(""); handleSettingChange({ ...settings, java_path: null }); setIsJavaDropdownOpen(false) }}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-between cursor-pointer"
                      >
                        <span>Auto-detect (Recommended)</span>
                        {!settings.java_path && !showCustomPath && <Check size={14} className="text-[var(--text-primary)]" />}
                      </button>
                      {javaInstallations.map((path) => (
                        <button
                          key={path}
                          onClick={() => { setShowCustomPath(false); setCustomPathValue(""); handleSettingChange({ ...settings, java_path: path }); setIsJavaDropdownOpen(false) }}
                          className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-between cursor-pointer"
                        >
                          <span className="truncate">{path}</span>
                          {settings.java_path === path && !showCustomPath && <Check size={14} className="text-[var(--text-primary)] flex-shrink-0 ml-2" />}
                        </button>
                      ))}
                      <button
                        onClick={() => { setShowCustomPath(true); setCustomPathValue(settings.java_path || ""); setIsJavaDropdownOpen(false) }}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-between cursor-pointer"
                      >
                        <span>Custom Path...</span>
                        {showCustomPath && <Check size={14} className="text-[var(--text-primary)]" />}
                      </button>
                    </div>
                  )}
                </div>

                <button onClick={loadJavaInstallations} disabled={isLoadingJava} className="px-3 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] disabled:opacity-50 rounded text-sm font-medium text-[var(--text-primary)] cursor-pointer disabled:cursor-not-allowed">
                  {isLoadingJava ? <Loader2 size={14} className="animate-spin" /> : "Scan"}
                </button>
              </div>

              {showCustomPath && (
                <input
                  type="text"
                  className="w-full bg-[var(--bg-elevated)] rounded px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] font-mono min-w-0"
                  placeholder="C:\\Program Files\\Java\\jdk-21\\bin\\javaw.exe"
                  value={customPathValue}
                  onChange={(e) => setCustomPathValue(e.target.value)}
                  onBlur={() => { if (customPathValue.trim()) handleSettingChange({ ...settings, java_path: customPathValue.trim() }) }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && customPathValue.trim()) { handleSettingChange({ ...settings, java_path: customPathValue.trim() }); e.currentTarget.blur() } }}
                />
              )}
            </div>

            {/* Appearance */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <Paintbrush size={16} className="text-[var(--accent-primary)]" />
                <span className="font-medium text-sm">Theme</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "octane", label: "Octane", colors: ["#1a1d23", "#252932", "#4572e3", "#e6e6e6"] },
                  { id: "light", label: "Light", colors: ["#ffffff", "#f0f0f0", "#4361ee", "#1a1d23"] },
                  { id: "rose", label: "Rosé", colors: ["#1a1423", "#2a1a33", "#f472b6", "#e6e6e6"] },
                  { id: "cherry", label: "Cherry", colors: ["#1a0d0f", "#2a1417", "#dc2626", "#e6e6e6"] },
                ].map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => settings && handleSettingChange({ ...settings, theme: theme.id })}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded transition-all cursor-pointer ${
                      settings?.theme === theme.id
                        ? "bg-[var(--accent-primary)]/10 ring-1 ring-[var(--accent-primary)]"
                        : "bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)]"
                    }`}
                  >
                    <span className="text-sm font-medium text-[var(--text-primary)]">{theme.label}</span>
                    <div className="flex items-center gap-1">
                      {theme.colors.map((color, i) => (
                        <div key={i} className="w-3.5 h-3.5 rounded-full border border-white/10" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Background */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <ImagePlus size={16} className="text-[var(--accent-primary)]" />
                <span className="font-medium text-sm">Background</span>
              </div>
              {sidebarBgPreview ? (
                <div className="relative group">
                  <div className="h-32 rounded overflow-hidden bg-[var(--bg-elevated)]">
                    <img src={sidebarBgPreview} alt="Background" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded text-sm font-medium cursor-pointer">Change</button>
                    <button onClick={handleRemoveBackground} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium cursor-pointer">Remove</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} className="w-full h-24 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border-2 border-dashed border-[var(--border-default)] hover:border-[var(--accent-primary)] rounded transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer">
                  <ImagePlus size={24} className="text-[var(--text-muted)]" />
                  <span className="text-xs text-[var(--text-muted)]">Click to upload image</span>
                  <span className="text-[10px] text-[var(--text-muted)]">PNG, JPG up to 10MB</span>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            </div>

            {/* Console */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <Terminal size={16} className="text-[var(--accent-primary)]" />
                <span className="font-medium text-sm">Console</span>
              </div>
              <div className="flex items-center justify-between bg-[var(--bg-elevated)] rounded p-3">
                <div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">Auto-Navigate to Console</span>
                  <p className="text-xs text-[var(--text-muted)]">
                    {(settings.auto_navigate_to_console ?? true) ? "Switch to Console tab when launching" : "Stay on current tab when launching"}
                  </p>
                </div>
                <button
                  onClick={() => handleSettingChange({ ...settings, auto_navigate_to_console: !(settings.auto_navigate_to_console ?? true) })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ml-3 ${(settings.auto_navigate_to_console ?? true) ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-hover)]'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${(settings.auto_navigate_to_console ?? true) ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* Game Directory */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <FolderOpen size={16} className="text-[var(--accent-primary)]" />
                <span className="font-medium text-sm">Game Directory</span>
              </div>
              <div className="bg-[var(--bg-elevated)] rounded p-3 flex items-center justify-between gap-3">
                <p className="text-xs text-[var(--text-muted)] font-mono break-all flex-1">{launcherDirectory || "Loading..."}</p>
                <button
                  onClick={() => handleOpenDirectory(launcherDirectory)}
                  disabled={!launcherDirectory}
                  className="flex-shrink-0 px-2.5 py-1.5 bg-[var(--bg-hover)] hover:bg-[var(--bg-hover)] disabled:opacity-50 rounded text-xs font-medium text-[var(--text-primary)] cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                >
                  <FolderOpen size={12} />
                  Open
                </button>
              </div>
            </div>

            {/* Storage Overview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[var(--text-primary)]">
                <div className="flex items-center gap-2">
                  <FolderOpen size={16} className="text-[var(--accent-primary)]" />
                  <span className="font-medium text-sm">Storage Overview</span>
                </div>
                {storageCategories.length > 0 && (
                  <span className="text-xs text-[var(--text-muted)]">{formatBytes(totalBytes)}</span>
                )}
              </div>
              <div className="bg-[var(--bg-elevated)] rounded p-3 space-y-3">
                {storageLoading ? (
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Calculating storage usage...</span>
                  </div>
                ) : storageCategories.length === 0 ? (
                  <div className="text-xs text-[var(--text-muted)]">No data</div>
                ) : (
                  <>
                    <div className="h-2 rounded-full overflow-hidden flex bg-[var(--bg-primary)]">
                      {storageCategories.map((cat) => (
                        <div
                          key={cat.name}
                          style={{ width: `${(cat.size_bytes / totalBytes) * 100}%`, backgroundColor: storageColors[cat.name] || "#6b7280" }}
                          className="h-full first:rounded-l-full last:rounded-r-full"
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {storageCategories.map((cat) => (
                        <div key={cat.name} className="flex items-center gap-1.5 text-xs">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: storageColors[cat.name] || "#6b7280" }} />
                          <span className="text-[var(--text-muted)]">{cat.name}</span>
                          <span className="text-[var(--text-primary)] font-medium">{formatBytes(cat.size_bytes)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Trash */}
            <TrashSection onAlert={setAlertModal} />

            {/* Version Information */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <Info size={16} className="text-[var(--accent-primary)]" />
                <span className="font-medium text-sm">Version Information</span>
              </div>
              <div className="bg-[var(--bg-elevated)] rounded p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Launcher Version</span>
                  <span className="text-[var(--text-primary)] font-medium">{semanticVersion || "Loading..."}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {alertModal && <AlertModal isOpen={alertModal.isOpen} title={alertModal.title} message={alertModal.message} type={alertModal.type} onClose={() => setAlertModal(null)} />}
    </>
  )
}