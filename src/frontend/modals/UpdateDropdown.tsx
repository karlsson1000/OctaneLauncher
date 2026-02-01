import { Download, FileText } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"

interface UpdateDropdownProps {
  currentVersion: string
  newVersion: string
  isInstalling?: boolean
  onInstall: () => void
}

export function UpdateDropdown({
  newVersion,
  isInstalling = false,
  onInstall,
}: UpdateDropdownProps) {
  const handleChangelogClick = async () => {
    try {
      await invoke('open_url', { url: 'https://oct4ne.net/changelog' })
    } catch (error) {
      console.error('Failed to open changelog link:', error)
    }
  }

  return (
    <div 
      data-update-dropdown
      className="absolute top-full right-0 mt-2 w-[280px] animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="bg-[#22252b] rounded">
        <div className="p-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-[#e6e6e6]">
                  {isInstalling ? "Installing Update..." : "Update Available"}
                </p>
                <p className="text-xs text-[#7d8590] mt-0.5">
                  {isInstalling 
                    ? "The app will restart automatically" 
                    : `Version ${newVersion} is ready to install`
                  }
                </p>
              </div>
              
              {!isInstalling && (
                <button
                  onClick={handleChangelogClick}
                  className="flex-shrink-0 p-1 hover:bg-[#3a3f4b] rounded transition-colors text-[#7d8590] hover:text-[#e6e6e6] cursor-pointer"
                  title="View changelog"
                >
                  <FileText size={14} />
                </button>
              )}
            </div>

            {!isInstalling && (
              <div className="mt-1">
                <button
                  onClick={onInstall}
                  className="w-full px-3 py-2 bg-gradient-to-r from-[#16a34a] to-[#15803d] hover:from-[#15803d] hover:to-[#16a34a] text-white text-xs font-medium rounded transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Download size={14} />
                  Install Now
                </button>
              </div>
            )}

            {isInstalling && (
              <div className="relative h-1.5 bg-[#181a1f] rounded-full overflow-hidden mt-1">
                <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-[#16a34a] to-[#15803d] animate-pulse rounded-full" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}