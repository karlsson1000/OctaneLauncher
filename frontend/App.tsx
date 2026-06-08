import { useState, useEffect, lazy, Suspense } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { Minus, Square, X, ChevronLeft, ChevronRight, Home, Package, Puzzle, Server, HatGlasses, Terminal, Settings, Camera, Download, Loader2 } from "lucide-react"
import { SettingsModal } from "./features/settings/SettingsModal"
import { CreateInstanceModal } from "./features/instances/CreateInstanceModal"
import { CreationProgressToast } from "./features/instances/CreationProgressToast"
import { UpdateDropdown } from "./features/instances/UpdateDropdown"
import { InstanceDetailsTab } from "./features/instances/InstanceDetailsTab"
import { ConfirmModal, AlertModal } from "./components/ui/ConfirmModal"
import { Sidebar } from "./components/layout/Sidebar"
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
  const [instanceIcons, setInstanceIcons] = useState<Record<string, string | null>>({})
  const [navigationHistory, setNavigationHistory] = useState<Array<{tab: typeof activeTab, showDetails: boolean, instance: Instance | null}>>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isNavigating, setIsNavigating] = useState(false)
  const [sidebarBackground, setSidebarBackground] = useState<string | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [sidebarContextMenu, setSidebarContextMenu] = useState<{
    x: number
    y: number
    instance: Instance
  } | null>(null)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [showUpdateDropdown, setShowUpdateDropdown] = useState(false)
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false)

  const appWindow = getCurrentWindow()

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

  const navigateBack = () => {
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
  }

  const navigateForward = () => {
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
  }

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

  const handleInstallUpdate = async () => {
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
      setShowUpdateDropdown(false)
    }
  }

  const tabs = [
    { id: "home" as const, icon: Home, label: "Home" },
    { id: "instances" as const, icon: Package, label: "Instances" },
    { id: "browse" as const, icon: Puzzle, label: "Addons" },
    { id: "servers" as const, icon: Server, label: "Servers" },
    { id: "skins" as const, icon: HatGlasses, label: "Skins" },
    { id: "screenshots" as const, icon: Camera, label: "Screenshots" },
    { id: "console" as const, icon: Terminal, label: "Console" },
  ]

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
    loadSidebarBackground()
    
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
      if (settings?.auto_navigate_to_console !== false) setActiveTab("console")
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showUpdateDropdown) {
        const target = e.target as HTMLElement
        if (!target.closest('[data-update-dropdown]') && !target.closest('[data-update-button]')) {
          setShowUpdateDropdown(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUpdateDropdown])

  const loadVersions = async () => {
    try {
      const versionList = await invoke<string[]>("get_minecraft_versions")
      setVersions(versionList)
    } catch (error) {
      console.error("Failed to load versions:", error)
    }
  }

  const loadInstances = async () => {
    try {
      const instanceList = await invoke<Instance[]>("get_instances")
      setInstances(instanceList)
      if (selectedInstance) {
        const updated = instanceList.find(i => i.name === selectedInstance.name)
        if (updated) setSelectedInstance(updated)
        else setSelectedInstance(instanceList[0] || null)
      } else if (instanceList.length > 0 && !selectedInstance) {
        setSelectedInstance(instanceList[0])
      }
    } catch (error) {
      console.error("Failed to load instances:", error)
    }
  }

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

  const loadSidebarBackground = async () => {
    try {
      const bg = await invoke<string | null>("get_sidebar_background")
      setSidebarBackground(bg)
    } catch (error) {
      console.error("Failed to load sidebar background:", error)
    }
  }

  const loadAccounts = async () => {
    try {
      const accountList = await invoke<AccountInfo[]>("get_accounts")
      setAccounts(accountList)
      const active = accountList.find(acc => acc.is_active)
      setActiveAccount(active || null)
      setIsAuthenticated(!!active)
    } catch (error) {
      console.error("Failed to load accounts:", error)
    }
  }

  const handleLaunch = async (instance: Instance) => {
    if (!activeAccount) return
    setLaunchingInstanceName(instance.name)
    setConsoleLogs([])
    if (settings?.auto_navigate_to_console !== false) setActiveTab("console")
    setShowInstanceDetails(false)
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
  }

  const handleDeleteInstance = async (instanceName: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Instance",
      message: `Are you sure you want to delete "${instanceName}"?\n\nThis action cannot be undone.`,
      type: "danger",
      onConfirm: async () => {
        try {
          await invoke<string>("delete_instance", { instanceName })
          await loadInstances()
          if (selectedInstance?.name === instanceName) {
            setSelectedInstance(instances.length > 1 ? instances.find(i => i.name !== instanceName) || null : null)
          }
          setConfirmModal(null)
        } catch (error) {
          console.error("Delete error:", error)
          setConfirmModal(null)
        }
      }
    })
  }

  const handleDuplicateInstance = async (instance: Instance) => {
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
  }

  const handleOpenInstanceFolderByInstance = async (instance: Instance) => {
    try {
      await invoke("open_instance_folder", { instanceName: instance.name })
    } catch (error) {
      console.error("Failed to open folder:", error)
    }
  }

  const handleShowDetails = (instance: Instance) => {
    setSelectedInstance(instance)
    setShowInstanceDetails(true)
  }

  const handleCloseDetails = () => {
    setShowInstanceDetails(false)
  }

  const handleStartCreating = (instanceName: string) => {
    setCreatingInstanceName(instanceName)
    setActiveTab('instances')
  }

  const handleCreationComplete = () => {
    setCreatingInstanceName(null)
    loadInstances()
  }

  const handleCreationError = () => {
    setCreatingInstanceName(null)
  }

  const handleQuickLaunch = async (instance: Instance) => {
    if (!activeAccount) return
    setLaunchingInstanceName(instance.name)
    setConsoleLogs([])
    if (settings?.auto_navigate_to_console !== false) setActiveTab("console")
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
  }

  const handleKillInstance = async (instance: Instance) => {
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
  }

  return (
    <div className="flex flex-col h-screen bg-[#181a1f] text-[#e6e6e6] overflow-hidden font-sans">
      <div
        data-tauri-drag-region
        style={{ userSelect: 'none', ...dragRegion } as CSSProperties}
        className="h-10 bg-[#22252b] flex-shrink-0 fixed top-0 left-0 right-0 z-50 flex items-center"
      >
        <div className="flex items-center gap-2 ml-4 mr-4">
          <img src="/logo.png" alt="Octane Launcher" className="h-5 w-5" />
          <span className="text-sm font-semibold text-[#e6e6e6]">Octane Launcher</span>
        </div>

        <div className="flex items-center gap-1 mr-4" style={noDragRegion}>
          <button
            onClick={navigateBack}
            disabled={historyIndex <= 0}
            className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${
              historyIndex > 0 ? "text-[#e6e6e6] hover:bg-[#3a3f4b] cursor-pointer" : "text-[#3a3f4b] cursor-not-allowed"
            }`}
          >
            <ChevronLeft size={16} strokeWidth={4} />
          </button>
          <button
            onClick={navigateForward}
            disabled={historyIndex >= navigationHistory.length - 1}
            className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${
              historyIndex < navigationHistory.length - 1 ? "text-[#e6e6e6] hover:bg-[#3a3f4b] cursor-pointer" : "text-[#3a3f4b] cursor-not-allowed"
            }`}
          >
            <ChevronRight size={16} strokeWidth={4} />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center" style={dragRegion}>
          <nav className="flex items-center gap-1" style={noDragRegion}>
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setShowInstanceDetails(false) }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-all cursor-pointer ${
                    activeTab === tab.id ? "bg-[#181a1f] text-[#e6e6e6]" : "text-[#7d8590] hover:text-[#e6e6e6] hover:bg-[#3a3f4b]"
                  }`}
                >
                  <Icon size={16} strokeWidth={1.5} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center ml-auto relative" style={noDragRegion}>
          {updateInfo && (
            <div className="relative">
              <button
                data-update-button
                onClick={() => setShowUpdateDropdown(!showUpdateDropdown)}
                className="flex items-center justify-center px-3 py-1.5 rounded text-[#16a34a] hover:text-[#15803d] hover:bg-[#3a3f4b] transition-all cursor-pointer"
                title={`Update available: ${updateInfo.new_version}`}
              >
                <Download size={16} strokeWidth={1.5} />
              </button>

              {showUpdateDropdown && (
                <UpdateDropdown
                  newVersion={updateInfo.new_version}
                  isInstalling={isInstallingUpdate}
                  onInstall={handleInstallUpdate}
                />
              )}
            </div>
          )}

          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center justify-center px-3 py-1.5 rounded text-[#7d8590] hover:text-[#e6e6e6] hover:bg-[#3a3f4b] transition-all cursor-pointer"
            title="Settings"
          >
            <Settings size={16} strokeWidth={1.5} />
          </button>
          <div className="w-px h-6 bg-[#3a3f4b] mx-2" style={{ pointerEvents: 'none' } as CSSProperties} />
          <button onClick={() => appWindow.minimize()} className="h-10 w-12 flex items-center justify-center text-[#7d8590] hover:text-[#e6e6e6] hover:bg-[#3a3f4b] transition-colors">
            <Minus size={16} strokeWidth={1.5} />
          </button>
          <button onClick={() => appWindow.toggleMaximize()} className="h-10 w-12 flex items-center justify-center text-[#7d8590] hover:text-[#e6e6e6] hover:bg-[#3a3f4b] transition-colors">
            <Square size={14} strokeWidth={1.5} />
          </button>
          <button onClick={() => appWindow.close()} className="h-10 w-12 flex items-center justify-center text-[#7d8590] hover:text-[#e6e6e6] hover:bg-red-500 transition-colors">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {creatingInstanceName && (
        <CreationProgressToast
          instanceName={creatingInstanceName}
          onError={handleCreationError}
          onDismiss={() => setCreatingInstanceName(null)}
        />
      )}

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

      <div className="flex flex-1 overflow-hidden mt-10">
        <Sidebar
          setActiveTab={setActiveTab}
          setShowInstanceDetails={setShowInstanceDetails}
          instances={instances}
          instanceIcons={instanceIcons}
          runningInstances={runningInstances}
          launchingInstanceName={launchingInstanceName}
          isAuthenticated={isAuthenticated}
          activeAccount={activeAccount}
          accounts={accounts}
          sidebarBackground={sidebarBackground}
          sidebarContextMenu={sidebarContextMenu}
          setSidebarContextMenu={setSidebarContextMenu}
          setSelectedInstance={setSelectedInstance}
          setShowSettingsModal={setShowSettingsModal}
          onQuickLaunch={handleQuickLaunch}
          onKillInstance={handleKillInstance}
          onOpenInstanceFolder={handleOpenInstanceFolderByInstance}
          onDuplicateInstance={handleDuplicateInstance}
          onDeleteInstance={handleDeleteInstance}
          loadAccounts={loadAccounts}
        />

        <main className="flex-1 overflow-y-auto bg-[#181a1f]">
          {showInstanceDetails && selectedInstance ? (
            <InstanceDetailsTab
              instance={selectedInstance}
              isAuthenticated={isAuthenticated}
              isLaunching={launchingInstanceName === selectedInstance.name}
              isRunning={runningInstances.has(selectedInstance.name)}
              onLaunch={() => handleLaunch(selectedInstance)}
              onBack={handleCloseDetails}
              onInstanceUpdated={loadInstances}
            />
          ) : (
            <>
              {activeTab === "home" && (
                <Suspense fallback={<Loader />}>
                <HomeTab
                  instances={instances}
                  isAuthenticated={isAuthenticated}
                  launchingInstanceName={launchingInstanceName}
                  runningInstances={runningInstances}
                  onLaunch={handleLaunch}
                  onDeleteInstance={handleDeleteInstance}
                  onCreateNew={() => setShowCreateModal(true)}
                  onShowDetails={handleShowDetails}
                  onOpenFolderByInstance={handleOpenInstanceFolderByInstance}
                  onDuplicateInstance={handleDuplicateInstance}
                  onKillInstance={handleKillInstance}
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
                  onLaunch={(instance: Instance) => { handleLaunch(instance) }}
                  onCreateNew={() => setShowCreateModal(true)}
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
                />
                </Suspense>
              )}

              {activeTab === "servers" && (
                <Suspense fallback={<Loader />}>
                <ServersTab
                  runningInstances={runningInstances}
                />
                </Suspense>
              )}

              {activeTab === "skins" && (
                <Suspense fallback={<Loader />}>
                <SkinsTab
                  activeAccount={activeAccount}
                  isAuthenticated={isAuthenticated}
                />
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
                  onClearConsole={(instanceName: string) => {
                    setConsoleLogs(prev => prev.filter(log => log.instance !== instanceName))
                  }}
                />
                </Suspense>
              )}
            </>
          )}
        </main>
      </div>

      <SettingsModal
        isOpen={showSettingsModal}
        settings={settings}
        launcherDirectory={launcherDirectory}
        onClose={() => setShowSettingsModal(false)}
        onSettingsChange={setSettings}
        onBackgroundChanged={loadSidebarBackground}
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