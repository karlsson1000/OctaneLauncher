import { useState, useEffect } from "react"
import { Search, X } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"

interface GiphyGif {
  id: string
  title: string
  url: string
  images: {
    fixed_height: {
      url: string
      width: string
      height: string
    }
    fixed_width: {
      url: string
      width: string
      height: string
    }
  }
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void
  onClose: () => void
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [gifs, setGifs] = useState<GiphyGif[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showTrending, setShowTrending] = useState(true)

  useEffect(() => {
    loadTrendingGifs()
  }, [])

  useEffect(() => {
    if (searchQuery.trim()) {
      const timeoutId = setTimeout(() => {
        searchGifs()
      }, 500)
      return () => clearTimeout(timeoutId)
    } else {
      loadTrendingGifs()
    }
  }, [searchQuery])

  const loadTrendingGifs = async () => {
    setIsLoading(true)
    setShowTrending(true)
    try {
      const result = await invoke<GiphyGif[]>("get_trending_gifs", { limit: 25 })
      setGifs(result)
    } catch (error) {
      console.error("Failed to load trending GIFs:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const searchGifs = async () => {
    if (!searchQuery.trim()) return
    
    setIsLoading(true)
    setShowTrending(false)
    try {
      const result = await invoke<GiphyGif[]>("search_gifs", { 
        query: searchQuery,
        limit: 25 
      })
      setGifs(result)
    } catch (error) {
      console.error("Failed to search GIFs:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGifSelect = (gif: GiphyGif) => {
    onSelect(gif.images.fixed_height.url)
    onClose()
  }

  return (
    <div className="absolute bottom-full right-4 mb-2 bg-[#2b2f38] rounded shadow-lg overflow-hidden max-w-sm">
      <div className="p-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-[#9ea3ad]">
            {showTrending ? "Trending" : "Search"}
          </span>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#2b2f38]/50 rounded transition-colors text-[#7d8590] hover:text-[#9ea3ad] cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
        
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7d8590]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search GIFs..."
            className="w-full bg-[#22252b] rounded pl-8 pr-3 py-1.5 text-xs text-[#e6e6e6] placeholder-[#7d8590] focus:outline-none"
            autoFocus
          />
        </div>
      </div>

      <div className="h-[240px] overflow-y-auto px-1.5 pb-1.5">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-[#2b2f38] border-t-[#4a4f5a] rounded-full animate-spin" />
          </div>
        ) : gifs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#7d8590] text-xs">
            No GIFs found
          </div>
        ) : (
          <div className="columns-2 gap-1.5 space-y-1.5">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => handleGifSelect(gif)}
                className="relative overflow-hidden rounded hover:opacity-90 transition-opacity group cursor-pointer w-full break-inside-avoid mb-1.5"
              >
                <img
                  src={gif.images.fixed_width.url}
                  alt={gif.title}
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}