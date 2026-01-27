import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Camera, Package, X, Trash2, ExternalLink, ChevronLeft, ChevronRight, Calendar, Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { Instance } from "../../types"

interface Screenshot {
  path: string
  filename: string
  instance_name: string
  timestamp: number
  size: number
  data_url: string
}

interface ScreenshotsTabProps {
  instances: Instance[]
}

export function ScreenshotsTab({}: ScreenshotsTabProps) {
  const { t } = useTranslation()
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [sortBy, setSortBy] = useState<"date" | "instance">("date")
  const [isInstanceDropdownOpen, setIsInstanceDropdownOpen] = useState(false)

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

  const handleDeleteScreenshot = async (screenshot: Screenshot) => {
    try {
      await invoke("delete_screenshot", { path: screenshot.path })
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

  const openViewer = (index: number) => {
    setCurrentImageIndex(index)
    setViewerOpen(true)
  }

  const closeViewer = () => {
    setViewerOpen(false)
  }

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % filteredScreenshots.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => 
      prev === 0 ? filteredScreenshots.length - 1 : prev - 1
    )
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

  const filteredScreenshots = screenshots.filter((screenshot) => {
    const matchesInstance = !selectedInstance || screenshot.instance_name === selectedInstance
    return matchesInstance
  }).sort((a, b) => {
    if (sortBy === "date") {
      return b.timestamp - a.timestamp
    } else {
      return a.instance_name.localeCompare(b.instance_name) || b.timestamp - a.timestamp
    }
  })

  const instanceCounts = screenshots.reduce((acc, screenshot) => {
    acc[screenshot.instance_name] = (acc[screenshot.instance_name] || 0) + 1
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
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3a3f4b;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #454a58;
        }
      `}</style>
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
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsInstanceDropdownOpen(!isInstanceDropdownOpen)}
                  className={`h-8 bg-[#22252b] px-3 pr-8 text-sm text-[#e6e6e6] focus:outline-none transition-all text-left cursor-pointer border border-[#3a3f4b] ${
                    isInstanceDropdownOpen ? 'rounded-t border-b-transparent' : 'rounded'
                  }`}
                >
                  {selectedInstance 
                    ? `${selectedInstance} (${instanceCounts[selectedInstance]})` 
                    : t('screenshots.allInstances', { count: screenshots.length })}
                </button>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {isInstanceDropdownOpen ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e6e6e6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="18 15 12 9 6 15"></polyline>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e6e6e6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  )}
                </div>
                
                {isInstanceDropdownOpen && (
                  <div className="absolute z-10 min-w-full w-max bg-[#22252b] rounded-b max-h-60 overflow-y-auto custom-scrollbar border-l border-r border-b border-[#3a3f4b]">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedInstance(null);
                        setIsInstanceDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-[#3a3f4b] transition-colors flex items-center justify-between cursor-pointer text-[#e6e6e6]"
                    >
                      <span>{t('screenshots.allInstances', { count: screenshots.length })}</span>
                      {!selectedInstance && (
                        <Check size={16} className="text-[#e6e6e6]" strokeWidth={2} />
                      )}
                    </button>
                    {Object.entries(instanceCounts)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([instanceName, count]) => (
                        <button
                          key={instanceName}
                          type="button"
                          onClick={() => {
                            setSelectedInstance(instanceName);
                            setIsInstanceDropdownOpen(false);
                          }}
                          className="w-full px-3 py-2 text-sm text-left hover:bg-[#3a3f4b] transition-colors flex items-center justify-between cursor-pointer text-[#e6e6e6]"
                        >
                          <span>{instanceName} ({count})</span>
                          {selectedInstance === instanceName && (
                            <Check size={16} className="text-[#e6e6e6]" strokeWidth={2} />
                          )}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setSortBy(sortBy === "date" ? "instance" : "date")}
                className="px-3 h-8 bg-[#22252b] hover:bg-[#2a2e35] text-[#e6e6e6] rounded text-sm flex items-center gap-2 transition-colors cursor-pointer"
              >
                {sortBy === "date" ? <Calendar size={14} /> : <Package size={14} />}
                {t(`screenshots.sortBy.${sortBy}`)}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div>
          {filteredScreenshots.length === 0 ? (
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
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredScreenshots.map((screenshot, index) => (
                <div
                  key={screenshot.path}
                  onClick={() => openViewer(index)}
                  className="group relative bg-[#22252b] rounded-lg overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-[#4572e3]"
                >
                  {/* Image */}
                  <div className="aspect-video bg-[#181a1f] overflow-hidden relative">
                    <img
                      src={screenshot.data_url}
                      alt={screenshot.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Info */}
                  <div className="p-2">
                    <p className="text-xs font-medium text-[#e6e6e6] truncate mb-0.5">
                      {screenshot.instance_name}
                    </p>
                    <div className="flex items-center justify-between text-xs text-[#7d8590]">
                      <span>{formatDate(screenshot.timestamp)}</span>
                      <span>{formatFileSize(screenshot.size)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenScreenshot(screenshot)
                      }}
                      className="w-7 h-7 bg-[#22252b]/90 hover:bg-[#2a2e35] rounded flex items-center justify-center transition-colors cursor-pointer"
                      title={t('screenshots.actions.open')}
                    >
                      <ExternalLink size={14} className="text-[#e6e6e6]" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteScreenshot(screenshot)
                      }}
                      className="w-7 h-7 bg-red-500/90 hover:bg-red-600 rounded flex items-center justify-center transition-colors cursor-pointer"
                      title={t('screenshots.actions.delete')}
                    >
                      <Trash2 size={14} className="text-white" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {/* Image Viewer Modal */}
      {viewerOpen && filteredScreenshots[currentImageIndex] && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center">
          {/* Close Button */}
          <button
            onClick={closeViewer}
            className="absolute top-4 right-4 w-10 h-10 bg-[#22252b]/90 hover:bg-[#2a2e35] rounded-full flex items-center justify-center transition-colors cursor-pointer z-10"
          >
            <X size={20} className="text-[#e6e6e6]" />
          </button>

          {/* Navigation */}
          {filteredScreenshots.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-[#22252b]/90 hover:bg-[#2a2e35] rounded-full flex items-center justify-center transition-colors cursor-pointer z-10"
              >
                <ChevronLeft size={24} className="text-[#e6e6e6]" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-[#22252b]/90 hover:bg-[#2a2e35] rounded-full flex items-center justify-center transition-colors cursor-pointer z-10"
              >
                <ChevronRight size={24} className="text-[#e6e6e6]" />
              </button>
            </>
          )}

          {/* Image */}
          <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center">
            <img
              src={filteredScreenshots[currentImageIndex].data_url}
              alt={filteredScreenshots[currentImageIndex].filename}
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Info Bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white mb-1">
                  {filteredScreenshots[currentImageIndex].instance_name}
                </p>
                <p className="text-xs text-gray-300">
                  {filteredScreenshots[currentImageIndex].filename} • {formatDate(filteredScreenshots[currentImageIndex].timestamp)} • {formatFileSize(filteredScreenshots[currentImageIndex].size)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenScreenshot(filteredScreenshots[currentImageIndex])}
                  className="px-3 py-1.5 bg-[#22252b]/90 hover:bg-[#2a2e35] text-white rounded text-sm flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <ExternalLink size={14} />
                  {t('screenshots.viewer.open')}
                </button>
                <button
                  onClick={() => {
                    handleDeleteScreenshot(filteredScreenshots[currentImageIndex])
                    if (filteredScreenshots.length === 1) {
                      closeViewer()
                    } else if (currentImageIndex === filteredScreenshots.length - 1) {
                      setCurrentImageIndex(currentImageIndex - 1)
                    }
                  }}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded text-sm flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                  {t('screenshots.viewer.delete')}
                </button>
              </div>
            </div>
          </div>

          {/* Counter */}
          {filteredScreenshots.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-[#22252b]/90 rounded-full text-sm text-white">
              {currentImageIndex + 1} / {filteredScreenshots.length}
            </div>
          )}
        </div>
      )}
    </div>
  )
}