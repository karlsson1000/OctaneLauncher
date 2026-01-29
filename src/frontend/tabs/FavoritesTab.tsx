import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Heart, Package, Download, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { Instance, ModrinthSearchResult, ModrinthProject, ModrinthVersion } from "../../types"

interface FavoritesTabProps {
  selectedInstance: Instance | null
}

export function FavoritesTab({ 
  selectedInstance
}: FavoritesTabProps) {
  const { t } = useTranslation()
  const [favoriteProjects, setFavoriteProjects] = useState<ModrinthProject[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [installedFiles, setInstalledFiles] = useState<Set<string>>(new Set())
  const [favoriteMods, setFavoriteMods] = useState<Set<string>>(new Set())
  const [favoriteResourcePacks, setFavoriteResourcePacks] = useState<Set<string>>(new Set())
  const [favoriteShaderPacks, setFavoriteShaderPacks] = useState<Set<string>>(new Set())
  const [isInstallingAll, setIsInstallingAll] = useState(false)
  const [installProgress, setInstallProgress] = useState({ current: 0, total: 0, failed: 0 })

  // Load favorites from localStorage
  useEffect(() => {
    loadFavorites()
  }, [])

  // Reload projects when favorites change
  useEffect(() => {
    loadAllFavoriteProjects()
  }, [favoriteMods, favoriteResourcePacks, favoriteShaderPacks])

  // Reload installed files when instance changes
  useEffect(() => {
    if (selectedInstance) {
      loadInstalledFiles()
    }
  }, [selectedInstance])

  const loadFavorites = () => {
    const savedMods = localStorage.getItem('favoriteMods')
    const savedResourcePacks = localStorage.getItem('favoriteResourcePacks')
    const savedShaderPacks = localStorage.getItem('favoriteShaderPacks')

    if (savedMods) {
      try {
        setFavoriteMods(new Set(JSON.parse(savedMods)))
      } catch (error) {
        console.error('Failed to parse favorite mods:', error)
      }
    }
    if (savedResourcePacks) {
      try {
        setFavoriteResourcePacks(new Set(JSON.parse(savedResourcePacks)))
      } catch (error) {
        console.error('Failed to parse favorite resource packs:', error)
      }
    }
    if (savedShaderPacks) {
      try {
        setFavoriteShaderPacks(new Set(JSON.parse(savedShaderPacks)))
      } catch (error) {
        console.error('Failed to parse favorite shader packs:', error)
      }
    }
  }

  const loadInstalledFiles = async () => {
    if (!selectedInstance) return
    
    try {
      const [mods, resourcepacks, shaderpacks] = await Promise.all([
        invoke<{ filename: string }[]>("get_installed_mods", {
          instanceName: selectedInstance.name,
        }).catch(() => []),
        invoke<string[]>("get_installed_resourcepacks", {
          instanceName: selectedInstance.name,
        }).catch(() => []),
        invoke<string[]>("get_installed_shaderpacks", {
          instanceName: selectedInstance.name,
        }).catch(() => []),
      ])
      
      const allFiles = new Set([
        ...mods.map(mod => mod.filename),
        ...resourcepacks,
        ...shaderpacks,
      ])
      setInstalledFiles(allFiles)
    } catch (error) {
      console.error("Failed to load installed files:", error)
    }
  }

  const loadAllFavoriteProjects = async () => {
    const allFavoriteIds = new Set([
      ...Array.from(favoriteMods),
      ...Array.from(favoriteResourcePacks),
      ...Array.from(favoriteShaderPacks)
    ])

    if (allFavoriteIds.size === 0) {
      setFavoriteProjects([])
      return
    }

    setIsLoading(true)
    try {
      const facets = JSON.stringify([
        ["project_type:mod", "project_type:resourcepack", "project_type:shader"],
        Array.from(allFavoriteIds).map(id => `project_id:${id}`)
      ])

      const result = await invoke<ModrinthSearchResult>("search_mods", {
        query: "",
        facets,
        index: "downloads",
        offset: 0,
        limit: 100,
      })

      setFavoriteProjects(result.hits)
    } catch (error) {
      console.error("Failed to load favorite projects:", error)
      setFavoriteProjects([])
    } finally {
      setIsLoading(false)
    }
  }

  const getMinecraftVersion = (instance: Instance): string => {
    if (instance.loader === "fabric") {
      const parts = instance.version.split('-')
      return parts[parts.length - 1]
    }
    if (instance.loader === "neoforge") {
      const versionPart = instance.version.replace('neoforge-', '')
      const parts = versionPart.split('-')
      if (parts[0].startsWith('1.')) {
        return parts[0]
      }
      
      const versionNumbers = parts[0].split('.')
      if (versionNumbers.length >= 2) {
        const major = versionNumbers[0]
        const minor = versionNumbers[1]
        const patch = versionNumbers[2] || '0'
        const majorNum = parseInt(major)
        if (majorNum >= 20) {
          if (patch === '0') {
            return `1.${major}`
          }
          return `1.${major}.${minor}`
        }
      }
    }
    return instance.version
  }

  const handleInstallAllFavorites = async () => {
    if (!selectedInstance || favoriteProjects.length === 0) return

    setIsInstallingAll(true)
    setInstallProgress({ current: 0, total: favoriteProjects.length, failed: 0 })

    const mcVersion = getMinecraftVersion(selectedInstance)
    const loaders = selectedInstance.loader ? [selectedInstance.loader] : ["vanilla"]

    for (let i = 0; i < favoriteProjects.length; i++) {
      const project = favoriteProjects[i]
      
      try {
        // Get compatible versions for this project
        const versions = await invoke<ModrinthVersion[]>("get_mod_versions", {
          idOrSlug: project.project_id,
          loaders: project.project_type === "mod" ? loaders : undefined,
          gameVersions: [mcVersion],
        })

        if (versions.length === 0) {
          setInstallProgress(prev => ({ ...prev, current: i + 1, failed: prev.failed + 1 }))
          continue
        }

        // Get the first compatible version
        const latestVersion = versions[0]
        const primaryFile = latestVersion.files.find(f => f.primary) || latestVersion.files[0]

        if (!primaryFile) {
          setInstallProgress(prev => ({ ...prev, current: i + 1, failed: prev.failed + 1 }))
          continue
        }

        // Check if already installed
        if (installedFiles.has(primaryFile.filename)) {
          setInstallProgress(prev => ({ ...prev, current: i + 1 }))
          continue
        }

        // Download the file
        const projectType = project.project_type
        
        if (projectType === "mod") {
          await invoke<string>("download_mod", {
            instanceName: selectedInstance.name,
            downloadUrl: primaryFile.url,
            filename: primaryFile.filename,
          })
        } else if (projectType === "resourcepack") {
          await invoke<string>("download_resourcepack", {
            instanceName: selectedInstance.name,
            downloadUrl: primaryFile.url,
            filename: primaryFile.filename,
          })
        } else if (projectType === "shader") {
          await invoke<string>("download_shaderpack", {
            instanceName: selectedInstance.name,
            downloadUrl: primaryFile.url,
            filename: primaryFile.filename,
          })
        }

        setInstalledFiles(prev => new Set(prev).add(primaryFile.filename))
        setInstallProgress(prev => ({ ...prev, current: i + 1 }))
      } catch (error) {
        console.error(`Failed to install ${project.title}:`, error)
        setInstallProgress(prev => ({ ...prev, current: i + 1, failed: prev.failed + 1 }))
      }
    }

    setIsInstallingAll(false)
  }

  const formatDownloads = (downloads: number): string => {
    if (downloads >= 1000000) return `${(downloads / 1000000).toFixed(1)}M`
    if (downloads >= 1000) return `${(downloads / 1000).toFixed(1)}K`
    return downloads.toString()
  }

  const totalFavorites = favoriteMods.size + favoriteResourcePacks.size + favoriteShaderPacks.size

  return (
    <div className="max-w-7xl mx-auto">
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
          );
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
            rgba(255, 255, 255, 0.14),
            rgba(255, 255, 255, 0.08)
          );
        }
      `}</style>

      {totalFavorites === 0 ? (
        <div className="text-center py-16">
          <Heart size={64} className="mx-auto mb-4 text-[#3a3f4b]" />
          <h3 className="text-xl font-semibold text-[#e6e6e6] mb-2">{t('favorites.noFavorites')}</h3>
          <p className="text-sm text-[#7d8590] mb-1">{t('favorites.addFavoritesHint')}</p>
          <p className="text-xs text-[#3a3f4b]">{t('favorites.clickHeartIcon')}</p>
        </div>
      ) : (
        <>
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 size={32} className="animate-spin text-[#16a34a] mx-auto" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-3">
                {favoriteProjects.map((project) => {
                  return (
                    <div
                      key={project.project_id}
                      className="blur-border rounded-md overflow-hidden bg-[#22252b]"
                    >
                      <div className="flex min-h-0 relative z-0">
                        {project.icon_url ? (
                          <div className="w-24 h-24 flex items-center justify-center flex-shrink-0 rounded m-2">
                            <img
                              src={project.icon_url}
                              alt={project.title}
                              className="w-full h-full object-contain rounded"
                            />
                          </div>
                        ) : (
                          <div className="w-24 h-24 bg-gradient-to-br from-[#16a34a]/10 to-[#22c55e]/10 flex items-center justify-center flex-shrink-0 rounded m-2">
                            <Package size={48} className="text-[#16a34a]" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 py-2 px-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-0">
                              <h3 className="font-semibold text-base text-[#e6e6e6] truncate">{project.title}</h3>
                              <span className="text-xs text-[#7d8590] whitespace-nowrap">by {project.author}</span>
                            </div>
                            <p className="text-sm text-[#7d8590] line-clamp-2 mb-2">{project.description}</p>
                            <div className="flex items-center gap-2 text-xs flex-wrap">
                              <span className="flex items-center gap-1 bg-[#181a1f] px-2 py-1 rounded text-[#7d8590]">
                                <Download size={12} />
                                {formatDownloads(project.downloads)}
                              </span>
                              {project.categories.slice(0, 2).map((category) => (
                                <span key={category} className="bg-[#181a1f] px-2 py-1 rounded text-[#7d8590]">
                                  {category}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

            <div className="bg-[#22252b] rounded-md p-5 sticky top-4 self-start border border-[#3a3f4b]">
                  <div className="text-center">
                    <Heart size={48} className="mx-auto mb-4 text-[#ef4444]" />
                    <h3 className="text-lg font-semibold text-[#e6e6e6] mb-2">{t('favorites.installAll.title')}</h3>
                    <p className="text-sm text-[#7d8590] mb-6">{t('favorites.installAll.description')}</p>
                    <button
                      onClick={handleInstallAllFavorites}
                      disabled={!selectedInstance || isInstallingAll || favoriteProjects.length === 0}
                      className="w-full px-4 py-3 bg-[#16a34a] hover:bg-[#22c55e] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isInstallingAll ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          {t('favorites.installAll.installing')} ({installProgress.current}/{installProgress.total})
                        </>
                      ) : (
                        <>
                          <Download size={16} />
                          {t('favorites.installAll.button')} ({favoriteProjects.length})
                        </>
                      )}
                    </button>
                    {installProgress.failed > 0 && (
                      <p className="text-xs text-[#ef4444] mt-2">
                        {t('favorites.installAll.failed', { count: installProgress.failed })}
                      </p>
                    )}
                    {!selectedInstance && favoriteProjects.length > 0 && (
                      <p className="text-xs text-[#7d8590] mt-3">
                        {t('favorites.installAll.selectInstance')}
                      </p>
                    )}
                  </div>
                </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}