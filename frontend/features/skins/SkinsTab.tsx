import { useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Upload, Loader2, User, X, Rotate3d, Settings } from "lucide-react"
import type { RecentSkin, Cape } from "../../types"

interface SkinsTabProps {
  activeAccount?: { uuid: string; username: string } | null
  isAuthenticated?: boolean
}

const SKIN_CACHE_KEY = "octane_skin_cache"
const CAPE_CACHE_KEY = "octane_cape_cache"
const CACHE_DURATION = 15 * 60 * 1000
const MIN_FETCH_INTERVAL = 10 * 1000

const CAPE_IMAGE_MAP: Record<string, string> = {
  "migrator": "migrator",
  "pan": "pan",
  "15th anniversary": "15th",
  "common": "common",
  "vanilla": "vanilla",
  "cherry blossom": "cherry",
  "purple heart": "twitch",
  "follower's": "tiktok",
  "menace": "menace",
  "copper": "copper",
  "home": "home",
  "mojang office": "mojangoffice",
  "yearn": "yearn",
  "founders": "founders",
  "zombie horse": "zombiehorse",
  "mcc 15th year": "mcc",
  "builder": "builder",
  "minecraft experience": "mcexp",
  "minecon 2016": "2016",
  "minecon 2015": "2015",
  "minecon 2013": "2013",
  "minecon 2012": "2012",
  "crafter": "crafter",
  "minecon 2011": "2011",
  "moonlight trail": "moonlighttrail",
  "realms mapmaker": "realms",
  "mojang": "mojang",
  "mojang studios": "mojangstudios"
}

function loadCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch { return null }
}

function saveCache<T>(key: string, data: T) {
  try { sessionStorage.setItem(key, JSON.stringify(data)) } catch {}
}

type PersistedSkinCache = { uuid: string; url: string; variant: string; timestamp: number }
type PersistedCapeCache = { uuid: string; capes: Cape[]; activeCapeId: string | null; timestamp: number }

