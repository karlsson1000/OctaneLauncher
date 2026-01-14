import { Download, X, Clock } from "lucide-react"

interface UpdateNotificationToastProps {
  currentVersion: string
  newVersion: string
  isInstalling?: boolean
  onInstall: () => void
  onLater: () => void
}

export function UpdateNotificationToast({
  newVersion,
  isInstalling = false,
  onInstall,
  onLater 
}: UpdateNotificationToastProps) {
  return (
    <>
      <style>{`
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
          ) !important;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          backdrop-filter: blur(8px);
          z-index: 10;
        }

        .blur-border:hover::before {
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.08),
            rgba(255, 255, 255, 0.04)
          ) !important;
        }
      `}</style>
      <div className="fixed top-14 right-4 z-40 w-[330px] animate-in slide-in-from-right-4 duration-300">
        <div className="blur-border bg-[#181a1f] rounded overflow-hidden">
          <div className="p-4 relative z-0">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
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
                      onClick={onLater}
                      className="flex-shrink-0 p-1 hover:bg-[#3a3f4b] rounded transition-colors text-gray-400 hover:text-[#e6e6e6] cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {!isInstalling && (
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={onInstall}
                      className="flex-1 px-3 py-1.5 bg-gradient-to-r from-[#16a34a] to-[#15803d] hover:from-[#15803d] hover:to-[#16a34a] text-white text-xs font-medium rounded transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Download size={14} />
                      Install Now
                    </button>
                    
                    <button
                      onClick={onLater}
                      className="flex-1 px-3 py-1.5 bg-[#22252b] hover:bg-[#3a3f4b] text-[#e6e6e6] text-xs font-medium rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Clock size={14} />
                      Ask Later
                    </button>
                  </div>
                )}

                {isInstalling && (
                  <div className="relative h-1.5 bg-[#22252b] rounded-full overflow-hidden mt-3">
                    <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-[#16a34a] to-[#15803d] animate-pulse rounded-full" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}