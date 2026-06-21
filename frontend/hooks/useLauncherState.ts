import { useState, useEffect, useRef, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import type { Instance, LauncherSettings, ConsoleLog, AccountInfo, UpdateInfo } from "../types"
import type { CSSProperties } from "react"
import { storeGet, storeSet } from "../lib/store"

export function useLauncherState() {
  const [isReady, setIsReady] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeAccount, setActiveAccount] = useState<AccountInfo | null>(null)
  const [accounts, setAccounts] = useState<AccountInfo[]>([])
  const [launchingInstanceName, setLaunchingInstanceName] = useState<string | null>(null)
  const [runningInstances, setRunningInstances] = useState<Set<string>>(new Set())
  const runningInstancesRef = useRef(runningInstances)
  runningInstancesRef.current = runningInstances
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
    checkboxLabel?: string
    checkboxChecked?: boolean
    onCheckboxChange?: (checked: boolean) => void
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
  useEffect(() => {
    storeGet<boolean>("friends_panel_open").then(v => { if (v) setShowFriendsPanel(true) })
  }, [])
  useEffect(() => {
    storeSet("friends_panel_open", showFriendsPanel)
  }, [showFriendsPanel])
  const [browseSubTab, setBrowseSubTab] = useState<"mods" | "modpacks" | "resourcepacks" | "shaderpacks">("mods")

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
          const dismissedVersion = await storeGet<string>("dismissed_update_version")
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

    const MAX_CONSOLE_LOGS = 10000
    const unlistenConsole = listen<ConsoleLog>("console-log", (event) => {
      setConsoleLogs((prev) => {
        const next = [...prev, event.payload]
        return next.length > MAX_CONSOLE_LOGS ? next.slice(-MAX_CONSOLE_LOGS) : next
      })
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
    if (!isAuthenticated || !activeAccount) return

    const sendHeartbeat = async () => {
      try {
        const instances = runningInstancesRef.current
        const firstInstance = instances.values().next().value
        if (firstInstance) {
          await invoke("update_user_status", { status: "ingame", currentInstance: firstInstance })
        } else {
          await invoke("update_user_status", { status: "online", currentInstance: null })
        }
      } catch {
      }
    }

    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, 60000)
    return () => clearInterval(interval)
  }, [isAuthenticated, activeAccount?.uuid])

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

  const skipTrashRef = useRef(false)

  const handleDeleteInstance = useCallback(async (instanceName: string) => {
    skipTrashRef.current = false
    setConfirmModal({
      isOpen: true,
      title: "Delete Instance",
      message: `Are you sure you want to delete "${instanceName}"?\n\nThis action cannot be undone.`,
      type: "danger",
      checkboxLabel: "Delete permanently",
      onCheckboxChange: (checked: boolean) => { skipTrashRef.current = checked },
      onConfirm: async () => {
        setConfirmModal(null)
        try {
          await invoke<string>("delete_instance", { instanceName, permanent: skipTrashRef.current })
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

  const handleWorldLaunch = useCallback(async (worldName: string) => {
    if (!selectedInstance || !activeAccount) return
    setLaunchingInstanceName(selectedInstance.name)
    setConsoleLogs([])
    if (settings?.auto_navigate_to_console !== false) {
      setActiveTab("console")
      setShowInstanceDetails(false)
    }
    try {
      await invoke("launch_world", { instanceName: selectedInstance.name, worldName })
      await loadInstances()
      setRunningInstances((prev) => new Set(prev).add(selectedInstance.name))
      setLaunchingInstanceName(null)
    } catch (error) {
      console.error("World launch error:", error)
      setLaunchingInstanceName(null)
    }
  }, [selectedInstance, activeAccount, settings, appWindow, loadInstances])

  return {
    isReady, isAuthenticated, activeAccount, accounts,
    launchingInstanceName, runningInstances,
    showCreateModal, setShowCreateModal,
    versions, instances, selectedInstance, setSelectedInstance,
    launcherDirectory, settings, setSettings,
    activeTab, setActiveTab,
    consoleLogs,
    showInstanceDetails, setShowInstanceDetails,
    creatingInstanceName, setCreatingInstanceName,
    confirmModal, setConfirmModal,
    alertModal, setAlertModal,
    navigationHistory, historyIndex,
    background,
    showSettingsModal, setShowSettingsModal,
    sidebarContextMenu, setSidebarContextMenu,
    updateInfo, isInstallingUpdate,
    showAccountDropdown, setShowAccountDropdown,
    showFriendsPanel, setShowFriendsPanel,
    browseSubTab, setBrowseSubTab,
    appWindow, dragRegion, noDragRegion,
    navigateBack, navigateForward,
    handleInstallUpdate,
    handleLaunch, handleDeleteInstance, handleDuplicateInstance,
    handleOpenInstanceFolderByInstance,
    handleShowDetails, handleCloseDetails,
    handleStartCreating, handleCreationComplete, handleCreationError,
    handleKillInstance, handleOpenSettings, handleCreateNew,
    handleClearConsole, handleNavigateToInstances, handleLaunchSelected,
    handleWorldLaunch,
    loadInstances, handleInstanceRenamed, loadAccounts, loadBackground,
  }
}
