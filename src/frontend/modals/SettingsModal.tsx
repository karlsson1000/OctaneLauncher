import { useState, useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Loader2, Coffee, Cpu, ImagePlus, FolderOpen, X, Check, ChevronDown, Info, Languages, Terminal, Archive } from "lucide-react"
import { AlertModal } from "./ConfirmModal"
import { SnapshotManager } from "../components/SnapshotManager"
import { useTranslation } from "react-i18next"
import type { LauncherSettings } from "../../types"
import i18n from '../../i18n'

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

type SettingsTab = "game" | "appearance" | "language" | "integrations" | "about" | "snapshots"

export function SettingsModal({ 
  isOpen, 
  settings, 
  launcherDirectory, 
  onClose, 
  onSettingsChange, 
  onBackgroundChanged 
}: SettingsModalProps) {
  const { t } = useTranslation()
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
  const [showSnapshotManager, setShowSnapshotManager] = useState(false)

  const languages = [
    { code: "en", name: "English", nativeName: "English" },
    { code: "sv", name: "Swedish", nativeName: "Svenska" },
    { code: "pt", name: "Portuguese", nativeName: "Português" },
    { code: "es", name: "Spanish", nativeName: "Español" },
    { code: "da", name: "Danish", nativeName: "Dansk" },
    { code: "fi", name: "Finnish", nativeName: "Suomi" },
    { code: "fr", name: "French", nativeName: "Français" },
    { code: "de", name: "German", nativeName: "Deutsch" },
    { code: "ja", name: "Japanese", nativeName: "日本語" },
    { code: "no", name: "Norwegian", nativeName: "Norsk" }
  ]

  useEffect(() => {
    if (isOpen) {
      setActiveTab("game")
      loadSystemInfo()
      loadSidebarBackground()
      loadJavaInstallations()
      loadAppVersion()
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (settings?.language) {
      i18n.changeLanguage(settings.language)
    }
  }, [settings?.language])

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
      const isCustomPath = !javaInstallations.includes(settings.java_path)
      setShowCustomPath(isCustomPath)
      if (isCustomPath) {
        setCustomPathValue(settings.java_path)
      } else {
        setCustomPathValue("")
      }
    }
  }, [settings?.java_path, javaInstallations])

  const loadAppVersion = async () => {
    try {
      const version = await invoke<string>("get_app_version")
      setAppVersion(version)

      const semanticVer = version.split('-')[0]
      setSemanticVersion(semanticVer)
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
      await invoke("update_discord_rpc_mode")
      onSettingsChange(newSettings)
    } catch (error) {
      console.error("Failed to save settings:", error)
      setAlertModal({
        isOpen: true,
        title: t('errors.generic'),
        message: t('settings.errors.failedToSave') + `: ${error}`,
        type: "danger"
      })
    }
  }

  const handleSettingChangeDebounced = (newSettings: LauncherSettings) => {
    onSettingsChange(newSettings)

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      handleSettingChange(newSettings)
    }, 500)
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setAlertModal({
        isOpen: true,
        title: t('settings.errors.invalidFile'),
        message: t('settings.errors.selectImage'),
        type: "warning"
      })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setAlertModal({
        isOpen: true,
        title: t('settings.errors.fileTooLarge'),
        message: t('settings.errors.imageTooLarge'),
        type: "warning"
      })
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
          setAlertModal({
            isOpen: true,
            title: t('errors.generic'),
            message: t('settings.errors.failedToSaveBackground') + `: ${error}`,
            type: "danger"
          })
        }
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error("Failed to read file:", error)
      setAlertModal({
        isOpen: true,
        title: t('errors.generic'),
        message: t('settings.errors.failedToReadFile'),
        type: "danger"
      })
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveBackground = async () => {
    try {
      await invoke("remove_sidebar_background")
      setSidebarBgPreview(null)
      onBackgroundChanged?.()
    } catch (error) {
      console.error("Failed to remove sidebar background:", error)
      setAlertModal({
        isOpen: true,
        title: t('errors.generic'),
        message: t('settings.errors.failedToRemoveBackground') + `: ${error}`,
        type: "danger"
      })
    }
  }

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 150)
  }

  if (!isOpen) return null

  if (!settings) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-[#1a1d23] rounded p-8">
          <div className="flex items-center gap-2 text-gray-400 text-base">
            <Loader2 size={20} className="animate-spin" />
            <span>{t('settings.loadingSettings')}</span>
          </div>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: "game" as const, label: t('settings.tabs.game'), icon: Cpu },
    { id: "appearance" as const, label: t('settings.tabs.appearance'), icon: ImagePlus },
    { id: "language" as const, label: t('settings.tabs.language'), icon: Languages },
    { id: "integrations" as const, label: t('settings.tabs.integrations'), icon: () => (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    )},
    { id: "snapshots" as const, label: "Snapshots", icon: Archive },
    { id: "about" as const, label: t('settings.tabs.system'), icon: FolderOpen }
  ]

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes scaleIn {
          from { 
            opacity: 0;
            transform: scale(0.95);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes scaleOut {
          from { 
            opacity: 1;
            transform: scale(1);
          }
          to { 
            opacity: 0;
            transform: scale(0.95);
          }
        }
        .modal-backdrop {
          animation: fadeIn 0.15s ease-out forwards;
        }
        .modal-backdrop.closing {
          animation: fadeOut 0.15s ease-in forwards;
        }
        .modal-content {
          animation: scaleIn 0.15s ease-out forwards;
        }
        .modal-content.closing {
          animation: scaleOut 0.15s ease-in forwards;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3d424d;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4d525d;
        }
        
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
          transition: none !important;
        }
        
        .blur-border:hover::before {
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.08),
            rgba(255, 255, 255, 0.04)
          );
        }
      `}</style>
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
            <h2 className="text-xl font-semibold text-white">{t('settings.title')}</h2>
            <div className="flex items-center gap-3">
              {appVersion && (
                <span className="bg-[#252932] px-2.5 py-1 rounded text-xs text-gray-400">
                  {t('settings.buildLabel')} {appVersion.split('-')[1] || appVersion}
                </span>
              )}
              <button
                onClick={handleClose}
                className="p-2 hover:bg-[#252932] rounded transition-colors text-gray-400 hover:text-white cursor-pointer"
              >
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-[#4572e3] text-white'
                        : 'text-gray-400 hover:bg-[#252932] hover:text-white'
                    }`}
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
                      <span className="font-medium">{t('settings.game.memory.title')}</span>
                    </div>
                    <div className="bg-[#252932] rounded p-4 space-y-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-bold text-white">
                          {(settings.memory_mb / 1024).toFixed(1)} GB
                        </span>
                        <span className="text-xs text-gray-400">
                          {t('settings.game.memory.ofTotal', { total: systemInfo ? (systemInfo.total_memory_mb / 1024).toFixed(0) : '16' })}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1024"
                        max={systemInfo?.total_memory_mb || 32768}
                        step="512"
                        value={settings.memory_mb}
                        onChange={(e) => handleSettingChangeDebounced({
                          ...settings,
                          memory_mb: parseInt(e.target.value)
                        })}
                        className="w-full h-2 bg-[#1a1d23] rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #4572e3 0%, #4572e3 ${((settings.memory_mb - 1024) / ((systemInfo?.total_memory_mb || 32768) - 1024)) * 100}%, #1a1d23 ${((settings.memory_mb - 1024) / ((systemInfo?.total_memory_mb || 32768) - 1024)) * 100}%, #1a1d23 100%)`
                        }}
                      />
                      {systemInfo && (
                        <div className="pt-2 border-t border-[#1a1d23] space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">{t('settings.game.memory.systemTotal')}</span>
                            <span className="text-white font-medium">
                              {(systemInfo.total_memory_mb / 1024).toFixed(1)} GB
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">{t('settings.game.memory.available')}</span>
                            <span className="text-white font-medium">
                              {(systemInfo.available_memory_mb / 1024).toFixed(1)} GB
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Java */}
                  <div className="space-y-3 min-w-0">
                    <div className="flex items-center gap-2 text-white">
                      <Coffee size={18} className="text-[#4572e3]" />
                      <span className="font-medium">{t('settings.game.java.title')}</span>
                    </div>
                    <div className="flex gap-2 min-w-0">
                      <div className="relative flex-1 min-w-0" ref={javaDropdownRef}>
                        <button
                          onClick={() => setIsJavaDropdownOpen(!isJavaDropdownOpen)}
                          className={`w-full bg-[#252932] px-4 py-2.5 text-sm text-white text-left flex items-center justify-between cursor-pointer min-w-0 ${
                            isJavaDropdownOpen ? 'rounded-t' : 'rounded'
                          }`}
                        >
                          <span className="truncate">
                            {showCustomPath ? t('settings.game.java.customPath') : (settings.java_path || t('settings.game.java.autoDetect'))}
                          </span>
                          <ChevronDown size={16} className={`flex-shrink-0 ml-2 transition-transform ${isJavaDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {isJavaDropdownOpen && (
                          <div className="absolute z-[60] w-full bg-[#252932] rounded-b shadow-lg max-h-48 overflow-y-auto custom-scrollbar border-t border-[#1a1d23]">
                            <button
                              onClick={() => {
                                setShowCustomPath(false)
                                setCustomPathValue("")
                                handleSettingChange({ ...settings, java_path: null })
                                setIsJavaDropdownOpen(false)
                              }}
                              className="w-full px-4 py-2.5 text-sm text-left hover:bg-[#2d3139] text-white flex items-center justify-between cursor-pointer"
                            >
                              <span>{t('settings.game.java.autoDetect')}</span>
                              {!settings.java_path && !showCustomPath && (
                                <Check size={16} className="text-white" />
                              )}
                            </button>
                            {javaInstallations.map((path) => (
                              <button
                                key={path}
                                onClick={() => {
                                  setShowCustomPath(false)
                                  setCustomPathValue("")
                                  handleSettingChange({ ...settings, java_path: path })
                                  setIsJavaDropdownOpen(false)
                                }}
                                className="w-full px-4 py-2.5 text-sm text-left hover:bg-[#2d3139] text-white flex items-center justify-between cursor-pointer"
                              >
                                <span className="truncate">{path}</span>
                                {settings.java_path === path && !showCustomPath && (
                                  <Check size={16} className="text-white flex-shrink-0 ml-2" />
                                )}
                              </button>
                            ))}
                            <button
                              onClick={() => {
                                setShowCustomPath(true)
                                setCustomPathValue(settings.java_path || "")
                                setIsJavaDropdownOpen(false)
                              }}
                              className="w-full px-4 py-2.5 text-sm text-left hover:bg-[#2d3139] text-white flex items-center justify-between cursor-pointer"
                            >
                              <span>{t('settings.game.java.customPath')}</span>
                              {showCustomPath && (
                                <Check size={16} className="text-white" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={loadJavaInstallations}
                        disabled={isLoadingJava}
                        className="px-4 py-2.5 bg-[#252932] hover:bg-[#2d3139] disabled:opacity-50 rounded text-sm font-medium text-white cursor-pointer disabled:cursor-not-allowed"
                      >
                        {isLoadingJava ? <Loader2 size={16} className="animate-spin" /> : t('settings.game.java.scan')}
                      </button>
                    </div>

                    {showCustomPath && (
                      <input
                        type="text"
                        className="w-full bg-[#252932] rounded px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#4572e3] font-mono min-w-0"
                        placeholder={t('settings.game.java.placeholder')}
                        value={customPathValue}
                        onChange={(e) => setCustomPathValue(e.target.value)}
                        onBlur={() => {
                          if (customPathValue.trim()) {
                            handleSettingChange({ ...settings, java_path: customPathValue.trim() })
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && customPathValue.trim()) {
                            handleSettingChange({ ...settings, java_path: customPathValue.trim() })
                            e.currentTarget.blur()
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
              )}

              {activeTab === "appearance" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-white">
                    <ImagePlus size={18} className="text-[#4572e3]" />
                    <span className="font-medium">{t('settings.appearance.sidebarBackground.title')}</span>
                  </div>
                  {sidebarBgPreview ? (
                    <div className="relative group">
                      <div className="h-48 rounded overflow-hidden bg-[#252932]">
                        <img src={sidebarBgPreview} alt="Background" className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-2">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-[#4572e3] hover:bg-[#3461d9] text-white rounded text-sm font-medium cursor-pointer"
                        >
                          {t('settings.appearance.sidebarBackground.change')}
                        </button>
                        <button
                          onClick={handleRemoveBackground}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium cursor-pointer"
                        >
                          {t('settings.appearance.sidebarBackground.remove')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-48 bg-[#252932] hover:bg-[#2d3139] border-2 border-dashed border-[#2a2e36] hover:border-[#4572e3] rounded transition-all flex flex-col items-center justify-center gap-2 cursor-pointer"
                    >
                      <ImagePlus size={32} className="text-gray-500" />
                      <span className="text-sm text-gray-400">{t('settings.appearance.sidebarBackground.clickToUpload')}</span>
                      <span className="text-xs text-gray-500">{t('settings.appearance.sidebarBackground.fileTypes')}</span>
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </div>
              )}

              {activeTab === "language" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-white mb-2">
                    <Languages size={18} className="text-[#4572e3]" />
                    <span className="font-medium">{t('settings.language.title')}</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-4">
                    {t('settings.language.description')}
                  </p>
                  <div className="grid grid-cols-3 gap-2 max-h-[270px] overflow-y-auto custom-scrollbar pr-2">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          i18n.changeLanguage(lang.code)
                          handleSettingChange({
                            ...settings,
                            language: lang.code
                          })
                        }}
                        className={`p-3 rounded text-left transition-colors cursor-pointer ${
                          (settings.language || 'en') === lang.code
                            ? 'bg-[#4572e3] text-white'
                            : 'bg-[#252932] text-gray-300 hover:bg-[#2d3139]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">{lang.nativeName}</div>
                            <div className="text-xs opacity-75">{lang.name}</div>
                          </div>
                          {(settings.language || 'en') === lang.code && (
                            <Check size={16} className="flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-[#252932]">
                    <button
                      onClick={async () => {
                        try {
                          await invoke('open_url', { url: 'https://translate.oct4ne.net' })
                        } catch (error) {
                          console.error('Failed to open translation link:', error)
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 cursor-pointer group"
                    >
                      <span>{t('settings.language.helpTranslate')}</span>
                      <span className="group-hover:text-[#4572e3] group-hover:underline transition-colors">translate.oct4ne.net</span>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "integrations" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-white mb-2">
                    <svg className="w-[18px] h-[18px] text-[#4572e3]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    <span className="font-medium">{t('settings.discord.title')}</span>
                  </div>
                  <div className="flex items-center justify-between bg-[#252932] rounded p-4">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                      </svg>
                      <div>
                        <span className="text-sm font-medium text-white">{t('settings.discord.showStatus')}</span>
                        <p className="text-xs text-gray-400">
                          {settings.discord_rpc_enabled
                            ? t('settings.discord.enabled')
                            : t('settings.discord.disabled')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSettingChange({
                        ...settings,
                        discord_rpc_enabled: !settings.discord_rpc_enabled
                      })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        settings.discord_rpc_enabled ? 'bg-[#4572e3]' : 'bg-[#2a2e36]'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.discord_rpc_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "snapshots" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-white mb-2">
                    <Archive size={18} className="text-[#4572e3]" />
                    <span className="font-medium">Octane Snapshots</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-4">
                    Create backups of your entire launcher including instances, settings, templates, and more. 
                    Restore them at any time or share with others.
                  </p>
                  <button
                    onClick={() => setShowSnapshotManager(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#4572e3] hover:bg-[#3461d9] text-white rounded text-sm font-medium cursor-pointer transition-colors"
                  >
                    <Archive size={18} />
                    <span>Manage Snapshots</span>
                  </button>
                  
                  <div className="mt-4 p-4 bg-[#252932] rounded">
                    <h4 className="text-sm font-medium text-white mb-2">What's included in snapshots:</h4>
                    <ul className="text-xs text-gray-400 space-y-1">
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#4572e3]" />
                        <span>All instances (mods, configs, worlds)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#4572e3]" />
                        <span>Launcher settings</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#4572e3]" />
                        <span>Templates</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#4572e3]" />
                        <span>Server list</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#4572e3]" />
                        <span>Custom backgrounds</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === "about" && (
                <div className="space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-white">
                      <FolderOpen size={18} className="text-[#4572e3]" />
                      <span className="font-medium">{t('settings.system.gameDirectory.title')}</span>
                    </div>
                    <div className="bg-[#252932] rounded p-4">
                      <p className="text-xs text-gray-400 font-mono break-all">
                        {launcherDirectory || t('common.actions.loading')}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-white">
                      <Info size={18} className="text-[#4572e3]" />
                      <span className="font-medium">{t('settings.system.version.title')}</span>
                    </div>
                    <div className="bg-[#252932] rounded p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">{t('settings.system.version.launcherVersion')}</span>
                        <span className="text-white font-medium">{semanticVersion || t('common.actions.loading')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Auto Navigate to Console */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-white">
                      <Terminal size={18} className="text-[#4572e3]" />
                      <span className="font-medium">{t('settings.system.autoNavigateConsole.title')}</span>
                    </div>
                    <div className="flex items-center justify-between bg-[#252932] rounded p-4">
                      <div>
                        <span className="text-sm font-medium text-white">{t('settings.system.autoNavigateConsole.label')}</span>
                        <p className="text-xs text-gray-400">
                          {(settings.auto_navigate_to_console ?? true)
                            ? t('settings.system.autoNavigateConsole.enabled')
                            : t('settings.system.autoNavigateConsole.disabled')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleSettingChange({
                          ...settings,
                          auto_navigate_to_console: !(settings.auto_navigate_to_console ?? true)
                        })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                          (settings.auto_navigate_to_console ?? true) ? 'bg-[#4572e3]' : 'bg-[#2a2e36]'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          (settings.auto_navigate_to_console ?? true) ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Snapshot Manager Modal */}
      {showSnapshotManager && (
        <SnapshotManager
          isOpen={showSnapshotManager}
          onClose={() => setShowSnapshotManager(false)}
        />
      )}

      {/* Alert Modal */}
      {alertModal && (
        <AlertModal
          isOpen={alertModal.isOpen}
          title={alertModal.title}
          message={alertModal.message}
          type={alertModal.type}
          onClose={() => setAlertModal(null)}
        />
      )}
    </>
  )
}