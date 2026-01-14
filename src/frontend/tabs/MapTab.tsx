import { useState } from "react"
import { Globe, Check, X } from "lucide-react"

export function MapTab() {
  const [mapUrl, setMapUrl] = useState("https://map.stellarmc.gg")
  const [isEditing, setIsEditing] = useState(false)
  const [inputUrl, setInputUrl] = useState("")
  const [error, setError] = useState<string | null>(null)

  const validateUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.startsWith("map.") || 
             urlObj.hostname.startsWith("cmap.") || 
             urlObj.hostname.includes(".map.") || 
             urlObj.hostname.includes(".cmap.")
    } catch {
      return false
    }
  }

  const handleStartEdit = () => {
    setInputUrl(mapUrl)
    setIsEditing(true)
    setError(null)
  }

  const handleSave = () => {
    if (!inputUrl.trim()) {
      setError("URL cannot be empty")
      return
    }

    if (!validateUrl(inputUrl)) {
      setError("URL must have a 'map.' subdomain")
      return
    }

    setMapUrl(inputUrl)
    setIsEditing(false)
    setError(null)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setInputUrl("")
    setError(null)
  }

  return (
    <div className="p-6 space-y-4">
      <style>{`
        .console-border {
          position: relative;
        }

        .console-border::before {
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
        }
      `}</style>
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-[#e6e6e6] tracking-tight">Server Maps</h1>
          <p className="text-sm text-[#7d8590] mt-0.5">Explore a server world</p>
        </div>

        <div className="console-border bg-[#22252b] rounded-md overflow-hidden" style={{ height: 'calc(100vh - 225px)' }}>
          <iframe
            src={mapUrl}
            className="w-full h-full"
            title="Server Maps"
            style={{ border: 'none' }}
          />
        </div>

        <div className="flex items-center justify-end mt-4">
          {/* Edit URL Input */}
          {isEditing && (
            <div className="flex-1 mr-4 flex items-center gap-2">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => {
                  setInputUrl(e.target.value)
                  setError(null)
                }}
                placeholder="https://map.example.com"
                className="flex-1 px-3 py-2 bg-[#181a1f] text-[#e6e6e6] rounded-md text-sm outline-none focus:ring-2 focus:ring-[#4572e3] transition-all"
                autoFocus
              />
              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}
            </div>
          )}

          <div className="flex gap-2 flex-shrink-0">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-[#16a34a]/10 hover:bg-[#16a34a]/20 text-[#16a34a] rounded-md font-medium text-sm flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Check size={16} strokeWidth={2} />
                  <span>Save</span>
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-[#22252b] hover:bg-[#3a3f4b] text-[#e6e6e6] rounded-md font-medium text-sm flex items-center gap-2 transition-all cursor-pointer"
                >
                  <X size={16} strokeWidth={2} />
                  <span>Cancel</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleStartEdit}
                className="px-4 py-2 bg-[#22252b] hover:bg-[#3a3f4b] text-[#e6e6e6] rounded-md font-medium text-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <Globe size={16} strokeWidth={2} />
                <span>Change URL</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}