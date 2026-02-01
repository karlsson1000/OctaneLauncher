import { useState, useEffect, useRef, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Camera, Package, X, Trash2, ExternalLink, ChevronLeft, ChevronRight, Calendar, Check, FolderOpen } from "lucide-react"
import { useTranslation } from "react-i18next"

interface Screenshot {
  path: string
  filename: string
  instance_name: string
  timestamp: number
  size: number
}

interface ScreenshotsTabProps {
  instances?: any[]
}

export function ScreenshotsTab(_props: ScreenshotsTabProps) {
  const { t } = useTranslation()
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [sortBy, setSortBy] = useState<"date" | "instance">("date")
  const [isInstanceDropdownOpen, setIsInstanceDropdownOpen] = useState(false)
  const [imageCache, setImageCache] = useState<Record<string, string>>({})

  useEffect(() => {
    loadScreenshots()
  }, [])

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
    if (imageCache[path]) return imageCache[path]

    try {
      const dataUrl = await invoke<string>("get_screenshot_data", { path })
      setImageCache(prev => ({ ...prev, [path]: dataUrl }))
      return dataUrl
    } catch (error) {
      console.error("Failed to load screenshot data:", error)
      return ""
    }
  }, [imageCache])

  const handleDeleteScreenshot = async (screenshot: Screenshot) => {
    try {
      await invoke("delete_screenshot", { path: screenshot.path })
      setImageCache(prev => {
        const newCache = { ...prev }
        delete newCache[screenshot.path]
        return newCache
      })
      await loadScreenshots()
    } catch (error) {
      console.error("Failed to delete screenshot:", error)
    }
  }

  const handleOpenScreenshot = async (screenshot: Screenshot) => {
    try {
      await invoke("open_screenshot", { path: screenshot.path })
    } catch (error) {
      console.error("Failed to open screenshot:", error)
    }
  }

  const handleOpenScreenshotsFolder = async () => {
    try {
      await invoke("open_screenshots_folder", { instanceName: selectedInstance })
    } catch (error) {
      console.error("Failed to open screenshots folder:", error)
    }
  }

  const openViewer = (index: number) => {
    setCurrentImageIndex(index)
    setViewerOpen(true)
    // Preload adjacent images
    const screenshot = filteredScreenshots[index]
    if (screenshot) getImageData(screenshot.path)
    if (filteredScreenshots[index + 1]) getImageData(filteredScreenshots[index + 1].path)
    if (filteredScreenshots[index - 1]) getImageData(filteredScreenshots[index - 1].path)
  }

  const nextImage = () => {
    const newIndex = (currentImageIndex + 1) % filteredScreenshots.length
    setCurrentImageIndex(newIndex)
    if (filteredScreenshots[newIndex + 1]) {
      getImageData(filteredScreenshots[newIndex + 1].path)
    }
  }

  const prevImage = () => {
    const newIndex = currentImageIndex === 0 ? filteredScreenshots.length - 1 : currentImageIndex - 1
    setCurrentImageIndex(newIndex)
    if (filteredScreenshots[newIndex - 1]) {
      getImageData(filteredScreenshots[newIndex - 1].path)
    }
  }

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const filteredScreenshots = screenshots
    .filter((s: Screenshot) => !selectedInstance || s.instance_name === selectedInstance)
    .sort((a, b) => {
      if (sortBy === "date") return b.timestamp - a.timestamp
      return a.instance_name.localeCompare(b.instance_name) || b.timestamp - a.timestamp
    })

  const instanceCounts = screenshots.reduce((acc, s: Screenshot) => {
    acc[s.instance_name] = (acc[s.instance_name] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-[#3a3f4b] border-t-[#16a34a] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#e6e6e6] tracking-tight">
              {t('screenshots.title')}
            </h1>
            <p className="text-sm text-[#7d8590] mt-0.5">
              {t('screenshots.screenshotCount', { count: filteredScreenshots.length })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenScreenshotsFolder}
              className="w-8 h-8 bg-[#22252b] hover:bg-[#2a2e35] text-[#e6e6e6] rounded flex items-center justify-center transition-colors cursor-pointer"
              title={t('screenshots.actions.openFolder')}
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
              t={t}
            />
            <button
              onClick={() => setSortBy(sortBy === "date" ? "instance" : "date")}
              className="px-3 h-8 bg-[#22252b] hover:bg-[#2a2e35] text-[#e6e6e6] rounded text-sm flex items-center gap-2 transition-colors cursor-pointer"
            >
              {sortBy === "date" ? <Calendar size={14} /> : <Package size={14} />}
              {t(`screenshots.sortBy.${sortBy}`)}
            </button>
          </div>
        </div>

        {/* Content */}
        {filteredScreenshots.length === 0 ? (
          <EmptyState screenshots={screenshots} t={t} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredScreenshots.map((screenshot, index) => (
              <ScreenshotCard
                key={screenshot.path}
                screenshot={screenshot}
                index={index}
                imageCache={imageCache}
                getImageData={getImageData}
                openViewer={openViewer}
                handleOpenScreenshot={handleOpenScreenshot}
                handleDeleteScreenshot={handleDeleteScreenshot}
                formatDate={formatDate}
                formatFileSize={formatFileSize}
                t={t}
              />
            ))}
          </div>
        )}
      </div>

      {/* Image Viewer Modal */}
      {viewerOpen && filteredScreenshots[currentImageIndex] && (
        <ImageViewer
          screenshot={filteredScreenshots[currentImageIndex]}
          currentImageIndex={currentImageIndex}
          totalImages={filteredScreenshots.length}
          imageCache={imageCache}
          getImageData={getImageData}
          closeViewer={() => setViewerOpen(false)}
          nextImage={nextImage}
          prevImage={prevImage}
          handleOpenScreenshot={handleOpenScreenshot}
          handleDeleteScreenshot={(s) => {
            handleDeleteScreenshot(s)
            if (filteredScreenshots.length === 1) {
              setViewerOpen(false)
            }
          }}
          formatDate={formatDate}
          formatFileSize={formatFileSize}
          t={t}
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
  t: any
}

function InstanceDropdown({ 
  selectedInstance, 
  setSelectedInstance, 
  instanceCounts, 
  screenshots, 
  isOpen, 
  setIsOpen,
  t 
}: InstanceDropdownProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`h-8 bg-[#22252b] px-3 pr-8 text-sm text-[#e6e6e6] focus:outline-none transition-all text-left cursor-pointer ${
          isOpen ? 'rounded-t' : 'rounded'
        }`}
      >
        {selectedInstance 
          ? `${selectedInstance} (${instanceCounts[selectedInstance]})` 
          : t('screenshots.allInstances', { count: screenshots.length })}
      </button>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e6e6e6" strokeWidth="3">
          <polyline points={isOpen ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
        </svg>
      </div>
      
      {isOpen && (
        <div className="absolute z-10 min-w-full w-max bg-[#22252b] rounded-b max-h-60 overflow-y-auto">
          <button
            type="button"
            onClick={() => { setSelectedInstance(null); setIsOpen(false); }}
            className="w-full px-3 py-2 text-sm text-left hover:bg-[#3a3f4b] transition-colors flex items-center justify-between cursor-pointer text-[#e6e6e6]"
          >
            <span>{t('screenshots.allInstances', { count: screenshots.length })}</span>
            {!selectedInstance && <Check size={16} className="text-[#e6e6e6]" strokeWidth={2} />}
          </button>
          {Object.entries(instanceCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([instanceName, count]) => (
              <button
                key={instanceName}
                type="button"
                onClick={() => { setSelectedInstance(instanceName); setIsOpen(false); }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-[#3a3f4b] transition-colors flex items-center justify-between cursor-pointer text-[#e6e6e6]"
              >
                <span>{instanceName} ({count})</span>
                {selectedInstance === instanceName && <Check size={16} className="text-[#e6e6e6]" strokeWidth={2} />}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

interface EmptyStateProps {
  screenshots: Screenshot[]
  t: any
}

function EmptyState({ screenshots, t }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Camera size={56} className="text-[#3a3f4b] mb-4" strokeWidth={1.5} />
      <h3 className="text-lg font-semibold text-[#e6e6e6] mb-2">
        {screenshots.length === 0 ? t('screenshots.noScreenshots.title') : t('screenshots.noResults.title')}
      </h3>
      <p className="text-sm text-[#7d8590] text-center max-w-md">
        {screenshots.length === 0 
          ? t('screenshots.noScreenshots.description')
          : t('screenshots.noResults.description')}
      </p>
    </div>
  )
}

interface ScreenshotCardProps {
  screenshot: Screenshot
  index: number
  imageCache: Record<string, string>
  getImageData: (path: string) => Promise<string>
  openViewer: (index: number) => void
  handleOpenScreenshot: (screenshot: Screenshot) => void
  handleDeleteScreenshot: (screenshot: Screenshot) => void
  formatDate: (timestamp: number) => string
  formatFileSize: (bytes: number) => string
  t: any
}

function ScreenshotCard({ 
  screenshot, 
  index, 
  imageCache, 
  getImageData, 
  openViewer, 
  handleOpenScreenshot, 
  handleDeleteScreenshot,
  formatDate,
  formatFileSize,
  t
}: ScreenshotCardProps) {
  const [imageSrc, setImageSrc] = useState("")
  const [imageLoading, setImageLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (imageCache[screenshot.path]) {
      setImageSrc(imageCache[screenshot.path])
      setImageLoading(false)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadImage()
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [screenshot.path, imageCache])

  const loadImage = async () => {
    const dataUrl = await getImageData(screenshot.path)
    if (dataUrl) {
      setImageSrc(dataUrl)
      setImageLoading(false)
    }
  }

  return (
    <div
      ref={containerRef}
      onClick={() => openViewer(index)}
      className="group relative bg-[#22252b] rounded-lg overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-[#4572e3]"
    >
      <div className="aspect-video bg-[#181a1f] overflow-hidden relative">
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#3a3f4b] border-t-[#16a34a] rounded-full animate-spin" />
          </div>
        )}
        {imageSrc && (
          <img
            src={imageSrc}
            alt={screenshot.filename}
            className="w-full h-full object-cover"
            style={{ opacity: imageLoading ? 0 : 1, transition: 'opacity 0.2s' }}
          />
        )}
      </div>

      <div className="p-2">
        <p className="text-xs font-medium text-[#e6e6e6] truncate mb-0.5">
          {screenshot.instance_name}
        </p>
        <div className="flex items-center justify-between text-xs text-[#7d8590]">
          <span>{formatDate(screenshot.timestamp)}</span>
          <span>{formatFileSize(screenshot.size)}</span>
        </div>
      </div>

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); handleOpenScreenshot(screenshot); }}
          className="w-7 h-7 bg-[#22252b]/90 hover:bg-[#2a2e35] rounded flex items-center justify-center transition-colors cursor-pointer"
          title={t('screenshots.actions.open')}
        >
          <ExternalLink size={14} className="text-[#e6e6e6]" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDeleteScreenshot(screenshot); }}
          className="w-7 h-7 bg-red-500/90 hover:bg-red-600 rounded flex items-center justify-center transition-colors cursor-pointer"
          title={t('screenshots.actions.delete')}
        >
          <Trash2 size={14} className="text-white" />
        </button>
      </div>
    </div>
  )
}

interface ImageViewerProps {
  screenshot: Screenshot
  currentImageIndex: number
  totalImages: number
  imageCache: Record<string, string>
  getImageData: (path: string) => Promise<string>
  closeViewer: () => void
  nextImage: () => void
  prevImage: () => void
  handleOpenScreenshot: (screenshot: Screenshot) => void
  handleDeleteScreenshot: (screenshot: Screenshot) => void
  formatDate: (timestamp: number) => string
  formatFileSize: (bytes: number) => string
  t: any
}

function ImageViewer({
  screenshot,
  currentImageIndex,
  totalImages,
  imageCache,
  getImageData,
  closeViewer,
  nextImage,
  prevImage,
  handleOpenScreenshot,
  handleDeleteScreenshot,
  formatDate,
  formatFileSize,
  t
}: ImageViewerProps) {
  const [imageSrc, setImageSrc] = useState("")

  useEffect(() => {
    const loadImage = async () => {
      const dataUrl = imageCache[screenshot.path] || await getImageData(screenshot.path)
      setImageSrc(dataUrl)
    }
    loadImage()
  }, [screenshot.path])

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
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center">
      <button
        onClick={closeViewer}
        className="absolute top-4 left-4 w-9 h-9 bg-[#22252b]/90 hover:bg-[#2a2e35] text-white rounded flex items-center justify-center transition-colors cursor-pointer z-10"
      >
        <X size={16} />
      </button>

      {totalImages > 1 && (
        <div className="absolute top-4 left-[72px] px-3 py-2 bg-[#22252b]/90 rounded-full text-sm text-white pointer-events-none z-10">
          {currentImageIndex + 1} / {totalImages}
        </div>
      )}

      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button
          onClick={() => handleOpenScreenshot(screenshot)}
          className="px-3 py-2 bg-[#22252b]/90 hover:bg-[#2a2e35] text-white rounded text-sm flex items-center gap-2 transition-colors cursor-pointer"
        >
          <ExternalLink size={14} />
          {t('screenshots.viewer.open')}
        </button>
        <button
          onClick={() => handleDeleteScreenshot(screenshot)}
          className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Trash2 size={14} />
          {t('screenshots.viewer.delete')}
        </button>
      </div>

      {totalImages > 1 && (
        <>
          <button
            onClick={prevImage}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 hover:bg-[#22252b]/50 rounded-full flex items-center justify-center transition-colors cursor-pointer z-10"
          >
            <ChevronLeft size={32} className="text-[#e6e6e6]" />
          </button>
          <button
            onClick={nextImage}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 hover:bg-[#22252b]/50 rounded-full flex items-center justify-center transition-colors cursor-pointer z-10"
          >
            <ChevronRight size={32} className="text-[#e6e6e6]" />
          </button>
        </>
      )}

      <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center">
        {!imageSrc ? (
          <div className="w-12 h-12 border-2 border-[#3a3f4b] border-t-[#16a34a] rounded-full animate-spin" />
        ) : (
          <img src={imageSrc} alt={screenshot.filename} className="max-w-full max-h-full object-contain" />
        )}
      </div>

      <div className="absolute bottom-4 left-4">
        <p className="text-sm font-medium text-white mb-1">{screenshot.instance_name}</p>
        <p className="text-xs text-gray-300">
          {screenshot.filename} • {formatDate(screenshot.timestamp)} • {formatFileSize(screenshot.size)}
        </p>
      </div>
    </div>
  )
}