import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { Minus, Square, X, ChevronLeft, ChevronRight, ChevronDown, Loader2, LogIn, LogOut, Check, Users } from "lucide-react"
import { SettingsModal } from "./features/settings/SettingsModal"
import { CreateInstanceModal } from "./features/instances/CreateInstanceModal"
import { CreationProgressToast } from "./features/instances/CreationProgressToast"
import { InstanceDetailsTab } from "./features/instances/InstanceDetailsTab"
import { ConfirmModal, AlertModal } from "./components/ui/ConfirmModal"
import { Sidebar } from "./components/layout/Sidebar"
import { FriendsPanel } from "./features/social/FriendsPanel"
import type { Instance, LauncherSettings, ConsoleLog, AccountInfo, UpdateInfo } from "./types"
import type { CSSProperties } from "react"

const HomeTab = lazy(() => import("./features/home/HomeTab").then(m => ({ default: m.HomeTab })))
const InstancesTab = lazy(() => import("./features/instances/InstancesTab").then(m => ({ default: m.InstancesTab })))
const BrowseTab = lazy(() => import("./features/browse/BrowseTab").then(m => ({ default: m.BrowseTab })))
const ConsoleTab = lazy(() => import("./features/console/ConsoleTab").then(m => ({ default: m.ConsoleTab })))
const ServersTab = lazy(() => import("./features/servers/ServersTab").then(m => ({ default: m.ServersTab })))
const SkinsTab = lazy(() => import("./features/skins/SkinsTab").then(m => ({ default: m.SkinsTab })))
const ScreenshotsTab = lazy(() => import("./features/screenshots/ScreenshotsTab").then(m => ({ default: m.ScreenshotsTab })))

function Loader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <Loader2 size={32} className="animate-spin text-[#16a34a]" />
    </div>
  )
}

