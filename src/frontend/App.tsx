import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { LogOut, Settings, LogIn, Home, Package, Search, Terminal, Minus, Square, X, FileText, Server } from "lucide-react"
import { HomeTab } from "./tabs/HomeTab"
import { InstancesTab } from "./tabs/InstancesTab"
import { ModsTab } from "./tabs/ModsTab"
import { ConsoleTab } from "./tabs/ConsoleTab"
import { SettingsTab } from "./tabs/SettingsTab"
import { TemplatesTab } from "./tabs/TemplatesTab"
import { ServersTab } from "./tabs/ServersTab"
import { CreateInstanceModal } from "./modals/CreateInstanceModal"
import { CreateTemplateModal } from "./modals/CreateTemplateModal"
import { CreationProgressToast } from "./modals/CreationProgressToast"
import { InstanceDetailsTab } from "./modals/InstanceDetailsTab"
import { ConfirmModal, AlertModal } from "./modals/ConfirmModal"
import type { AuthData, Instance, LauncherSettings, ConsoleLog } from "../types"

function App() {
  const [isReady, setIsReady] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authData, setAuthData] = useState<AuthData | null>(null)
  const [isLaunching, setIsLaunching] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false)
  const [versions, setVersions] = useState<string[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null)
  const [launcherDirectory, setLauncherDirectory] = useState("")
  const [settings, setSettings] = useState<LauncherSettings | null>(null)
  const [activeTab, setActiveTab] = useState<"home" | "instances" | "browse" | "console" | "settings" | "templates" | "servers">("home")
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([])
  const [showInstanceDetails, setShowInstanceDetails] = useState(false)
  const [creatingInstanceName, setCreatingInstanceName] = useState<string | null>(null)
  const [templatesKey, setTemplatesKey] = useState(0)
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

  const appWindow = getCurrentWindow()

  // Initialize app and handle splashscreen
  useEffect(() => {
    const initializeApp = async () => {
      setIsReady(true)
      await new Promise(resolve => setTimeout(resolve, 100))
      await invoke('frontend_ready')
    }
    initializeApp()
  }, [])

  useEffect(() => {
    if (!isReady) return
    loadVersions()
    loadInstances()
    loadLauncherDirectory()
    loadSettings()
    const unlisten = listen<ConsoleLog>("console-log", (event) => {
      setConsoleLogs((prev) => [...prev, event.payload])
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [isReady])

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
        if (updated) {
          setSelectedInstance(updated)
        } else {
          setSelectedInstance(instanceList[0] || null)
        }
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

  const handleLogin = async () => {
    setIsLoggingIn(true)
    try {
      const response = await invoke<AuthData>("microsoft_login")
      setAuthData(response)
      setIsAuthenticated(true)
    } catch (error) {
      console.error("Login error:", error)
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setAuthData(null)
  }

  const handleLaunch = async () => {
    if (!authData || !selectedInstance) return
    setIsLaunching(true)
    setConsoleLogs([])
    setActiveTab("console")
    try {
      await invoke<string>("launch_instance", {
        instanceName: selectedInstance.name,
        username: authData.username,
        uuid: authData.uuid,
        accessToken: authData.access_token,
      })
      await loadInstances()
      setTimeout(() => {
        setIsLaunching(false)
      }, 2000)
    } catch (error) {
      console.error("Launch error:", error)
      setIsLaunching(false)
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
    // Generate a new name for the duplicate
    let baseName = instance.name
    let counter = 1
    let newName = `${baseName} (Copy)`
    
    // Keep incrementing until we find a unique name
    while (instances.some(i => i.name === newName)) {
      counter++
      newName = `${baseName} (Copy ${counter})`
    }
    
    // Start showing the creation toast immediately
    setCreatingInstanceName(newName)
    
    try {
      await invoke("duplicate_instance", {
        instanceName: instance.name,
        newName: newName,
        appHandle: appWindow,
      })
      
      await loadInstances()
      
      // Toast will auto-dismiss via progress events
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

  const handleOpenInstanceFolder = async () => {
    if (!selectedInstance) return
    try {
      await invoke("open_instance_folder", { instanceName: selectedInstance.name })
    } catch (error) {
      console.error("Failed to open folder:", error)
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
  }

  const handleCreationComplete = () => {
    setCreatingInstanceName(null)
    loadInstances()
  }

  const handleCreationError = () => {
    setCreatingInstanceName(null)
  }

  const handleApplyTemplate = async (templateId: string, instanceName: string) => {
    try {
      const template = await invoke<any>("get_template", { templateId })
      let confirmMessage = `Apply template "${template.name}" to "${instanceName}"?\n\nThis will:`
      const changes = []
      if (template.launcher_settings) {
        changes.push(`- Update launcher settings (${template.launcher_settings.memory_mb}MB RAM)`)
      }
      if (template.minecraft_options) {
        changes.push(`Apply game options (FOV, graphics, keybinds, etc.)`)
      }
      if (changes.length === 0) {
        setAlertModal({
          isOpen: true,
          title: "No Settings",
          message: "This template has no settings to apply",
          type: "info"
        })
        return
      }
      confirmMessage += "\n" + changes.join("\n")
      setConfirmModal({
        isOpen: true,
        title: "Apply Template",
        message: confirmMessage,
        type: "warning",
        onConfirm: async () => {
          try {
            await invoke("apply_template_to_instance", {
              templateId,
              instanceName: instanceName,
            })
            let successMessage = "Template applied successfully!\n\n"
            if (template.launcher_settings) {
              successMessage += "✓ Launcher settings updated\n"
            }
            if (template.minecraft_options) {
              successMessage += "✓ Game options applied\n"
            }
            setConfirmModal(null)
            setAlertModal({
              isOpen: true,
              title: "Success",
              message: successMessage,
              type: "success"
            })
            await loadInstances()
          } catch (error) {
            console.error("Failed to apply template:", error)
            setConfirmModal(null)
            setAlertModal({
              isOpen: true,
              title: "Error",
              message: `Failed to apply template: ${error}`,
              type: "danger"
            })
          }
        }
      })
    } catch (error) {
      console.error("Failed to load template:", error)
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: `Failed to load template: ${error}`,
        type: "danger"
      })
    }
  }

  return (
    <div className={`flex flex-col h-screen bg-[#0d0d0d] text-[#e8e8e8] overflow-hidden font-sans ${!isReady ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}`}>
      {/* Custom Title Bar */}
      <div 
        data-tauri-drag-region
        style={{ userSelect: 'none', WebkitAppRegion: 'drag' } as any}
        className="h-10 bg-[#1a1a1a] flex-shrink-0 fixed top-0 left-0 right-0 z-50 flex items-center px-4 border-b border-[#2a2a2a]"
      >
        <div className="flex items-center gap-2 mr-24">
          <img src="/logo.png" alt="Atomic Launcher" className="h-5 w-5" />
          <span className="text-sm font-semibold text-[#e8e8e8]">Atomic Launcher</span>
        </div>
        <div className="flex items-center gap-2 text-sm flex-1">
          <button
            onClick={() => {
              setActiveTab("home")
              setShowInstanceDetails(false)
            }}
            className={`transition-colors cursor-pointer ${activeTab === "home" && !showInstanceDetails ? "text-[#e8e8e8] font-semibold" : "text-[#808080] hover:text-[#e8e8e8]"}`}
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            Home
          </button>
          {activeTab !== "home" && (
            <>
              <span className="text-[#4a4a4a]">›</span>
              <button
                onClick={() => setShowInstanceDetails(false)}
                className={`transition-colors capitalize cursor-pointer ${!showInstanceDetails ? "text-[#e8e8e8] font-semibold" : "text-[#808080] hover:text-[#e8e8e8]"}`}
                style={{ WebkitAppRegion: 'no-drag' } as any}
              >
                {activeTab === "browse" ? "Mods" : activeTab}
              </button>
            </>
          )}
          {showInstanceDetails && selectedInstance && (
            <>
              <span className="text-[#4a4a4a]">›</span>
              <span className="text-[#e8e8e8] font-semibold">{selectedInstance.name}</span>
            </>
          )}
        </div>

        {/* Window Controls */}
        <div className="flex items-center ml-auto" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={() => appWindow.minimize()}
            className="h-10 w-12 flex items-center justify-center text-[#808080] hover:text-[#e8e8e8] hover:bg-[#2a2a2a] transition-colors"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={() => appWindow.toggleMaximize()}
            className="h-10 w-12 flex items-center justify-center text-[#808080] hover:text-[#e8e8e8] hover:bg-[#2a2a2a] transition-colors"
          >
            <Square size={14} />
          </button>
          <button
            onClick={() => appWindow.close()}
            className="h-10 w-12 flex items-center justify-center text-[#808080] hover:text-[#e8e8e8] hover:bg-red-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Creation Progress Toast */}
      {creatingInstanceName && (
        <CreationProgressToast
          instanceName={creatingInstanceName}
          onComplete={handleCreationComplete}
          onError={handleCreationError}
          onDismiss={() => setCreatingInstanceName(null)}
        />
      )}

      {/* Confirmation Modal */}
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

      {/* Main Content Container */}
      <div className="flex flex-1 overflow-hidden mt-10">
        {/* Sidebar */}
        <aside className="sidebar-bg w-58 bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col">
          <div className="flex-1 flex flex-col">
            {/* Navigation */}
            <nav className="flex-1 px-2 py-3 space-y-1">
              <button
                onClick={() => {
                  setActiveTab("home")
                  setShowInstanceDetails(false)
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-[15px] font-medium transition-all cursor-pointer ${
                  activeTab === "home"
                    ? "bg-[#2a2a2a] text-[#e8e8e8] shadow-sm"
                    : "text-[#808080] hover:text-[#e8e8e8] hover:bg-[#1f1f1f]"
                }`}
              >
                <Home size={19} strokeWidth={2} />
                <span>Home</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("instances")
                  setShowInstanceDetails(false)
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-[15px] font-medium transition-all cursor-pointer ${
                  activeTab === "instances"
                    ? "bg-[#2a2a2a] text-[#e8e8e8] shadow-sm"
                    : "text-[#808080] hover:text-[#e8e8e8] hover:bg-[#1f1f1f]"
                }`}
              >
                <Package size={19} strokeWidth={2} />
                <span>Instances</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("browse")
                  setShowInstanceDetails(false)
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-[15px] font-medium transition-all cursor-pointer ${
                  activeTab === "browse"
                    ? "bg-[#2a2a2a] text-[#e8e8e8] shadow-sm"
                    : "text-[#808080] hover:text-[#e8e8e8] hover:bg-[#1f1f1f]"
                }`}
              >
                <Search size={19} strokeWidth={2} />
                <span>Mods</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("servers")
                  setShowInstanceDetails(false)
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-[15px] font-medium transition-all cursor-pointer ${
                  activeTab === "servers"
                    ? "bg-[#2a2a2a] text-[#e8e8e8] shadow-sm"
                    : "text-[#808080] hover:text-[#e8e8e8] hover:bg-[#1f1f1f]"
                }`}
              >
                <Server size={19} strokeWidth={2} />
                <span>Servers</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("templates")
                  setShowInstanceDetails(false)
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-[15px] font-medium transition-all cursor-pointer ${
                  activeTab === "templates"
                    ? "bg-[#2a2a2a] text-[#e8e8e8] shadow-sm"
                    : "text-[#808080] hover:text-[#e8e8e8] hover:bg-[#1f1f1f]"
                }`}
              >
                <FileText size={19} strokeWidth={2} />
                <span>Templates</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("console")
                  setShowInstanceDetails(false)
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-[15px] font-medium transition-all cursor-pointer ${
                  activeTab === "console"
                    ? "bg-[#2a2a2a] text-[#e8e8e8] shadow-sm"
                    : "text-[#808080] hover:text-[#e8e8e8] hover:bg-[#1f1f1f]"
                }`}
              >
                <Terminal size={19} strokeWidth={2} />
                <span>Console</span>
              </button>
            </nav>
          </div>

          {/* Bottom Section */}
          <div className="p-2 space-y-1">
            {isAuthenticated && authData ? (
              <>
                <div className="py-1 mb-0">
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[#0d0d0d]/50 border border-[#2a2a2a]">
                    <div className="relative">
                      <img
                        src={`https://cravatar.eu/avatar/${authData.username}/32`}
                        alt={authData.username}
                        className="w-8 h-8 rounded-md"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-[#808080]">Welcome back,</div>
                      <div className="text-base font-medium text-[#e8e8e8] truncate">{authData.username}</div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-base font-medium text-[#808080] hover:text-[#e8e8e8] hover:bg-[#1f1f1f] transition-all cursor-pointer"
                >
                  <LogOut size={18} strokeWidth={2} />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white text-base py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed mb-2"
              >
                <LogIn size={18} />
                <span>{isLoggingIn ? 'Authenticating...' : 'Sign In'}</span>
              </button>
            )}
            
            <button
              onClick={() => {
                setActiveTab("settings")
                setShowInstanceDetails(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-base font-medium transition-all cursor-pointer mb-1 ${
                activeTab === "settings"
                  ? "bg-[#2a2a2a] text-[#e8e8e8] shadow-sm"
                  : "text-[#808080] hover:text-[#e8e8e8] hover:bg-[#1f1f1f]"
              }`}
            >
              <Settings size={18} strokeWidth={2} />
              <span>Settings</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-[#0d0d0d]">
          {showInstanceDetails && selectedInstance ? (
            <InstanceDetailsTab
              instance={selectedInstance}
              isAuthenticated={isAuthenticated}
              isLaunching={isLaunching}
              onLaunch={handleLaunch}
              onBack={handleCloseDetails}
              onInstanceUpdated={loadInstances}
            />
          ) : (
            <>
              {activeTab === "home" && (
                <HomeTab
                  selectedInstance={selectedInstance}
                  instances={instances}
                  isAuthenticated={isAuthenticated}
                  isLaunching={isLaunching}
                  onSetSelectedInstance={setSelectedInstance}
                  onLaunch={handleLaunch}
                  onOpenFolder={handleOpenInstanceFolder}
                  onDeleteInstance={handleDeleteInstance}
                  onCreateNew={() => setShowCreateModal(true)}
                  onShowDetails={handleShowDetails}
                  onOpenFolderByInstance={handleOpenInstanceFolderByInstance}
                  onDuplicateInstance={handleDuplicateInstance}
                />
              )}

              {activeTab === "instances" && (
                <InstancesTab
                  instances={instances}
                  selectedInstance={selectedInstance}
                  isAuthenticated={isAuthenticated}
                  onSetSelectedInstance={setSelectedInstance}
                  onLaunch={handleLaunch}
                  onCreateNew={() => setShowCreateModal(true)}
                  onShowDetails={handleShowDetails}
                  onOpenFolder={handleOpenInstanceFolderByInstance}
                  onDuplicateInstance={handleDuplicateInstance}
                  onDeleteInstance={handleDeleteInstance}
                />
              )}

              {activeTab === "browse" && (
                <ModsTab
                  selectedInstance={selectedInstance}
                  instances={instances}
                  onSetSelectedInstance={setSelectedInstance}
                />
              )}

              {activeTab === "servers" && (
                <ServersTab />
              )}

              {activeTab === "templates" && (
                <TemplatesTab 
                  key={templatesKey} 
                  instances={instances} 
                  onApplyTemplate={handleApplyTemplate}
                  onCreateNew={() => setShowCreateTemplateModal(true)}
                />
              )}

              {activeTab === "console" && (
                <ConsoleTab
                  consoleLogs={consoleLogs}
                  onClearConsole={() => setConsoleLogs([])}
                />
              )}

              {activeTab === "settings" && (
                <SettingsTab
                  settings={settings}
                  launcherDirectory={launcherDirectory}
                  onSettingsChange={setSettings}
                />
              )}
            </>
          )}
        </main>
      </div>

      {showCreateModal && (
        <CreateInstanceModal
          versions={versions}
          instances={instances}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreationComplete}
          onStartCreating={handleStartCreating}
        />
      )}

      {showCreateTemplateModal && (
        <CreateTemplateModal
          instances={instances}
          onClose={() => setShowCreateTemplateModal(false)}
          onSuccess={() => {
            setShowCreateTemplateModal(false)
            setTemplatesKey(prev => prev + 1)
          }}
        />
      )}
    </div>
  )
}

export default App