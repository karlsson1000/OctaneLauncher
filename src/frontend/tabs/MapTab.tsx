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
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-[#e6edf3] tracking-tight">Server Maps</h1>
          <p className="text-sm text-[#7d8590] mt-0.5">Explore a server world</p>
        </div>

        <div className="bg-[#141414] rounded-md overflow-hidden border border-[#2a2a2a]" style={{ height: 'calc(100vh - 225px)' }}>
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
                className="flex-1 px-3 py-1.5 bg-[#141414] border border-[#2a2a2a] text-[#e6edf3] rounded text-sm outline-none focus:border-[#3a3a3a] transition-colors"
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
                  className="px-4 h-8 bg-[#238636] hover:bg-[#2ea043] text-white rounded-md font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer border border-[#238636]"
                >
                  <Check size={16} strokeWidth={2} />
                  <span>Save</span>
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 h-8 bg-[#141414] hover:bg-[#1a1a1a] text-[#e6edf3] rounded-md font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer border border-[#2a2a2a]"
                >
                  <X size={16} strokeWidth={2} />
                  <span>Cancel</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleStartEdit}
                className="px-4 h-8 bg-[#141414] hover:bg-[#1a1a1a] text-[#e6edf3] rounded-md font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer border border-[#2a2a2a]"
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