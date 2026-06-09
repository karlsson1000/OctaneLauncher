import { useState, useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Loader2, Coffee, Cpu, ImagePlus, FolderOpen, X, Check, ChevronDown, Info, Terminal } from "lucide-react"
import { AlertModal } from "../../components/ui/ConfirmModal"
import type { LauncherSettings } from "../../types"

interface SystemInfo {
  total_memory_mb: number
  available_memory_mb: number
  recommended_max_memory_mb: number
}

interface SettingsModalProps {
  isOpen: boolean
  settings: LauncherSettings | null
  launcherDirectory: string
  onClose: () => void
  onSettingsChange: (settings: LauncherSettings) => void
  onBackgroundChanged?: () => void
}

type SettingsTab = "game" | "appearance" | "about"

export function SettingsModal({
  isOpen,
  settings,
  launcherDirectory,
  onClose,
  onSettingsChange,
  onBackgroundChanged
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("game")
  const [javaInstallations, setJavaInstallations] = useState<string[]>([])
  const [isLoadingJava, setIsLoadingJava] = useState(false)
  const [showCustomPath, setShowCustomPath] = useState(false)
  const [customPathValue, setCustomPathValue] = useState("")
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [sidebarBgPreview, setSidebarBgPreview] = useState<string | null>(null)
  const [appVersion, setAppVersion] = useState<string>("")
  const [semanticVersion, setSemanticVersion] = useState<string>("")
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
  // Load data on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab("game")
      loadSystemInfo()
      loadSidebarBackground()
      loadJavaInstallations()
      loadAppVersion()
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
      const bg = await invoke<string | null>("get_sidebar_background")
      setSidebarBgPreview(bg)
    } catch (error) {
      console.error("Failed to load sidebar background:", error)
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
          await invoke("set_sidebar_background", { imageData: base64 })
          setSidebarBgPreview(base64)
          onBackgroundChanged?.()
        } catch (error) {
          console.error("Failed to save sidebar background:", error)
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
      await invoke("remove_sidebar_background")
      setSidebarBgPreview(null)
      onBackgroundChanged?.()
    } catch (error) {
      console.error("Failed to remove sidebar background:", error)
      setAlertModal({ isOpen: true, title: "An error occurred", message: "Failed to remove background" + `: ${error}`, type: "danger" })
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
        <div className="bg-[#1a1d23] rounded p-8">
          <div className="flex items-center gap-2 text-gray-400 text-base">
            <Loader2 size={20} className="animate-spin" />
            <span>Loading settings...</span>
          </div>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: "game" as const, label: "Game", icon: Cpu },
    { id: "appearance" as const, label: "Appearance", icon: ImagePlus },
    { id: "about" as const, label: "System", icon: FolderOpen }
  ]

  const ramPercent = ((settings.memory_mb - 1024) / ((systemInfo?.total_memory_mb || 32768) - 1024)) * 100

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop ${isClosing ? 'closing' : ''}`}
        onClick={handleClose}
      >
        <div
          className={`blur-border bg-[#1a1d23] rounded w-full max-w-3xl h-[500px] flex flex-col shadow-2xl modal-content ${isClosing ? 'closing' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-[#252932]">
            <h2 className="text-xl font-semibold text-white">Settings</h2>
            <div className="flex items-center gap-3">
              {appVersion && (
                <span className="bg-[#252932] px-2.5 py-1 rounded text-xs text-gray-400">
                  {"Build"} {appVersion.split('-')[1] || appVersion}
                </span>
              )}
              <button onClick={handleClose} className="p-2 hover:bg-[#252932] rounded transition-colors text-gray-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-1 min-h-0">
            {/* Sidebar */}
            <div className="w-48 border-r border-[#252932] p-3 space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors cursor-pointer ${activeTab === tab.id ? 'bg-[#4572e3] text-white' : 'text-gray-400 hover:bg-[#252932] hover:text-white'}`}
                  >
                    <Icon size={18} />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Tab Content */}
            <div className="flex-1 p-5 min-w-0 max-w-full overflow-y-auto custom-scrollbar">
              {activeTab === "game" && (
                <div className="space-y-5">
                  {/* Memory */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-white">
                      <Cpu size={18} className="text-[#4572e3]" />
                      <span className="font-medium">Memory Allocation</span>
                    </div>
                    <div className="bg-[#252932] rounded p-4 space-y-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-bold text-white">{(settings.memory_mb / 1024).toFixed(1)} GB</span>
                        <span className="text-xs text-gray-400">of {systemInfo ? (systemInfo.total_memory_mb / 1024).toFixed(0) : '16'} GB total</span>
                      </div>
                      <input
                        type="range" min="1024" max={systemInfo?.total_memory_mb || 32768} step="512"
                        value={settings.memory_mb}
                        onChange={(e) => handleSettingChangeDebounced({ ...settings, memory_mb: parseInt(e.target.value) })}
                        className="w-full h-2 bg-[#1a1d23] rounded-full appearance-none cursor-pointer"
                        style={{ background: `linear-gradient(to right, #4572e3 0%, #4572e3 ${ramPercent}%, #1a1d23 ${ramPercent}%, #1a1d23 100%)` }}
                      />
                      {systemInfo && (
                        <div className="pt-2 border-t border-[#1a1d23] space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">System Total</span>
                            <span className="text-white font-medium">{(systemInfo.total_memory_mb / 1024).toFixed(1)} GB</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Available</span>
                            <span className="text-white font-medium">{(systemInfo.available_memory_mb / 1024).toFixed(1)} GB</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Java */}
                  <div className="space-y-3 min-w-0">
                    <div className="flex items-center gap-2 text-white">
                      <Coffee size={18} className="text-[#4572e3]" />
                      <span className="font-medium">Java Runtime</span>
                    </div>
                    <div className="flex gap-2 min-w-0">
                      <div className="relative flex-1 min-w-0" ref={javaDropdownRef}>
                        <button
                          onClick={() => setIsJavaDropdownOpen(!isJavaDropdownOpen)}
                          className={`w-full bg-[#252932] px-4 py-2.5 text-sm text-white text-left flex items-center justify-between cursor-pointer min-w-0 ${isJavaDropdownOpen ? 'rounded-b' : 'rounded'}`}
                        >
                          <span className="truncate">
                            {showCustomPath ? "Custom Path..." : (settings.java_path || "Auto-detect (Recommended)")}
                          </span>
                          <ChevronDown size={16} className={`flex-shrink-0 ml-2 transition-transform ${isJavaDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isJavaDropdownOpen && (
                          <div className="absolute z-[60] w-full bg-[#252932] rounded-t shadow-lg max-h-64 overflow-y-auto custom-scrollbar border-b border-[#1a1d23] bottom-full">
                            <button
                              onClick={() => { setShowCustomPath(false); setCustomPathValue(""); handleSettingChange({ ...settings, java_path: null }); setIsJavaDropdownOpen(false) }}
                              className="w-full px-4 py-2.5 text-sm text-left hover:bg-[#2d3139] text-white flex items-center justify-between cursor-pointer"
                            >
                              <span>Auto-detect (Recommended)</span>
                              {!settings.java_path && !showCustomPath && <Check size={16} className="text-white" />}
                            </button>
                            {javaInstallations.map((path) => (
                              <button
                                key={path}
                                onClick={() => { setShowCustomPath(false); setCustomPathValue(""); handleSettingChange({ ...settings, java_path: path }); setIsJavaDropdownOpen(false) }}
                                className="w-full px-4 py-2.5 text-sm text-left hover:bg-[#2d3139] text-white flex items-center justify-between cursor-pointer"
                              >
                                <span className="truncate">{path}</span>
                                {settings.java_path === path && !showCustomPath && <Check size={16} className="text-white flex-shrink-0 ml-2" />}
                              </button>
                            ))}
                            <button
                              onClick={() => { setShowCustomPath(true); setCustomPathValue(settings.java_path || ""); setIsJavaDropdownOpen(false) }}
                              className="w-full px-4 py-2.5 text-sm text-left hover:bg-[#2d3139] text-white flex items-center justify-between cursor-pointer"
                            >
                              <span>Custom Path...</span>
                              {showCustomPath && <Check size={16} className="text-white" />}
                            </button>
                          </div>
                        )}
                      </div>

                      <button onClick={loadJavaInstallations} disabled={isLoadingJava} className="px-4 py-2.5 bg-[#252932] hover:bg-[#2d3139] disabled:opacity-50 rounded text-sm font-medium text-white cursor-pointer disabled:cursor-not-allowed">
                        {isLoadingJava ? <Loader2 size={16} className="animate-spin" /> : "Scan"}
                      </button>
                    </div>

                    {showCustomPath && (
                      <input
                        type="text"
                        className="w-full bg-[#252932] rounded px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#4572e3] font-mono min-w-0"
                        placeholder="C:\\Program Files\\Java\\jdk-21\\bin\\javaw.exe"
                        value={customPathValue}
                        onChange={(e) => setCustomPathValue(e.target.value)}
                        onBlur={() => { if (customPathValue.trim()) handleSettingChange({ ...settings, java_path: customPathValue.trim() }) }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && customPathValue.trim()) { handleSettingChange({ ...settings, java_path: customPathValue.trim() }); e.currentTarget.blur() } }}
                      />
                    )}
                  </div>
                </div>
              )}

              {activeTab === "appearance" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-white">
                    <ImagePlus size={18} className="text-[#4572e3]" />
                    <span className="font-medium">Sidebar Background</span>
                  </div>
                  {sidebarBgPreview ? (
                    <div className="relative group">
                      <div className="h-48 rounded overflow-hidden bg-[#252932]">
                        <img src={sidebarBgPreview} alt="Background" className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-2">
                        <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-[#4572e3] hover:bg-[#3461d9] text-white rounded text-sm font-medium cursor-pointer">Change</button>
                        <button onClick={handleRemoveBackground} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium cursor-pointer">Remove</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => fileInputRef.current?.click()} className="w-full h-48 bg-[#252932] hover:bg-[#2d3139] border-2 border-dashed border-[#2a2e36] hover:border-[#4572e3] rounded transition-all flex flex-col items-center justify-center gap-2 cursor-pointer">
                      <ImagePlus size={32} className="text-gray-500" />
                      <span className="text-sm text-gray-400">Click to upload image</span>
                      <span className="text-xs text-gray-500">PNG, JPG up to 10MB</span>
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </div>
              )}

              {activeTab === "about" && (
                <div className="space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-white">
                      <FolderOpen size={18} className="text-[#4572e3]" />
                      <span className="font-medium">Game Directory</span>
                    </div>
                    <div className="bg-[#252932] rounded p-4">
                      <p className="text-xs text-gray-400 font-mono break-all">{launcherDirectory || "Loading..."}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-white">
                      <Info size={18} className="text-[#4572e3]" />
                      <span className="font-medium">Version Information</span>
                    </div>
                    <div className="bg-[#252932] rounded p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Launcher Version</span>
                        <span className="text-white font-medium">{semanticVersion || "Loading..."}</span>
                      </div>
                    </div>
                  </div>

                  {/* Auto Navigate to Console */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-white">
                      <Terminal size={18} className="text-[#4572e3]" />
                      <span className="font-medium">Console Navigation</span>
                    </div>
                    <div className="flex items-center justify-between bg-[#252932] rounded p-4">
                      <div>
                        <span className="text-sm font-medium text-white">Auto-Navigate to Console</span>
                        <p className="text-xs text-gray-400">
                          {(settings.auto_navigate_to_console ?? true) ? "Automatically switch to Console tab when launching" : "Stay on current tab when launching"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleSettingChange({ ...settings, auto_navigate_to_console: !(settings.auto_navigate_to_console ?? true) })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${(settings.auto_navigate_to_console ?? true) ? 'bg-[#4572e3]' : 'bg-[#2a2e36]'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${(settings.auto_navigate_to_console ?? true) ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {alertModal && <AlertModal isOpen={alertModal.isOpen} title={alertModal.title} message={alertModal.message} type={alertModal.type} onClose={() => setAlertModal(null)} />}
    </>
  )
}