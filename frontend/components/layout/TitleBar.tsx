import { useEffect, memo } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Minus, Square, X, ChevronLeft, ChevronRight, ChevronDown, LogIn, LogOut, Check, Users } from "lucide-react"
import type { AccountInfo, Instance } from "../../types"
import type { CSSProperties } from "react"

interface TitleBarProps {
  activeTab: "home" | "instances" | "browse" | "console" | "servers" | "skins" | "screenshots"
  showInstanceDetails: boolean
  selectedInstance: Instance | null
  browseSubTab: "mods" | "modpacks" | "resourcepacks" | "shaderpacks"
  navigateBack: () => void
  navigateForward: () => void
  historyIndex: number
  navigationHistoryLength: number
  isAuthenticated: boolean
  activeAccount: AccountInfo | null
  accounts: AccountInfo[]
  showAccountDropdown: boolean
  setShowAccountDropdown: (show: boolean) => void
  loadAccounts: () => Promise<void>
  appWindow: { minimize: () => void; toggleMaximize: () => void; close: () => void }
  showFriendsPanel: boolean
  setShowFriendsPanel: (show: boolean) => void
  dragRegion: CSSProperties
  noDragRegion: CSSProperties
}

const tabLabels: Record<string, string> = {
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

export const TitleBar = memo(function TitleBar({
  activeTab,
  showInstanceDetails,
  selectedInstance,
  browseSubTab,
  navigateBack,
  navigateForward,
  historyIndex,
  navigationHistoryLength,
  isAuthenticated,
  activeAccount,
  accounts,
  showAccountDropdown,
  setShowAccountDropdown,
  loadAccounts,
  appWindow,
  showFriendsPanel,
  setShowFriendsPanel,
  dragRegion,
  noDragRegion,
}: TitleBarProps) {

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

  return (
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
          disabled={historyIndex >= navigationHistoryLength - 1}
          className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
            historyIndex < navigationHistoryLength - 1 ? "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] cursor-pointer" : "text-[var(--text-disabled)] cursor-not-allowed"
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
  )
})