function App() {
  const [isReady, setIsReady] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeAccount, setActiveAccount] = useState<AccountInfo | null>(null)
  const [accounts, setAccounts] = useState<AccountInfo[]>([])
  const [launchingInstanceName, setLaunchingInstanceName] = useState<string | null>(null)
  const [runningInstances, setRunningInstances] = useState<Set<string>>(new Set())
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [versions, setVersions] = useState<string[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null)
  const [launcherDirectory, setLauncherDirectory] = useState("")
  const [settings, setSettings] = useState<LauncherSettings | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const [activeTab, setActiveTab] = useState<"home" | "instances" | "browse" | "console" | "servers" | "skins" | "screenshots">("home")
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([])
  const [showInstanceDetails, setShowInstanceDetails] = useState(false)
  const [creatingInstanceName, setCreatingInstanceName] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
    onConfirm: () => void
  } | null>(null)
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null>(null)
  const [, setInstanceIcons] = useState<Record<string, string | null>>({})
  const [navigationHistory, setNavigationHistory] = useState<Array<{tab: typeof activeTab, showDetails: boolean, instance: Instance | null}>>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isNavigating, setIsNavigating] = useState(false)
  const [background, setBackground] = useState<string | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [sidebarContextMenu, setSidebarContextMenu] = useState<{
    x: number
    y: number
    instance: Instance
  } | null>(null)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false)
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [showFriendsPanel, setShowFriendsPanel] = useState(false)
  const [browseSubTab, setBrowseSubTab] = useState<"mods" | "modpacks" | "resourcepacks" | "shaderpacks">("mods")

  const appWindow = getCurrentWindow()

  useEffect(() => {
    if (!showAccountDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest("[data-account-dropdown]") && !target.closest("[data-account-button]")) {
        setShowAccountDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showAccountDropdown])

  const dragRegion = { WebkitAppRegion: 'drag' as const } as CSSProperties
  const noDragRegion = { WebkitAppRegion: 'no-drag' as const } as CSSProperties

  const pushToHistory = (tab: typeof activeTab, showDetails: boolean, instance: Instance | null) => {
    if (isNavigating) return
    setNavigationHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push({ tab, showDetails, instance })
      return newHistory
    })
    setHistoryIndex(prev => prev + 1)
  }

  const navigateBack = useCallback(() => {
    if (historyIndex > 0) {
      setIsNavigating(true)
      const newIndex = historyIndex - 1
      const state = navigationHistory[newIndex]
      setActiveTab(state.tab)
      setShowInstanceDetails(state.showDetails)
      if (state.instance) setSelectedInstance(state.instance)
      setHistoryIndex(newIndex)
      setTimeout(() => setIsNavigating(false), 0)
    }
  }, [historyIndex, navigationHistory])

  const navigateForward = useCallback(() => {
    if (historyIndex < navigationHistory.length - 1) {
      setIsNavigating(true)
      const newIndex = historyIndex + 1
      const state = navigationHistory[newIndex]
      setActiveTab(state.tab)
      setShowInstanceDetails(state.showDetails)
      if (state.instance) setSelectedInstance(state.instance)
      setHistoryIndex(newIndex)
      setTimeout(() => setIsNavigating(false), 0)
    }
  }, [historyIndex, navigationHistory])

  const checkForUpdates = async () => {
    try {
      const update = await invoke<string | null>("check_for_updates")
      if (update) {
        const parts = update.split(' -> ')
        if (parts.length === 2) {
          const info: UpdateInfo = {
            current_version: parts[0].trim(),
            new_version: parts[1].trim()
          }
          const dismissedVersion = sessionStorage.getItem("dismissed_update_version")
          if (dismissedVersion !== info.new_version) {
            setUpdateInfo(info)
          }
        }
      }
    } catch (error) {
      console.error("Failed to check for updates:", error)
    }
  }

  const handleInstallUpdate = useCallback(async () => {
    if (!updateInfo) return
    setIsInstallingUpdate(true)
    try {
      await invoke("install_update")
    } catch (error) {
      console.error("Failed to install update:", error)
      setAlertModal({
        isOpen: true,
        title: "Update Failed",
        message: `Failed to install update: ${error}`,
        type: "danger"
      })
      setIsInstallingUpdate(false)
    }
  }, [updateInfo])

  useEffect(() => {
    const initializeApp = async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
      setIsReady(true)
      const splash = document.getElementById('splash-screen')
      const root = document.getElementById('root')
      if (splash && root) {
        splash.classList.add('hidden')
        root.classList.add('visible')
        setTimeout(() => splash.remove(), 500)
      }
      checkForUpdates()
    }
    initializeApp()
  }, [])

  useEffect(() => {
    if (!isReady) return
    loadVersions()
    loadInstances()
    loadLauncherDirectory()
    loadSettings()
    loadAccounts()
    loadBackground()

    const unlistenConsole = listen<ConsoleLog>("console-log", (event) => {
      setConsoleLogs((prev) => [...prev, event.payload])
    })

    const unlistenExit = listen<{ instance: string }>("instance-exited", (event) => {
      setRunningInstances((prev) => {
        const newSet = new Set(prev)
        newSet.delete(event.payload.instance)
        return newSet
      })
      setLaunchingInstanceName(null)
    })

    const unlistenServerLaunch = listen<{ instance: string, server: string }>("server-instance-launching", (event) => {
      setLaunchingInstanceName(event.payload.instance)
      setConsoleLogs([])
      if (settingsRef.current?.auto_navigate_to_console !== false) setActiveTab("console")
      setRunningInstances((prev) => new Set(prev).add(event.payload.instance))
    })

    return () => {
      unlistenConsole.then((fn) => fn())
      unlistenExit.then((fn) => fn())
      unlistenServerLaunch.then((fn) => fn())
    }
  }, [isReady])

  useEffect(() => {
    if (!isNavigating && isReady) {
      pushToHistory(activeTab, showInstanceDetails, selectedInstance)
    }
  }, [activeTab, showInstanceDetails, selectedInstance?.name])

  useEffect(() => {
    if (instances.length === 0) return
    let cancelled = false
    const loadIcons = async () => {
      const results = await Promise.all(
        instances.map(instance =>
          invoke<string | null>("get_instance_icon", { instanceName: instance.name })
            .catch(() => null as string | null)
        )
      )
      if (cancelled) return
      const icons: Record<string, string | null> = {}
      instances.forEach((instance, i) => { icons[instance.name] = results[i] })
      setInstanceIcons(icons)
    }
    loadIcons()
    return () => { cancelled = true }
  }, [instances])

  const loadVersions = async () => {
    try {
      const versionList = await invoke<string[]>("get_minecraft_versions")
      setVersions(versionList)
    } catch (error) {
      console.error("Failed to load versions:", error)
    }
  }

  const loadInstances = useCallback(async (renamedFrom?: string, renamedTo?: string) => {
    try {
      const instanceList = await invoke<Instance[]>("get_instances")
      setInstances(instanceList)
      if (selectedInstance) {
        let searchName = selectedInstance.name
        if (renamedFrom && renamedTo && selectedInstance.name === renamedFrom) {
          searchName = renamedTo
        }
        const updated = instanceList.find(i => i.name === searchName)
        if (updated) setSelectedInstance(updated)
        else setSelectedInstance(instanceList[0] || null)
      } else if (instanceList.length > 0 && !selectedInstance) {
        setSelectedInstance(instanceList[0])
      }
    } catch (error) {
      console.error("Failed to load instances:", error)
    }
  }, [selectedInstance])

  const handleInstanceRenamed = useCallback((oldName: string, newName: string) => {
    loadInstances(oldName, newName)
  }, [loadInstances])

  const loadLauncherDirectory = async () => {
    try {
      const dir = await invoke<string>("get_launcher_directory")
      setLauncherDirectory(dir)
    } catch (error) {
      console.error("Failed to get launcher directory:", error)
    }
  }

  const loadSettings = async () => {
    try {
      const s = await invoke<LauncherSettings>("get_settings")
      setSettings(s)
    } catch (e) {
      console.error("Failed to load settings", e)
    }
  }

  const loadBackground = async () => {
    try {
      const bg = await invoke<string | null>("get_background")
      setBackground(bg)
    } catch (error) {
      console.error("Failed to load background:", error)
    }
  }

  const loadAccounts = async () => {
    try {
      const accountList = await invoke<AccountInfo[]>("get_accounts")
      setAccounts(accountList)
      const active = accountList.find(acc => acc.is_active)
      setActiveAccount(active || null)
      setIsAuthenticated(!!active)
      if (active) {
        invoke("register_user_in_friends_system").catch(() => {})
      }
    } catch (error) {
      console.error("Failed to load accounts:", error)
    }
  }

  const handleLaunch = useCallback(async (instance: Instance) => {
    if (!activeAccount) return
    setLaunchingInstanceName(instance.name)
    setConsoleLogs([])
    if (settings?.auto_navigate_to_console !== false) {
      setActiveTab("console")
      setShowInstanceDetails(false)
    }
    try {
      await invoke<string>("launch_instance_with_active_account", {
        instanceName: instance.name,
        appHandle: appWindow,
      })
      await loadInstances()
      setRunningInstances((prev) => new Set(prev).add(instance.name))
      setLaunchingInstanceName(null)
    } catch (error) {
      console.error("Launch error:", error)
      setLaunchingInstanceName(null)
    }
  }, [activeAccount, settings, appWindow, loadInstances])

  const handleDeleteInstance = useCallback(async (instanceName: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Instance",
      message: `Are you sure you want to delete "${instanceName}"?\n\nThis action cannot be undone.`,
      type: "danger",
      onConfirm: async () => {
        setConfirmModal(null)
        try {
          await invoke<string>("delete_instance", { instanceName })
          await loadInstances()
          if (selectedInstance?.name === instanceName) {
            setSelectedInstance(instances.length > 1 ? instances.find(i => i.name !== instanceName) || null : null)
          }
        } catch (error) {
          console.error("Delete error:", error)
        }
      }
    })
  }, [selectedInstance, instances, loadInstances])

  const handleDuplicateInstance = useCallback(async (instance: Instance) => {
    let baseName = instance.name
    let counter = 1
    let newName = `${baseName} (Copy)`
    while (instances.some(i => i.name === newName)) {
      counter++
      newName = `${baseName} (Copy ${counter})`
    }
    setCreatingInstanceName(newName)
    try {
      await invoke("duplicate_instance", {
        instanceName: instance.name,
        newName,
        appHandle: appWindow,
      })
      await loadInstances()
    } catch (error) {
      console.error("Duplicate error:", error)
      setCreatingInstanceName(null)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to duplicate instance: ${error}`,
        type: "danger"
      })
    }
  }, [instances, loadInstances])

  const handleOpenInstanceFolderByInstance = useCallback(async (instance: Instance) => {
    try {
      await invoke("open_instance_folder", { instanceName: instance.name })
    } catch (error) {
      console.error("Failed to open folder:", error)
    }
  }, [])

  const handleShowDetails = useCallback((instance: Instance) => {
    setSelectedInstance(instance)
    setShowInstanceDetails(true)
  }, [])

  const handleCloseDetails = useCallback(() => {
    setShowInstanceDetails(false)
  }, [])

  const handleStartCreating = useCallback((instanceName: string) => {
    setCreatingInstanceName(instanceName)
    setActiveTab('instances')
  }, [])

  const handleCreationComplete = () => {
    setCreatingInstanceName(null)
    loadInstances()
  }

  const handleCreationError = useCallback(() => {
    setCreatingInstanceName(null)
  }, [])

  const handleKillInstance = useCallback(async (instance: Instance) => {
    try {
      await invoke("kill_instance", { instanceName: instance.name })
      setRunningInstances((prev) => {
        const newSet = new Set(prev)
        newSet.delete(instance.name)
        return newSet
      })
    } catch (error) {
      console.error("Failed to kill instance:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to stop instance: ${error}`,
        type: "danger"
      })
    }
  }, [])

  const handleOpenSettings = useCallback(() => setShowSettingsModal(true), [])
  const handleCreateNew = useCallback(() => setShowCreateModal(true), [])
  const handleClearConsole = useCallback((instanceName: string) => {
    setConsoleLogs(prev => prev.filter(log => log.instance !== instanceName))
  }, [])
  const handleNavigateToInstances = useCallback(() => setActiveTab("instances"), [])
  const handleLaunchSelected = useCallback(() => {
    if (selectedInstance) handleLaunch(selectedInstance)
  }, [selectedInstance, handleLaunch])

  const tabLabels: Record<typeof activeTab, string> = {
    home: "Home",
    instances: "Instances",
    browse: "Addons",
    servers: "Servers",
    skins: "Skins",
    screenshots: "Screenshots",
    console: "Console",
  }

  const browseSubTabLabels: Record<string, string> = {
    mods: "Mods",
    modpacks: "Modpacks",
    resourcepacks: "Resource Packs",
    shaderpacks: "Shader Packs",
  }

  return (
    <div className={`flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden font-sans ${settings?.theme ? `theme-${settings.theme}` : 'theme-octane'}`}>

      <div
        data-tauri-drag-region
        style={{ userSelect: 'none', ...dragRegion } as CSSProperties}
        className="h-9 flex-shrink-0 flex items-center pl-5 pr-3 gap-2"
      >
        <div className="flex items-center gap-2 flex-shrink-0">
          <img src="/logo.png" alt="Octane" className="h-4 w-4" />
          <span className="text-sm font-semibold text-[var(--text-secondary)]">Octane Launcher</span>
        </div>

        <div className="flex items-center gap-0.5 ml-1" style={noDragRegion}>
          <button
            onClick={navigateBack}
            disabled={historyIndex <= 0}
            className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
              historyIndex > 0 ? "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] cursor-pointer" : "text-[var(--text-disabled)] cursor-not-allowed"
            }`}
          >
            <ChevronLeft size={18} strokeWidth={3} />
          </button>
          <button
            onClick={navigateForward}
            disabled={historyIndex >= navigationHistory.length - 1}
            className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
              historyIndex < navigationHistory.length - 1 ? "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] cursor-pointer" : "text-[var(--text-disabled)] cursor-not-allowed"
            }`}
          >
            <ChevronRight size={18} strokeWidth={3} />
          </button>
        </div>

        <span className="text-sm font-medium text-[var(--text-secondary)] ml-1 select-none" style={dragRegion}>
          {showInstanceDetails && selectedInstance
            ? `Instances / ${selectedInstance.name}`
            : activeTab === "browse"
            ? `Addons / ${browseSubTabLabels[browseSubTab]}`
            : tabLabels[activeTab]}
        </span>

        <div className="flex-1" style={dragRegion} />

        <div className="relative flex items-center mr-1" style={noDragRegion}>
          {isAuthenticated && activeAccount ? (
            <>
              <button
                data-account-button
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className="flex items-center gap-1.5 px-2 h-7 rounded text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all cursor-pointer"
              >
                <img
                  src={`https://avatar.mcindex.net/avatar/${activeAccount.username}/16`}
                  alt={activeAccount.username}
                  className="w-4 h-4 rounded object-cover flex-shrink-0"
                  style={{ imageRendering: "pixelated" }}
                />
                <span>{activeAccount.username}</span>
                <ChevronDown size={14} strokeWidth={3} className={`transition-transform ${showAccountDropdown ? "rotate-180" : ""}`} />
              </button>
              {showAccountDropdown && (
                <div
                  data-account-dropdown
                  className="absolute top-full mt-1 w-48 bg-[var(--bg-tertiary)] rounded shadow-lg overflow-hidden z-50 left-1/2 -translate-x-1/2"
                >
                  <div>
                    {accounts.map(acc => (
                      <button
                        key={acc.uuid}
                        onClick={async () => {
                          if (!acc.is_active) {
                            try { await invoke("switch_account", { uuid: acc.uuid }); await loadAccounts() } catch {}
                          }
                          setShowAccountDropdown(false)
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                      >
                        <img
                          src={`https://avatar.mcindex.net/avatar/${acc.username}/24`}
                          alt={acc.username}
                          className="w-6 h-6 rounded object-cover flex-shrink-0"
                          style={{ imageRendering: "pixelated" }}
                        />
                        <span className="flex-1 text-left">{acc.username}</span>
                        {acc.is_active && <Check size={14} strokeWidth={3} className="text-[#16a34a]" />}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-[var(--border-default)]" />
                  <div>
                    <button
                      onClick={async () => {
                        try { await invoke("microsoft_login_and_store"); await loadAccounts(); setShowAccountDropdown(false) } catch {}
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                    >
                      <LogIn size={16} strokeWidth={3} className="text-[#16a34a]" />
                      Add Account
                    </button>
                    <button
                      onClick={async () => {
                        try { await invoke("remove_account", { uuid: activeAccount.uuid }); await loadAccounts(); setShowAccountDropdown(false) } catch {}
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                    >
                      <LogOut size={16} strokeWidth={3} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button
              onClick={async () => {
                try { await invoke("microsoft_login_and_store"); await loadAccounts() } catch {}
              }}
              className="flex items-center gap-1.5 px-2 h-6 rounded text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all cursor-pointer"
            >
              <LogIn size={14} strokeWidth={2} className="text-[#16a34a]" />
              Sign in
            </button>
          )}
        </div>

        <div className="flex items-center" style={noDragRegion}>
          <button
            data-friends-toggle
            onClick={() => setShowFriendsPanel(!showFriendsPanel)}
            className={`h-7 w-7 flex items-center justify-center rounded transition-colors cursor-pointer ${
              showFriendsPanel ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            }`}
            title="Friends"
          >
            <Users size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="flex items-center" style={noDragRegion}>
          <button onClick={() => appWindow.minimize()} className="h-9 w-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
            <Minus size={18} strokeWidth={3} />
          </button>
          <button onClick={() => appWindow.toggleMaximize()} className="h-9 w-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
            <Square size={14} strokeWidth={3} />
          </button>
          <button onClick={() => appWindow.close()} className="h-9 w-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-red-500 transition-colors cursor-pointer">
            <X size={18} strokeWidth={3} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden px-4 gap-4">

        <Sidebar
          setActiveTab={setActiveTab}
          setShowInstanceDetails={setShowInstanceDetails}
          activeTab={activeTab}
          sidebarContextMenu={sidebarContextMenu}
          setSidebarContextMenu={setSidebarContextMenu}
          setSelectedInstance={setSelectedInstance}
          onOpenInstanceFolder={handleOpenInstanceFolderByInstance}
          onDuplicateInstance={handleDuplicateInstance}
          onDeleteInstance={handleDeleteInstance}
          updateInfo={updateInfo}
          isInstallingUpdate={isInstallingUpdate}
          onInstallUpdate={handleInstallUpdate}
          onOpenSettings={handleOpenSettings}
          onCreateNew={handleCreateNew}
        />

        <div
          className="flex-1 rounded-xl overflow-hidden flex flex-col relative"
          style={
            background
              ? { backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { backgroundColor: 'var(--content-bg)' }
          }
        >
          {background && <div className="absolute inset-0 bg-black/80" />}

          <main className="flex-1 overflow-y-auto relative z-10">
            {showInstanceDetails && selectedInstance ? (
              <InstanceDetailsTab
                instance={selectedInstance}
                isAuthenticated={isAuthenticated}
                isLaunching={launchingInstanceName === selectedInstance.name}
                isRunning={runningInstances.has(selectedInstance.name)}
                onLaunch={handleLaunchSelected}
                onBack={handleCloseDetails}
                onInstanceUpdated={loadInstances}
                onInstanceRenamed={handleInstanceRenamed}
              />
            ) : (
              <>
                {activeTab === "home" && (
                  <Suspense fallback={<Loader />}>
                    <HomeTab
                      instances={instances}
                      isAuthenticated={isAuthenticated}
                      activeAccount={activeAccount}
                      launchingInstanceName={launchingInstanceName}
                      runningInstances={runningInstances}
                      onLaunch={handleLaunch}
                      onDeleteInstance={handleDeleteInstance}
                      onShowDetails={handleShowDetails}
                      onOpenFolderByInstance={handleOpenInstanceFolderByInstance}
                      onDuplicateInstance={handleDuplicateInstance}
                      onKillInstance={handleKillInstance}
                      onNavigateToInstances={handleNavigateToInstances}
                    />
                  </Suspense>
                )}
                {activeTab === "instances" && (
                  <Suspense fallback={<Loader />}>
                    <InstancesTab
                      instances={instances}
                      isAuthenticated={isAuthenticated}
                      launchingInstanceName={launchingInstanceName}
                      runningInstances={runningInstances}
                      onSetSelectedInstance={setSelectedInstance}
                      onLaunch={handleLaunch}
                      onCreateNew={handleCreateNew}
                      onShowDetails={handleShowDetails}
                      onOpenFolder={handleOpenInstanceFolderByInstance}
                      onDuplicateInstance={handleDuplicateInstance}
                      onDeleteInstance={handleDeleteInstance}
                      onKillInstance={handleKillInstance}
                    />
                  </Suspense>
                )}
                {activeTab === "browse" && (
                  <Suspense fallback={<Loader />}>
                    <BrowseTab
                      selectedInstance={selectedInstance}
                      instances={instances}
                      onSetSelectedInstance={setSelectedInstance}
                      onRefreshInstances={loadInstances}
                      onShowCreationToast={handleStartCreating}
                      activeSubTab={browseSubTab}
                      onSubTabChange={setBrowseSubTab}
                    />
                  </Suspense>
                )}
                {activeTab === "servers" && (
                  <Suspense fallback={<Loader />}>
                    <ServersTab runningInstances={runningInstances} />
                  </Suspense>
                )}
                {activeTab === "skins" && (
                  <Suspense fallback={<Loader />}>
                    <SkinsTab activeAccount={activeAccount} isAuthenticated={isAuthenticated} />
                  </Suspense>
                )}
                {activeTab === "screenshots" && (
                  <Suspense fallback={<Loader />}>
                    <ScreenshotsTab />
                  </Suspense>
                )}
                {activeTab === "console" && (
                  <Suspense fallback={<Loader />}>
                    <ConsoleTab
                      consoleLogs={consoleLogs}
                      onClearConsole={handleClearConsole}
                    />
                  </Suspense>
                )}
              </>
            )}
          </main>

          {creatingInstanceName && (
            <div className="absolute bottom-0 left-0 right-0 z-20">
              <CreationProgressToast
                instanceName={creatingInstanceName}
                onError={handleCreationError}
                onDismiss={() => setCreatingInstanceName(null)}
              />
            </div>
          )}
        </div>

        <FriendsPanel
          isOpen={showFriendsPanel}
          isAuthenticated={isAuthenticated}
          activeAccountUuid={activeAccount?.uuid}
        />
      </div>

      <div className="flex flex-shrink-0 px-4 pb-4">
        <div className="w-14 flex-shrink-0" />
        <div className="flex-1 h-0" />
      </div>

      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          confirmText={confirmModal.type === "danger" ? "Delete" : "Confirm"}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {alertModal && (
        <AlertModal
          isOpen={alertModal.isOpen}
          title={alertModal.title}
          message={alertModal.message}
          type={alertModal.type}
          onClose={() => setAlertModal(null)}
        />
      )}

      <SettingsModal
        isOpen={showSettingsModal}
        settings={settings}
        launcherDirectory={launcherDirectory}
        onClose={() => setShowSettingsModal(false)}
        onSettingsChange={setSettings}
        onBackgroundChanged={loadBackground}
      />

      {showCreateModal && (
        <CreateInstanceModal
          versions={versions}
          instances={instances}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreationComplete}
          onStartCreating={handleStartCreating}
        />
      )}
    </div>
  )
}

export default App