export function SkinsTab(props: SkinsTabProps) {
  const { activeAccount, isAuthenticated } = props
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
  const [skinSettingsOpen, setSkinSettingsOpen] = useState(false)
  const [settingsClosing, setSettingsClosing] = useState(false)
  const [showBack, setShowBack] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastProfileFetchRef = useRef<number>(0)
  const lastCapeFetchRef = useRef<Record<string, number>>({})

  useEffect(() => {
    if (!activeAccount || !invoke) { setRecentSkins([]); return }
    loadRecentSkins()
  }, [activeAccount, invoke])

  const loadRecentSkins = async () => {
    if (!activeAccount || !invoke) return
    try {
      const result = await invoke<RecentSkin[]>("load_recent_skins", { accountUuid: activeAccount.uuid })
      setRecentSkins(Array.isArray(result) ? result : [])
    } catch { setRecentSkins([]) }
  }

  const addToRecentSkins = async (url: string, variant: "classic" | "slim") => {
    if (!activeAccount || !invoke) return
    const newSkin: RecentSkin = { url, variant, timestamp: Date.now() }
    setRecentSkins(prev => [newSkin, ...prev.filter(s => s.url !== url)].slice(0, 3))
    try {
      await invoke<void>("save_recent_skin", { accountUuid: activeAccount.uuid, skinUrl: url, variant })
    } catch { console.error("Failed to save recent skin") }
  }

  useEffect(() => { loadUserSkin() }, [activeAccount])

  const getCapeImageName = (alias: string) => {
    return CAPE_IMAGE_MAP[alias.toLowerCase()] ?? "unknown"
  }

  const canFetchProfile = () => Date.now() - lastProfileFetchRef.current >= MIN_FETCH_INTERVAL
  const canFetchCapes = (uuid: string) => Date.now() - (lastCapeFetchRef.current[uuid] ?? 0) >= MIN_FETCH_INTERVAL

  const loadUserSkin = async (forceRefresh: boolean = false) => {
    if (!isAuthenticated || !activeAccount || !invoke) {
      setLoading(false)
      setError("Please sign in to view your skin")
      return
    }
    try {
      setLoading(true)
      setError(null)

      const now = Date.now()
      const persisted = loadCache<PersistedSkinCache>(SKIN_CACHE_KEY)
      const cacheValid = persisted && persisted.uuid === activeAccount.uuid && (now - persisted.timestamp) < CACHE_DURATION

      if (!forceRefresh && cacheValid) {
        const match = persisted!.url.match(/texture\/([a-f0-9]+)/)
        if (match) { setCurrentSkinHash(match[1]) }
        setSkinVariant(persisted!.variant as "classic" | "slim")
        setLoading(false)
        loadCapes()
        return
      }

      if (!canFetchProfile()) {
        if (cacheValid) {
          const match = persisted!.url.match(/texture\/([a-f0-9]+)/)
          if (match) { setCurrentSkinHash(match[1]) }
          setSkinVariant(persisted!.variant as "classic" | "slim")
        }
        setLoading(false)
        loadCapes()
        return
      }

      lastProfileFetchRef.current = now
      const skinData = await invoke<{ url: string; variant: string }>("get_current_skin")
      if (skinData && skinData.url) {
        const variant = skinData.variant === "slim" ? "slim" : "classic"
        const match = skinData.url.match(/texture\/([a-f0-9]+)/)
        if (match) { setCurrentSkinHash(match[1]) }
        setSkinVariant(variant)
        saveCache<PersistedSkinCache>(SKIN_CACHE_KEY, { uuid: activeAccount.uuid, url: skinData.url, variant, timestamp: now })
      } else {
        setCurrentSkinHash(null)
      }
      setLoading(false)
      loadCapes()
    } catch (err: any) {
      console.error("Failed to load skin:", err)
      if (err && typeof err === 'string' && err.includes('429')) {
        setError('Rate limited. Please wait before refreshing.')
        const persisted = loadCache<PersistedSkinCache>(SKIN_CACHE_KEY)
        if (persisted && persisted.uuid === activeAccount.uuid) {
          const match = persisted.url.match(/texture\/([a-f0-9]+)/)
          if (match) { setCurrentSkinHash(match[1]) }
          setSkinVariant(persisted.variant as "classic" | "slim")
        }
      } else {
        setError(`Failed to load skin: ${err}`)
        setCurrentSkinHash(null)
      }
      setLoading(false)
    }
  }

  const loadCapes = async () => {
    if (!invoke || !isAuthenticated || !activeAccount) return
    const now = Date.now()
    const persisted = loadCache<PersistedCapeCache>(CAPE_CACHE_KEY)
    const cacheValid = persisted && persisted.uuid === activeAccount.uuid && (now - persisted.timestamp) < CACHE_DURATION

    if (cacheValid) {
      setCapes(persisted!.capes)
      setActiveCape(persisted!.activeCapeId)
      return
    }

    setCapes([])
    setActiveCape(null)

    if (!canFetchCapes(activeAccount.uuid)) return

    try {
      setLoadingCapes(true)
      lastCapeFetchRef.current[activeAccount.uuid] = now
      const capeData = await invoke<{ capes: Cape[] }>("get_user_capes")
      if (capeData && capeData.capes) {
        setCapes(capeData.capes)
        const active = capeData.capes.find((cape: Cape) => cape.state === "ACTIVE")
        const activeId = active?.id || null
        setActiveCape(activeId)
        saveCache<PersistedCapeCache>(CAPE_CACHE_KEY, { uuid: activeAccount.uuid, capes: capeData.capes, activeCapeId: activeId, timestamp: now })
      }
    } catch { console.error("Failed to load capes") } finally { setLoadingCapes(false) }
  }

  const handleCloseSettings = () => {
    setSettingsClosing(true)
    setTimeout(() => { setSettingsClosing(false); setSkinSettingsOpen(false) }, 150)
  }

  const handleCapeSelect = async (capeId: string) => {
    if (!invoke) return
    try {
      await invoke<void>("equip_cape", { capeId })
      setActiveCape(capeId)
    } catch (err) { setError(`Failed to equip cape: ${err}`) }
  }

  const handleCapeRemove = async () => {
    if (!invoke) return
    try {
      await invoke<void>("remove_cape")
      setActiveCape(null)
    } catch (err) { setError(`Failed to remove cape: ${err}`) }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !invoke) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(',')[1]
      setUploading(true)
      setError(null)
      try {
        const result = await invoke<{ url: string; variant: string }>("upload_skin", { skinData: base64, variant: skinVariant })
        if (result && result.url) {
          const match = result.url.match(/texture\/([a-f0-9]+)/)
          if (match) { setCurrentSkinHash(match[1]) }
          const variant = result.variant === "slim" ? "slim" : "classic"
          setSkinVariant(variant)
          if (activeAccount) saveCache<PersistedSkinCache>(SKIN_CACHE_KEY, { uuid: activeAccount.uuid, url: result.url, variant, timestamp: Date.now() })
          await addToRecentSkins(result.url, variant)
        } else {
          setTimeout(() => loadUserSkin(false), 2000)
        }
        setError(null)
      } catch (err) { setError(`Upload failed: ${err}`) } finally { setUploading(false) }
    }
    reader.readAsDataURL(file)
  }

  const handleReset = async () => {
    if (!invoke) return
    setResetting(true)
    setError(null)
    try {
      await invoke<void>("reset_skin")
      sessionStorage.removeItem(SKIN_CACHE_KEY)
      setTimeout(() => loadUserSkin(false), 2000)
    } catch (err) { setError(`Reset failed: ${err}`) } finally { setResetting(false) }
  }

  const handleRecentSkinSelect = async (skin: RecentSkin) => {
    if (!invoke) return
    setUploading(true)
    setError(null)
    try {
      const response = await fetch(skin.url)
      const blob = await response.blob()
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      const result = await invoke<{ url: string; variant: string }>("upload_skin", { skinData: base64, variant: skin.variant })
      if (result && result.url) {
        const match = result.url.match(/texture\/([a-f0-9]+)/)
        if (match) { setCurrentSkinHash(match[1]) }
        const variant = result.variant === "slim" ? "slim" : "classic"
        setSkinVariant(variant)
        if (activeAccount) saveCache<PersistedSkinCache>(SKIN_CACHE_KEY, { uuid: activeAccount.uuid, url: result.url, variant, timestamp: Date.now() })
      }
      await addToRecentSkins(skin.url, skin.variant)
      setError(null)
    } catch (err) { setError(`Failed to apply skin: ${err}`) } finally { setUploading(false) }
  }

  const getSkinRenderUrl = () => {
    if (!currentSkinHash) return null
    const params: string[] = []
    if (skinVariant === "slim") params.push("alex")
    if (showBack) params.push("y=200")
    const qs = params.length > 0 ? `?${params.join("&")}` : ""
    return `https://renders.stellarmc.gg/full/${currentSkinHash}${qs}`
  }

  if (!isAuthenticated) {
    return (
      <div className="p-8 space-y-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">Sign In</h1>
          </div>
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-300px)]">
            <User size={64} className="text-[#4572e3] mb-4" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Sign In Required</h3>
            <p className="text-sm text-[var(--text-muted)]">Please sign in with your Microsoft account to manage your skin</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">{activeAccount?.username ?? "Skins"}</h1>
          </div>
          <button onClick={() => setSkinSettingsOpen(true)} className="p-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-md transition-all cursor-pointer">
            <Settings size={24} />
          </button>
        </div>

        <div className="flex gap-32 items-center justify-center">
          <div className="flex-shrink-0 self-start mt-8">
            <div className="flex flex-col items-center relative">
              <button onClick={() => setShowBack(prev => !prev)} className="absolute top-0 -right-8 z-10 p-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-md transition-all cursor-pointer">
                <Rotate3d size={20} />
              </button>
              <div className="rounded-md overflow-hidden p-4">
                <div className="w-[270px] h-[438px] flex items-center justify-center">
                  {loading && (
                    <div className="text-center">
                      <Loader2 size={32} className="animate-spin text-[#3b82f6] mx-auto mb-3" />
                      <p className="text-sm text-[var(--text-muted)]">Loading skin...</p>
                    </div>
                  )}
                  {!loading && currentSkinHash && (
                    <img src={getSkinRenderUrl() || ''} alt="Minecraft skin render" className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                  )}
                  {!loading && !currentSkinHash && (
                    <p className="text-sm text-[var(--text-muted)]">No skin loaded</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 max-w-sm space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Upload Skin</h3>
              <input ref={fileInputRef} type="file" accept="image/png" onChange={handleFileSelect} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading || loading} className="w-full aspect-[3/1] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] border-2 border-dashed border-[var(--bg-hover-strong)] rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                {uploading ? <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" /> : <><Upload size={20} className="text-[var(--text-muted)]" /><span className="text-sm text-[var(--text-muted)]">Upload Skin</span></>}
              </button>
            </div>

            {recentSkins.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Recent Skins</h3>
                <div className="grid grid-cols-3 gap-3">
                  {recentSkins.map((skin, index) => {
                    const match = skin.url.match(/texture\/([a-f0-9]+)/)
                    const hash = match ? match[1] : null
                    const renderUrl = hash ? `https://renders.stellarmc.gg/bust/${hash}${skin.variant === 'slim' ? '?slim' : ''}` : skin.url
                    return (
                      <button key={`${skin.url}-${index}`} onClick={() => handleRecentSkinSelect(skin)} disabled={uploading} className="aspect-square bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer overflow-hidden">
                        <img src={renderUrl} alt="Recent skin" className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-[var(--bg-tertiary)] rounded-md p-4">
                <p className="text-xs text-red-400 leading-relaxed">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {(skinSettingsOpen || settingsClosing) && (
        <div className={`fixed inset-0 bg-black/60 flex items-center justify-center z-50 modal-backdrop ${settingsClosing ? 'closing' : ''}`} onClick={handleCloseSettings}>
          <div className={`bg-[var(--bg-elevated)] rounded-lg p-5 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto modal-content ${settingsClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Skin Settings</h2>
              <button onClick={handleCloseSettings} className="p-1 hover:bg-[var(--bg-tertiary)] rounded-md transition-colors cursor-pointer">
                <X size={18} className="text-[var(--text-muted)]" />
              </button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Model</label>
                <div className="flex gap-2">
                  <button onClick={() => setSkinVariant("classic")} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer ${skinVariant === "classic" ? "bg-[#4572e3] text-white" : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"}`}>
                    Classic
                  </button>
                  <button onClick={() => setSkinVariant("slim")} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer ${skinVariant === "slim" ? "bg-[#4572e3] text-white" : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"}`}>
                    Slim
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Capes</label>
                {loadingCapes ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
                  </div>
                ) : capes.length > 0 ? (
                  <div className="grid grid-cols-6 gap-2">
                    {capes.map((cape) => (
                      <button
                        key={cape.id}
                        onClick={() => handleCapeSelect(cape.id)}
                        className={`group aspect-[5/8] bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover-strong)] rounded-md overflow-hidden flex items-center justify-center transition-all cursor-pointer relative ${activeCape === cape.id ? "ring-2 ring-[var(--accent-primary)]" : ""}`}
                      >
                        <img src={`/capes/${getCapeImageName(cape.alias)}.webp`} alt={cape.alias} className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} onError={(e) => { e.currentTarget.src = '/logo.png' }} />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded-md pointer-events-none" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">No capes available</p>
                )}
              </div>
              <div className="flex gap-2">
                {activeCape && (
                  <button onClick={handleCapeRemove} className="flex-1 px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-md text-sm font-medium transition-all cursor-pointer">
                    Remove Cape
                  </button>
                )}
                <button onClick={handleReset} disabled={resetting || loading} className={`${activeCape ? 'flex-1' : 'w-full'} px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-primary)] rounded-md text-sm font-medium transition-all cursor-pointer`}>
                  {resetting ? "Resetting..." : "Reset to Default"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}