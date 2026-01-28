import { useEffect, useRef, useState } from "react"
import { Upload, RotateCcw, Loader2, User, X, Rotate3d } from "lucide-react"
import { useTranslation } from "react-i18next"

interface SkinsTabProps {
  activeAccount?: { uuid: string; username: string } | null
  isAuthenticated?: boolean
  invoke?: (command: string, args?: any) => Promise<any>
}

interface CachedSkin {
  url: string
  variant: "classic" | "slim"
  timestamp: number
}

interface RecentSkin {
  url: string
  variant: "classic" | "slim"
  timestamp: number
}

interface Cape {
  id: string
  state: string
  url: string
  alias: string
  icon?: string
}

export function SkinsTab(props: SkinsTabProps) {
  const { activeAccount, isAuthenticated, invoke } = props
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [skinVariant, setSkinVariant] = useState<"classic" | "slim">("classic")
  const [capes, setCapes] = useState<Cape[]>([])
  const [activeCape, setActiveCape] = useState<string | null>(null)
  const [loadingCapes, setLoadingCapes] = useState(false)
  const [recentSkins, setRecentSkins] = useState<RecentSkin[]>([])
  const [currentSkinHash, setCurrentSkinHash] = useState<string | null>(null)
  const [showCape, setShowCape] = useState(true)
  const [capeModalOpen, setCapeModalOpen] = useState(false)
  const [isClosingModal, setIsClosingModal] = useState(false)
  const [showBack, setShowBack] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const skinCacheRef = useRef<Map<string, CachedSkin>>(new Map())
  const lastProfileFetchRef = useRef<number>(0)
  const CACHE_DURATION = 15 * 60 * 1000
  const MIN_FETCH_INTERVAL = 10 * 1000

  // Load recent skins from persistent storage on mount
  useEffect(() => {
    if (!activeAccount || !invoke) {
      setRecentSkins([])
      return
    }
    
    loadRecentSkins()
  }, [activeAccount, invoke])

  // Load recent skins from Tauri storage
  const loadRecentSkins = async () => {
    if (!activeAccount || !invoke) return
    
    try {
      const result = await invoke("load_recent_skins", { 
        accountUuid: activeAccount.uuid 
      })
      
      if (result && Array.isArray(result)) {
        setRecentSkins(result)
      } else {
        setRecentSkins([])
      }
    } catch (err) {
      console.error("Failed to load recent skins:", err)
      setRecentSkins([])
    }
  }

  // Save a skin to recent skins
  const addToRecentSkins = async (url: string, variant: "classic" | "slim") => {
    if (!activeAccount || !invoke) return
    
    try {
      // Create the new recent skin entry
      const newSkin: RecentSkin = { url, variant, timestamp: Date.now() }
      
      // Update local state optimistically
      setRecentSkins(prev => {
        const filtered = prev.filter(s => s.url !== url)
        return [newSkin, ...filtered].slice(0, 3)
      })
      
      // Save to persistent storage
      await invoke("save_recent_skin", {
        accountUuid: activeAccount.uuid,
        skinUrl: url,
        variant: variant
      })
    } catch (err) {
      console.error("Failed to save recent skin:", err)
    }
  }

  useEffect(() => {
    loadUserSkin()
  }, [activeAccount])

  const getCapeImageName = (alias: string) => {
    const specialCases: Record<string, string> = {
      "follower's": "followers",
      "purple heart": "purple",
      "15th anniversary": "15th"
    }
    
    const lowerAlias = alias.toLowerCase()
    if (specialCases[lowerAlias]) {
      return specialCases[lowerAlias]
    }
    
    return lowerAlias.replace(/\s+/g, '_').replace(/['']/g, '')
  }

  const canFetchProfile = () => {
    const now = Date.now()
    const timeSinceLastFetch = now - lastProfileFetchRef.current
    return timeSinceLastFetch >= MIN_FETCH_INTERVAL
  }

  const loadUserSkin = async (forceRefresh: boolean = false) => {
    if (!isAuthenticated || !activeAccount || !invoke) {
      setLoading(false)
      setError(t('skins.errors.signInRequired'))
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const cacheKey = activeAccount.uuid
      const cached = skinCacheRef.current.get(cacheKey)
      const now = Date.now()
      
      // Use cache if available
      if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_DURATION) {
        const match = cached.url.match(/texture\/([a-f0-9]+)/)
        if (match) {
          setCurrentSkinHash(match[1])
        }
        setSkinVariant(cached.variant)
        setLoading(false)
        loadCapes()
        return
      }
      
      // Check rate limiting before fetching
      if (!canFetchProfile()) {
        console.log("Skipping profile fetch due to rate limiting, using cache")
        if (cached) {
          const match = cached.url.match(/texture\/([a-f0-9]+)/)
          if (match) {
            setCurrentSkinHash(match[1])
          }
          setSkinVariant(cached.variant)
        }
        setLoading(false)
        loadCapes()
        return
      }
      
      lastProfileFetchRef.current = now
      
      const skinData = await invoke("get_current_skin")
      
      if (skinData && skinData.url) {
        const variant = skinData.variant === "slim" ? "slim" : "classic"
        
        const match = skinData.url.match(/texture\/([a-f0-9]+)/)
        if (match) {
          setCurrentSkinHash(match[1])
        }
        
        setSkinVariant(variant)
        
        skinCacheRef.current.set(cacheKey, {
          url: skinData.url,
          variant: variant,
          timestamp: now
        })
        
        setLoading(false)
        loadCapes()
      } else {
        setCurrentSkinHash(null)
        setLoading(false)
        loadCapes()
      }
    } catch (err: any) {
      console.error("Failed to load skin:", err)
      
      // Handle rate limiting
      if (err && typeof err === 'string' && err.includes('429')) {
        setError(t('skins.errors.rateLimited') || 'Rate limited. Please wait before refreshing.')
        // Keep showing cached skin if available
        const cached = skinCacheRef.current.get(activeAccount.uuid)
        if (cached) {
          const match = cached.url.match(/texture\/([a-f0-9]+)/)
          if (match) {
            setCurrentSkinHash(match[1])
          }
          setSkinVariant(cached.variant)
        }
      } else {
        setError(`${t('skins.errors.loadFailed')}: ${err}`)
        setCurrentSkinHash(null)
      }
      
      setLoading(false)
    }
  }

  const loadCapes = async () => {
    if (!invoke || !isAuthenticated) return

    try {
      setLoadingCapes(true)
      const capeData = await invoke("get_user_capes")
      
      if (capeData && capeData.capes) {
        setCapes(capeData.capes)
        const active = capeData.capes.find((cape: Cape) => cape.state === "ACTIVE")
        const activeCapeId = active?.id || null
        setActiveCape(activeCapeId)
        setShowCape(!!activeCapeId)
      }
    } catch (err) {
      console.error("Failed to load capes:", err)
    } finally {
      setLoadingCapes(false)
    }
  }

  const handleCapeSelect = async (capeId: string) => {
    if (!invoke) return

    try {
      await invoke("equip_cape", { capeId })
      setActiveCape(capeId)
      setShowCape(true)
      handleCloseCapeModal()
    } catch (err) {
      console.error("Failed to equip cape:", err)
      setError(`${t('skins.errors.equipCapeFailed')}: ${err}`)
    }
  }

  const handleCapeRemove = async () => {
    if (!invoke) return
    
    try {
      await invoke("remove_cape")
      setActiveCape(null)
      setShowCape(false)
      handleCloseCapeModal()
    } catch (err) {
      console.error("Failed to remove cape:", err)
      setError(`${t('skins.errors.removeCapeFailed')}: ${err}`)
    }
  }

  const handleCloseCapeModal = () => {
    setIsClosingModal(true)
    setTimeout(() => {
      setIsClosingModal(false)
      setCapeModalOpen(false)
    }, 150)
  }

  const handleRotate = () => {
    setShowBack((prev) => !prev)
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !invoke) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64Data = e.target?.result as string
      const base64 = base64Data.split(',')[1]

      setUploading(true)
      setError(null)

      try {
        const result = await invoke("upload_skin", {
          skinData: base64,
          variant: skinVariant
        })

        if (result && result.url) {
          const match = result.url.match(/texture\/([a-f0-9]+)/)
          if (match) {
            setCurrentSkinHash(match[1])
          }
          
          const variant = result.variant === "slim" ? "slim" : "classic"
          setSkinVariant(variant)
          
          if (activeAccount) {
            skinCacheRef.current.set(activeAccount.uuid, {
              url: result.url,
              variant: variant,
              timestamp: Date.now()
            })
          }
          
          // Add to recent skins
          await addToRecentSkins(result.url, variant)
        } else {
          // Fallback
          setTimeout(() => {
            loadUserSkin(false)
          }, 2000)
        }
        
        setError(null)
      } catch (err) {
        setError(`${t('skins.errors.uploadFailed')}: ${err}`)
      } finally {
        setUploading(false)
      }
    }

    reader.readAsDataURL(file)
  }

  const handleReset = async () => {
    if (!invoke) return

    setResetting(true)
    setError(null)

    try {
      await invoke("reset_skin")
      
      if (activeAccount) {
        skinCacheRef.current.delete(activeAccount.uuid)
      }
      
      // Wait before refreshing to avoid rate limits
      setTimeout(() => {
        loadUserSkin(false)
      }, 2000)
    } catch (err) {
      setError(`${t('skins.errors.resetFailed')}: ${err}`)
    } finally {
      setResetting(false)
    }
  }

  const handleRecentSkinSelect = async (skin: RecentSkin) => {
    if (!invoke) return

    setUploading(true)
    setError(null)

    try {
      // Download the skin image
      const response = await fetch(skin.url)
      const blob = await response.blob()
      
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      // Upload the skin
      const result = await invoke("upload_skin", {
        skinData: base64,
        variant: skin.variant
      })

      // Update cache immediately
      if (result && result.url) {
        const match = result.url.match(/texture\/([a-f0-9]+)/)
        if (match) {
          setCurrentSkinHash(match[1])
        }
        
        const variant = result.variant === "slim" ? "slim" : "classic"
        setSkinVariant(variant)
        
        if (activeAccount) {
          skinCacheRef.current.set(activeAccount.uuid, {
            url: result.url,
            variant: variant,
            timestamp: Date.now()
          })
        }
      }
      
      // Move to top of recent skins
      await addToRecentSkins(skin.url, skin.variant)
      
      setError(null)
    } catch (err) {
      setError(`${t('skins.errors.applyFailed')}: ${err}`)
    } finally {
      setUploading(false)
    }
  }

  const getSkinRenderUrl = () => {
    if (!currentSkinHash) return null
    
    const variant = skinVariant === "slim" ? "slim" : "wide"
    const capeParam = activeCape ? "" : "&no=cape"
    const angleParam = showBack ? "&y=180" : ""

    return `https://vzge.me/full/512/${currentSkinHash}?${variant}${capeParam}${angleParam}`
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6 space-y-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-[#e6e6e6] tracking-tight">{t('skins.title')}</h1>
            <p className="text-sm text-[#7d8590] mt-0.5">{t('skins.subtitle')}</p>
          </div>
          
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-300px)]">
            <User size={64} className="text-[#4572e3] mb-4" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-[#e6e6e6] mb-1">{t('skins.signInRequired.title')}</h3>
            <p className="text-sm text-[#7d8590]">{t('skins.signInRequired.description')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes scaleIn {
          from { 
            opacity: 0;
            transform: scale(0.95);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes scaleOut {
          from { 
            opacity: 1;
            transform: scale(1);
          }
          to { 
            opacity: 0;
            transform: scale(0.95);
          }
        }
        .modal-backdrop {
          animation: fadeIn 0.15s ease-out forwards;
        }
        .modal-backdrop.closing {
          animation: fadeOut 0.15s ease-in forwards;
        }
        .modal-content {
          animation: scaleIn 0.15s ease-out forwards;
        }
        .modal-content.closing {
          animation: scaleOut 0.15s ease-in forwards;
        }

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
      `}</style>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[#e6e6e6] tracking-tight">{t('skins.title')}</h1>
            <p className="text-sm text-[#7d8590] mt-0.5">
              {activeAccount ? t('skins.viewingFor', { username: activeAccount.username }) : t('skins.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex gap-24 items-center justify-center">
          {/* Skin Viewer */}
          <div className="flex-shrink-0 self-start mt-8">
            <div className="flex flex-col items-center relative">
              {/* Rotate Button */}
              <button
                onClick={handleRotate}
                className="absolute top-0 -right-8 z-10 p-2 bg-[#22252b] hover:bg-[#2a2d35] text-[#e6e6e6] rounded-md transition-all cursor-pointer"
                title={t('skins.rotateTooltip')}
              >
                <Rotate3d size={20} />
              </button>

              <div className="rounded-md overflow-hidden bg-[#181a1f] p-4">

                {loading && (
                  <div className="w-[250px] h-[406px] flex items-center justify-center bg-[#181a1f] rounded-md">
                    <div className="text-center">
                      <Loader2 size={32} className="animate-spin text-[#16a34a] mx-auto mb-3" />
                      <p className="text-sm text-[#7d8590]">{t('skins.loadingSkin')}</p>
                    </div>
                  </div>
                )}
                
                {!loading && currentSkinHash && (
                  <img
                    src={getSkinRenderUrl() || ''}
                    alt={t('skins.skinRenderAlt')}
                    className="w-[250px] h-[406px]"
                    style={{ imageRendering: 'pixelated' }}
                  />
                )}
                
                {!loading && !currentSkinHash && (
                  <div className="w-[250px] h-[406px] flex items-center justify-center">
                    <p className="text-sm text-[#7d8590]">{t('skins.noSkinLoaded')}</p>
                  </div>
                )}
              </div>

              {/* Capes Button */}
              <button
                onClick={() => setCapeModalOpen(true)}
                className="mt-3 px-4 py-2 bg-[#22252b] hover:bg-[#2a2d35] text-[#e6e6e6] rounded-md text-sm font-medium transition-all cursor-pointer"
              >
                {t('skins.manageCapes')} {capes.length > 0 && `(${capes.length})`}
              </button>
            </div>
          </div>

          {/* Controls Panel */}
          <div className="flex-1 max-w-sm space-y-4">
            <div className="blur-border bg-[#22252b] rounded-md p-5">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-[#e6e6e6]">{t('skins.skinModel')}</h3>
              </div>
              
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setSkinVariant("classic")}
                  className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
                    skinVariant === "classic"
                      ? "bg-[#4572e3] text-white"
                      : "bg-[#181a1f] text-[#7d8590] hover:bg-[#1f2128] hover:text-[#e6e6e6]"
                  }`}
                >
                  {t('skins.variants.classic')}
                </button>
                <button
                  onClick={() => setSkinVariant("slim")}
                  className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
                    skinVariant === "slim"
                      ? "bg-[#4572e3] text-white"
                      : "bg-[#181a1f] text-[#7d8590] hover:bg-[#1f2128] hover:text-[#e6e6e6]"
                  }`}
                >
                  {t('skins.variants.slim')}
                </button>
              </div>

              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#16a34a] hover:bg-[#15803d] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-medium text-sm transition-all cursor-pointer"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{t('skins.uploading')}</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      <span>{t('skins.uploadButton')}</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleReset}
                  disabled={resetting || loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#181a1f] hover:bg-[#1f2128] disabled:opacity-50 disabled:cursor-not-allowed text-[#e6e6e6] rounded-md font-medium text-sm transition-all cursor-pointer"
                >
                  {resetting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{t('skins.resetting')}</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw size={16} />
                      <span>{t('skins.resetButton')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Recent Skins */}
            {recentSkins.length > 0 && (
              <div className="blur-border bg-[#22252b] rounded-md p-5">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-base font-semibold text-[#e6e6e6]">{t('skins.recentSkins')}</h3>
                </div>
                
                <div className="flex gap-3">
                  {recentSkins.map((skin, index) => {
                    // Extract texture hash from URL
                    const match = skin.url.match(/texture\/([a-f0-9]+)/)
                    const hash = match ? match[1] : null
                    // Use bust render from VZGE
                    const renderUrl = hash 
                      ? `https://vzge.me/bust/128/${hash}${skin.variant === 'slim' ? '?slim' : '?wide'}`
                      : skin.url
                    
                    return (
                      <button
                        key={`${skin.url}-${index}`}
                        onClick={() => handleRecentSkinSelect(skin)}
                        disabled={uploading}
                        className="bg-[#181a1f] rounded-md hover:ring-2 hover:ring-[#4572e3] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer overflow-hidden"
                        title={t('skins.recentSkinTooltip')}
                      >
                        <img
                          src={renderUrl}
                          alt={t('skins.recentSkinAlt')}
                          className="w-20 h-20"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            
            {error && (
              <div className="blur-border bg-[#22252b] rounded-md p-4">
                <p className="text-xs text-red-400 leading-relaxed">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cape Modal */}
      {capeModalOpen && (
        <div 
          className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 modal-backdrop ${isClosingModal ? 'closing' : ''}`}
          onClick={handleCloseCapeModal}
        >
          <div 
            className={`blur-border bg-[#181a1f] rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto modal-content ${isClosingModal ? 'closing' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-[#e6e6e6]">{t('skins.manageCapes')}</h2>
              <button
                onClick={handleCloseCapeModal}
                className="p-1 hover:bg-[#22252b] rounded-md transition-colors cursor-pointer"
              >
                <X size={20} className="text-[#7d8590]" />
              </button>
            </div>

            {loadingCapes ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-[#16a34a]" />
              </div>
            ) : capes.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-5 gap-3">
                  {capes.map((cape) => (
                    <button
                      key={cape.id}
                      onClick={() => handleCapeSelect(cape.id)}
                      className={`aspect-[5/8] bg-[#181a1f] rounded-md overflow-hidden flex flex-col items-center justify-center transition-all cursor-pointer hover:ring-2 hover:ring-[#4572e3] ${
                        activeCape === cape.id
                          ? "ring-2 ring-[#4572e3]"
                          : ""
                      }`}
                      title={cape.alias}
                    >
                      <img 
                        src={`/capes/${getCapeImageName(cape.alias)}.png`}
                        alt={cape.alias}
                        className="w-full h-full object-contain"
                        style={{ imageRendering: 'pixelated' }}
                        onError={(e) => {
                          e.currentTarget.src = '/logo.png'
                        }}
                      />
                    </button>
                  ))}
                </div>
                
                {activeCape && (
                  <button
                    onClick={handleCapeRemove}
                    className="w-full px-4 py-3 bg-[#22252b] hover:bg-[#2a2d35] text-[#e6e6e6] rounded-md text-sm font-medium transition-all cursor-pointer"
                  >
                    {t('skins.removeCape')}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-[#7d8590]">{t('skins.noCapesAvailable')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}