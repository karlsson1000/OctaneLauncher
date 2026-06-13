import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Camera, Package, X, Trash2, ExternalLink, ChevronLeft, ChevronRight, Calendar, Check, FolderOpen } from "lucide-react"
import type { Screenshot } from "../../types"

export function ScreenshotsTab() {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [sortBy, setSortBy] = useState<"date" | "instance">("date")
  const [isInstanceDropdownOpen, setIsInstanceDropdownOpen] = useState(false)
  const imageCacheRef = useRef<Record<string, string>>({})

  useEffect(() => { loadScreenshots() }, [])

  const loadScreenshots = async () => {
    setLoading(true)
    try {
      const allScreenshots = await invoke<Screenshot[]>("get_all_screenshots")
      setScreenshots(allScreenshots)
    } catch (error) {
      console.error("Failed to load screenshots:", error)
    } finally {
      setLoading(false)
    }
  }

  const getImageData = useCallback(async (path: string): Promise<string> => {
    const cached = imageCacheRef.current[path]
    if (cached) return cached
    try {
      const dataUrl = await invoke<string>("get_screenshot_data", { path })
      imageCacheRef.current[path] = dataUrl
      return dataUrl
    } catch (error) {
      console.error("Failed to load screenshot data:", error)
      return ""
    }
  }, [])

  const handleDeleteScreenshot = useCallback(async (screenshot: Screenshot) => {
    try {
      await invoke("delete_screenshot", { path: screenshot.path })
      delete imageCacheRef.current[screenshot.path]
      await loadScreenshots()
    } catch (error) {
      console.error("Failed to delete screenshot:", error)
    }
  }, [])

  const handleOpenScreenshot = useCallback(async (screenshot: Screenshot) => {
    try { await invoke("open_screenshot", { path: screenshot.path }) } catch (error) {
      console.error("Failed to open screenshot:", error)
    }
  }, [])

  const handleOpenScreenshotsFolder = useCallback(async () => {
    try { await invoke("open_screenshots_folder", { instanceName: selectedInstance }) } catch (error) {
      console.error("Failed to open screenshots folder:", error)
    }
  }, [selectedInstance])

  const filteredScreenshots = useMemo(() =>
    screenshots
      .filter((s) => !selectedInstance || s.instance_name === selectedInstance)
      .sort((a, b) => sortBy === "date" ? b.timestamp - a.timestamp : a.instance_name.localeCompare(b.instance_name) || b.timestamp - a.timestamp),
    [screenshots, selectedInstance, sortBy]
  )

  const instanceCounts = useMemo(() =>
    screenshots.reduce((acc, s) => {
      acc[s.instance_name] = (acc[s.instance_name] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    [screenshots]
  )

  const openViewer = useCallback((index: number) => {
    setCurrentImageIndex(index)
    setViewerOpen(true)
    const screenshot = filteredScreenshots[index]
    if (screenshot) getImageData(screenshot.path)
    if (filteredScreenshots[index + 1]) getImageData(filteredScreenshots[index + 1].path)
    if (filteredScreenshots[index - 1]) getImageData(filteredScreenshots[index - 1].path)
  }, [filteredScreenshots, getImageData])

  const closeViewer = useCallback(() => setViewerOpen(false), [])

  const nextImage = useCallback(() => {
    const newIndex = (currentImageIndex + 1) % filteredScreenshots.length
    setCurrentImageIndex(newIndex)
    if (filteredScreenshots[newIndex + 1]) getImageData(filteredScreenshots[newIndex + 1].path)
  }, [currentImageIndex, filteredScreenshots, getImageData])

  const prevImage = useCallback(() => {
    const newIndex = currentImageIndex === 0 ? filteredScreenshots.length - 1 : currentImageIndex - 1
    setCurrentImageIndex(newIndex)
    if (filteredScreenshots[newIndex - 1]) getImageData(filteredScreenshots[newIndex - 1].path)
  }, [currentImageIndex, filteredScreenshots, getImageData])

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const handleViewerDelete = useCallback((s: Screenshot) => {
    handleDeleteScreenshot(s)
    if (filteredScreenshots.length === 1) setViewerOpen(false)
  }, [handleDeleteScreenshot, filteredScreenshots.length])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-[#3a3f4b] border-t-[#16a34a] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 space-y-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">Screenshots</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">{filteredScreenshots.length} screenshot{filteredScreenshots.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenScreenshotsFolder}
              className="w-8 h-8 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded flex items-center justify-center transition-colors cursor-pointer"
              title="Open screenshots folder"
            >
              <FolderOpen size={16} />
            </button>
              <InstanceDropdown
                selectedInstance={selectedInstance}
                setSelectedInstance={setSelectedInstance}
                instanceCounts={instanceCounts}
                screenshots={screenshots}
                isOpen={isInstanceDropdownOpen}
                setIsOpen={setIsInstanceDropdownOpen}
              />
            <button
              onClick={() => setSortBy(sortBy === "date" ? "instance" : "date")}
              className="px-3 h-8 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded text-sm flex items-center gap-2 transition-colors cursor-pointer"
            >
              {sortBy === "date" ? <Calendar size={14} /> : <Package size={14} />}
              {sortBy === "date" ? "Date" : "Instance"}
            </button>
          </div>
        </div>

        {filteredScreenshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Camera size={56} className="text-[#3a3f4b] mb-4" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              {screenshots.length === 0 ? "No screenshots yet" : "No results found"}
            </h3>
            <p className="text-sm text-[var(--text-muted)] text-center max-w-md">
              {screenshots.length === 0 ? "Take some screenshots in-game using F2 to see them here." : "Try selecting a different instance or clearing your filter."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredScreenshots.map((screenshot, index) => (
                <ScreenshotCard
                  key={screenshot.path}
                  screenshot={screenshot}
                  index={index}
                  getImageData={getImageData}
                  openViewer={openViewer}
                  onOpen={handleOpenScreenshot}
                  onDelete={handleDeleteScreenshot}
                  formatDate={formatDate}
                  formatFileSize={formatFileSize}
                />
            ))}
          </div>
        )}
      </div>

      {viewerOpen && filteredScreenshots[currentImageIndex] && (
          <ImageViewer
            screenshot={filteredScreenshots[currentImageIndex]}
            currentImageIndex={currentImageIndex}
            totalImages={filteredScreenshots.length}
            getImageData={getImageData}
            closeViewer={closeViewer}
            nextImage={nextImage}
            prevImage={prevImage}
            onOpen={handleOpenScreenshot}
            onDelete={handleViewerDelete}
            formatDate={formatDate}
            formatFileSize={formatFileSize}
          />
      )}
    </div>
  )
}

interface InstanceDropdownProps {
  selectedInstance: string | null
  setSelectedInstance: (value: string | null) => void
  instanceCounts: Record<string, number>
  screenshots: Screenshot[]
  isOpen: boolean
  setIsOpen: (value: boolean) => void
}

function InstanceDropdown({ selectedInstance, setSelectedInstance, instanceCounts, screenshots, isOpen, setIsOpen }: InstanceDropdownProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`h-8 bg-[var(--bg-tertiary)] px-3 pr-8 text-sm text-[var(--text-primary)] focus:outline-none transition-all text-left cursor-pointer ${isOpen ? 'rounded-t' : 'rounded'}`}
      >
        {selectedInstance ? `${selectedInstance} (${instanceCounts[selectedInstance]})` : `All Instances (${screenshots.length})`}
      </button>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e6e6e6" strokeWidth="3">
          <polyline points={isOpen ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
        </svg>
      </div>
      {isOpen && (
        <div className="absolute z-10 min-w-full w-max bg-[var(--bg-tertiary)] rounded-b max-h-60 overflow-y-auto">
          <button
            type="button"
            onClick={() => { setSelectedInstance(null); setIsOpen(false) }}
            className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-between cursor-pointer text-[var(--text-primary)]"
          >
            <span>{`All Instances (${screenshots.length})`}</span>
            {!selectedInstance && <Check size={16} className="text-[var(--text-primary)]" strokeWidth={2} />}
          </button>
          {Object.entries(instanceCounts).sort(([a], [b]) => a.localeCompare(b)).map(([instanceName, count]) => (
            <button
              key={instanceName}
              type="button"
              onClick={() => { setSelectedInstance(instanceName); setIsOpen(false) }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-between cursor-pointer text-[var(--text-primary)]"
            >
              <span>{instanceName} ({count})</span>
              {selectedInstance === instanceName && <Check size={16} className="text-[var(--text-primary)]" strokeWidth={2} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface ScreenshotCardProps {
  screenshot: Screenshot
  index: number
  getImageData: (path: string) => Promise<string>
  openViewer: (index: number) => void
  onOpen: (screenshot: Screenshot) => void
  onDelete: (screenshot: Screenshot) => void
  formatDate: (timestamp: number) => string
  formatFileSize: (bytes: number) => string
}

const ScreenshotCard = memo(function ScreenshotCard({ screenshot, index, getImageData, openViewer, onOpen, onDelete, formatDate, formatFileSize }: ScreenshotCardProps) {
  const [imageSrc, setImageSrc] = useState("")
  const [imageLoading, setImageLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) { loadImage(); observer.disconnect() } },
      { rootMargin: '200px' }
    )
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const loadImage = async () => {
    const dataUrl = await getImageData(screenshot.path)
    if (dataUrl) { setImageSrc(dataUrl); setImageLoading(false) }
  }

  return (
    <div
      ref={containerRef}
      onClick={() => openViewer(index)}
      className="group relative bg-[var(--bg-tertiary)] rounded-md overflow-hidden cursor-pointer transition-all hover:bg-[var(--bg-hover)] screenshot-card"
    >
      <div className="aspect-video bg-[var(--bg-secondary)] overflow-hidden relative">
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#3a3f4b] border-t-[#16a34a] rounded-full animate-spin" />
          </div>
        )}
        {imageSrc && (
          <img src={imageSrc} alt={screenshot.filename} className="w-full h-full object-cover" style={{ opacity: imageLoading ? 0 : 1, transition: 'opacity 0.2s' }} />
        )}
      </div>
      <div className="p-2">
        <p className="text-xs font-medium text-[var(--text-primary)] truncate mb-0.5">{screenshot.instance_name}</p>
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>{formatDate(screenshot.timestamp)}</span>
          <span>{formatFileSize(screenshot.size)}</span>
        </div>
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(screenshot) }}
          className="w-7 h-7 bg-[var(--bg-tertiary)]/90 hover:bg-[var(--bg-hover)] rounded flex items-center justify-center transition-colors cursor-pointer"
          title="Open in default viewer"
        >
          <ExternalLink size={14} className="text-[var(--text-primary)]" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(screenshot) }}
          className="w-7 h-7 bg-red-500/90 hover:bg-red-600 rounded flex items-center justify-center transition-colors cursor-pointer"
          title="Delete screenshot"
        >
          <Trash2 size={14} className="text-white" />
        </button>
      </div>
    </div>
  )
})

interface ImageViewerProps {
  screenshot: Screenshot
  currentImageIndex: number
  totalImages: number
  getImageData: (path: string) => Promise<string>
  closeViewer: () => void
  nextImage: () => void
  prevImage: () => void
  onOpen: (screenshot: Screenshot) => void
  onDelete: (screenshot: Screenshot) => void
  formatDate: (timestamp: number) => string
  formatFileSize: (bytes: number) => string
}

function ImageViewer({ screenshot, currentImageIndex, totalImages, getImageData, closeViewer, nextImage, prevImage, onOpen, onDelete, formatDate, formatFileSize }: ImageViewerProps) {
  const [imageSrc, setImageSrc] = useState("")

  useEffect(() => {
    const loadImage = async () => {
      const dataUrl = await getImageData(screenshot.path)
      setImageSrc(dataUrl)
    }
    loadImage()
  }, [screenshot.path, getImageData])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViewer()
      if (e.key === 'ArrowLeft') prevImage()
      if (e.key === 'ArrowRight') nextImage()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="fixed inset-0 bg-black/95 z-50">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center">
          {!imageSrc ? (
            <div className="w-12 h-12 border-2 border-[#3a3f4b] border-t-[#16a34a] rounded-full animate-spin" />
          ) : (
            <img src={imageSrc} alt={screenshot.filename} className="max-w-full max-h-full object-contain" />
          )}
        </div>
      </div>
      <button onClick={closeViewer} className="absolute top-4 left-4 w-9 h-9 bg-[var(--bg-tertiary)]/90 hover:bg-[var(--bg-hover)] text-white rounded flex items-center justify-center transition-colors cursor-pointer z-10">
        <X size={16} />
      </button>
      {totalImages > 1 && (
        <div className="absolute top-4 left-[72px] px-3 py-2 bg-[var(--bg-tertiary)]/90 rounded-full text-sm text-white pointer-events-none z-10">
          {currentImageIndex + 1} / {totalImages}
        </div>
      )}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button onClick={() => onOpen(screenshot)} className="px-3 py-2 bg-[var(--bg-tertiary)]/90 hover:bg-[var(--bg-hover)] text-white rounded text-sm flex items-center gap-2 transition-colors cursor-pointer">
          <ExternalLink size={14} />
          {"Open"}
        </button>
        <button onClick={() => onDelete(screenshot)} className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm flex items-center gap-2 transition-colors cursor-pointer">
          <Trash2 size={14} />
          {"Delete"}
        </button>
      </div>
      {totalImages > 1 && (
        <>
          <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 hover:bg-[var(--bg-tertiary)]/50 rounded-full flex items-center justify-center transition-colors cursor-pointer z-10">
            <ChevronLeft size={32} className="text-[var(--text-primary)]" />
          </button>
          <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 hover:bg-[var(--bg-tertiary)]/50 rounded-full flex items-center justify-center transition-colors cursor-pointer z-10">
            <ChevronRight size={32} className="text-[var(--text-primary)]" />
          </button>
        </>
      )}
      <div className="absolute bottom-4 left-4 pointer-events-none z-10">
        <p className="text-sm font-medium text-white mb-1">{screenshot.instance_name}</p>
        <p className="text-xs text-gray-300">{screenshot.filename} • {formatDate(screenshot.timestamp)} • {formatFileSize(screenshot.size)}</p>
      </div>
    </div>
  )
}