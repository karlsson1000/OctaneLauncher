import { useEffect, useRef, useState } from "react"
import * as skinview3d from "skinview3d"
import { Upload, RotateCcw, Loader2, User } from "lucide-react"

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

export function SkinsTab(props: SkinsTabProps) {
  const { activeAccount, isAuthenticated, invoke } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewerRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [skinVariant, setSkinVariant] = useState<"classic" | "slim">("classic")
  const skinCacheRef = useRef<Map<string, CachedSkin>>(new Map())
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  useEffect(() => {
    if (!canvasRef.current) return

    const viewer = new skinview3d.SkinViewer({
      canvas: canvasRef.current,
      width: 300,
      height: 500,
    })

    viewer.background = 0x0d0d0d
    viewer.zoom = 0.8
    viewer.autoRotate = true
    viewer.autoRotateSpeed = 0.2
    viewer.globalLight.intensity = 2.5
    viewer.cameraLight.intensity = 3.0
    
    viewerRef.current = viewer
    loadUserSkin(viewer)

    return () => {
      if (viewerRef.current) {
        viewerRef.current.dispose()
      }
    }
  }, [activeAccount])
  
  useEffect(() => {
    if (!viewerRef.current) return
    
    let animationId: number
    let lastTime = performance.now()
    
    function animate(currentTime: number) {
      if (viewerRef.current) {
        const deltaTime = currentTime - lastTime
        lastTime = currentTime
        
        if (viewerRef.current.autoRotate) {
          viewerRef.current.playerObject.rotation.y += (viewerRef.current.autoRotateSpeed * deltaTime) / 1000
        }
        
        viewerRef.current.render()
        animationId = requestAnimationFrame(animate)
      }
    }
    
    animationId = requestAnimationFrame(animate)
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [viewerRef.current])

  const loadUserSkin = async (viewer: any) => {
    if (!isAuthenticated || !activeAccount || !invoke) {
      setLoading(false)
      setError("Please sign in to view your skin")
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      // Check cache first
      const cacheKey = activeAccount.uuid
      const cached = skinCacheRef.current.get(cacheKey)
      const now = Date.now()
      
      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        // Use cached skin
        await viewer.loadSkin(cached.url)
        viewer.playerObject.skin.slim = cached.variant === "slim"
        setSkinVariant(cached.variant)
        viewer.render()
        setLoading(false)
        return
      }
      
      const skinData = await invoke("get_current_skin")
      
      if (skinData && skinData.url) {
        await viewer.loadSkin(skinData.url)
        
        const variant = skinData.variant === "slim" ? "slim" : "classic"
        viewer.playerObject.skin.slim = variant === "slim"
        setSkinVariant(variant)
        
        // Cache the skin data
        skinCacheRef.current.set(cacheKey, {
          url: skinData.url,
          variant: variant,
          timestamp: now
        })
        
        viewer.render()
        setLoading(false)
      } else {
        const defaultSkinUrl = `https://cravatar.eu/avatar/${activeAccount.username}/128.png`
        await viewer.loadSkin(defaultSkinUrl)
        
        // Cache default skin
        skinCacheRef.current.set(cacheKey, {
          url: defaultSkinUrl,
          variant: "classic",
          timestamp: now
        })
        
        viewer.render()
        setLoading(false)
      }
    } catch (err) {
      console.error("Failed to load skin:", err)
      setError(`Failed to load skin: ${err}`)
      setLoading(false)
      
      try {
        const steveSkinUrl = "https://textures.minecraft.net/texture/31f477eb1a7beee631c2ca64d06f8f68fa93a3386d04452ab27f43acdf1b60cb"
        await viewer.loadSkin(steveSkinUrl)
        viewer.render()
      } catch (fallbackErr) {
        console.error("Fallback skin also failed:", fallbackErr)
      }
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !invoke || !viewerRef.current) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64Data = e.target?.result as string
      const base64 = base64Data.split(',')[1]

      setUploading(true)
      setError(null)

      try {
        await invoke("upload_skin", {
          skinData: base64,
          variant: skinVariant
        })

        // Invalidate cache for this account
        if (activeAccount) {
          skinCacheRef.current.delete(activeAccount.uuid)
        }

        await loadUserSkin(viewerRef.current)
        
        setError(null)
      } catch (err) {
        setError(`Upload failed: ${err}`)
      } finally {
        setUploading(false)
      }
    }

    reader.readAsDataURL(file)
  }

  const handleReset = async () => {
    if (!invoke || !viewerRef.current) return

    setResetting(true)
    setError(null)

    try {
      await invoke("reset_skin")
      
      // Invalidate cache for this account
      if (activeAccount) {
        skinCacheRef.current.delete(activeAccount.uuid)
      }
      
      await loadUserSkin(viewerRef.current)
    } catch (err) {
      setError(`Reset failed: ${err}`)
    } finally {
      setResetting(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6 space-y-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-[#e8e8e8] tracking-tight">Skins</h1>
            <p className="text-sm text-[#808080] mt-0.5">Manage your Minecraft skin</p>
          </div>
          
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-300px)]">
            <User size={64} className="text-[#16a34a] mb-4" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-[#e8e8e8] mb-1">Sign In Required</h3>
            <p className="text-sm text-[#808080]">Please sign in with your Microsoft account to manage your skin</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[#e8e8e8] tracking-tight">Skins</h1>
            <p className="text-sm text-[#808080] mt-0.5">
              {activeAccount ? `Viewing skin for ${activeAccount.username}` : "Manage your Minecraft skin"}
            </p>
          </div>
        </div>

        <div className="flex gap-24 items-center justify-center">
          {/* 3D Skin Viewer */}
          <div className="flex-shrink-0">
            <div className="rounded-xl overflow-hidden relative">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d0d] bg-opacity-90 z-10 rounded-xl">
                  <div className="text-center">
                    <Loader2 size={32} className="animate-spin text-[#16a34a] mx-auto mb-3" />
                    <p className="text-sm text-[#808080]">Loading skin...</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-center p-4">
                <canvas 
                  ref={canvasRef}
                  className="rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Controls Panel */}
          <div className="flex-1 max-w-sm">
            <div className="bg-[#1a1a1a] rounded-xl p-5">
              <h3 className="text-base font-semibold text-[#e8e8e8] mb-4">Skin Model</h3>
              
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => {
                    setSkinVariant("classic")
                    if (viewerRef.current) {
                      viewerRef.current.playerObject.skin.slim = false
                      viewerRef.current.render()
                    }
                  }}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    skinVariant === "classic"
                      ? "bg-[#16a34a] text-white"
                      : "bg-[#0d0d0d] text-[#808080] hover:bg-[#1f1f1f] hover:text-[#e8e8e8]"
                  }`}
                >
                  Classic
                </button>
                <button
                  onClick={() => {
                    setSkinVariant("slim")
                    if (viewerRef.current) {
                      viewerRef.current.playerObject.skin.slim = true
                      viewerRef.current.render()
                    }
                  }}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    skinVariant === "slim"
                      ? "bg-[#16a34a] text-white"
                      : "bg-[#0d0d0d] text-[#808080] hover:bg-[#1f1f1f] hover:text-[#e8e8e8]"
                  }`}
                >
                  Slim
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
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#16a34a] hover:bg-[#15803d] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-all cursor-pointer"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      <span>Upload New Skin</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleReset}
                  disabled={resetting || loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0d0d0d] hover:bg-[#1f1f1f] disabled:opacity-50 disabled:cursor-not-allowed text-[#e8e8e8] rounded-lg font-medium text-sm transition-all cursor-pointer"
                >
                  {resetting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Resetting...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw size={16} />
                      <span>Reset to Default</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {error && (
              <div className="mt-4 bg-[#1a1a1a] rounded-lg p-4">
                <p className="text-xs text-red-400 leading-relaxed">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}