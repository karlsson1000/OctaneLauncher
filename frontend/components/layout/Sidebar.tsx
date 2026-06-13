import { Home, Package, Puzzle, Server, HatGlasses, Camera, Terminal, Settings, Download, Plus, FolderOpen, Copy, Trash2 } from "lucide-react"
import { ContextMenu } from "../ui/ContextMenu"
import { Tooltip } from "../ui/Tooltip"
import type { Instance, UpdateInfo } from "../../types"

interface SidebarProps {
  setActiveTab: (tab: "home" | "instances" | "browse" | "console" | "servers" | "skins" | "screenshots") => void
  setShowInstanceDetails: (show: boolean) => void
  activeTab: "home" | "instances" | "browse" | "console" | "servers" | "skins" | "screenshots"
  instances: Instance[]
  instanceIcons: Record<string, string | null>
  runningInstances: Set<string>
  launchingInstanceName: string | null
  isAuthenticated: boolean
  sidebarContextMenu: { x: number; y: number; instance: Instance } | null
  setSidebarContextMenu: (menu: { x: number; y: number; instance: Instance } | null) => void
  setSelectedInstance: (instance: Instance) => void
  onOpenInstanceFolder: (instance: Instance) => void
  onDuplicateInstance: (instance: Instance) => void
  onDeleteInstance: (instanceName: string) => void
  updateInfo: UpdateInfo | null
  isInstallingUpdate: boolean
  onInstallUpdate: () => void
  onOpenSettings: () => void
  onCreateNew: () => void
}

const tabs = [
  { id: "home" as const, icon: Home },
  { id: "instances" as const, icon: Package },
  { id: "browse" as const, icon: Puzzle },
  { id: "servers" as const, icon: Server },
  { id: "skins" as const, icon: HatGlasses },
  { id: "screenshots" as const, icon: Camera },
  { id: "console" as const, icon: Terminal },
]

export function Sidebar(props: SidebarProps) {
  const {
    setActiveTab,
    setShowInstanceDetails,
    activeTab,
    sidebarContextMenu,
    setSidebarContextMenu,
    setSelectedInstance,
    onOpenInstanceFolder,
    onDuplicateInstance,
    onDeleteInstance,
    updateInfo,
    isInstallingUpdate,
    onInstallUpdate,
    onOpenSettings,
    onCreateNew,
  } = props

  return (
    <>
      <div className="w-12 flex-shrink-0 flex flex-col items-center gap-1 relative z-10">
        {/* Nav tabs */}
        <div className="flex flex-col items-center gap-2.5 flex-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const label = tab.id.charAt(0).toUpperCase() + tab.id.slice(1)
            return (
              <Tooltip key={tab.id} text={label}>
                <button
                  onClick={() => { setActiveTab(tab.id); setShowInstanceDetails(false) }}
                  className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? "bg-[var(--bg-active)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-active)]"
                  }`}
                >
                  <Icon size={26} strokeWidth={isActive ? 2.5 : 2} />
                </button>
              </Tooltip>
            )
          })}
        </div>

        {/* Bottom controls */}
        <div className="flex flex-col items-center gap-2">
          {updateInfo && (
            <Tooltip text={isInstallingUpdate ? "Installing update..." : `Update available: ${updateInfo.new_version}`}>
              <button
                onClick={onInstallUpdate}
                disabled={isInstallingUpdate}
                className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                  isInstallingUpdate
                    ? "text-[#16a34a] animate-pulse"
                    : "text-[#16a34a] hover:bg-[var(--bg-active)]"
                }`}
              >
                <Download size={26} strokeWidth={2} />
              </button>
            </Tooltip>
          )}

          <Tooltip text="New instance">
            <button
              onClick={onCreateNew}
              className="w-12 h-12 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-active)] transition-all cursor-pointer"
            >
              <Plus size={26} strokeWidth={2} />
            </button>
          </Tooltip>

          <Tooltip text="Settings">
            <button
              onClick={onOpenSettings}
              className="w-12 h-12 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-active)] transition-all cursor-pointer"
            >
              <Settings size={26} strokeWidth={2} />
            </button>
          </Tooltip>
        </div>
      </div>

      {sidebarContextMenu && (
        <ContextMenu
          x={sidebarContextMenu.x}
          y={sidebarContextMenu.y}
          onClose={() => setSidebarContextMenu(null)}
          items={[
            {
              label: "Open",
              icon: <Package size={16} />,
              onClick: () => {
                setSelectedInstance(sidebarContextMenu.instance)
                setActiveTab("instances")
                setShowInstanceDetails(true)
              },
            },
            {
              label: "Open Folder",
              icon: <FolderOpen size={16} />,
              onClick: () => onOpenInstanceFolder(sidebarContextMenu.instance),
            },
            {
              label: "Duplicate",
              icon: <Copy size={16} />,
              onClick: () => onDuplicateInstance(sidebarContextMenu.instance),
            },
            { separator: true },
            {
              label: "Delete",
              icon: <Trash2 size={16} />,
              onClick: () => onDeleteInstance(sidebarContextMenu.instance.name),
              danger: true,
            },
          ]}
        />
      )}
    </>
  )
}