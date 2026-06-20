import { useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Upload, Loader2, User, RotateCcw, Save, Plane, RectangleVertical } from "lucide-react"
import * as skinview3d from "skinview3d"
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
  "mojang studios": "mojangstudios",
}

function loadCache<T>(key: string): T | null {
  try { const raw = sessionStorage.getItem(key); return raw ? JSON.parse(raw) as T : null }
  catch { return null }
}

function saveCache<T>(key: string, data: T) {
  try { sessionStorage.setItem(key, JSON.stringify(data)) } catch {}
}

const canFetch = (last: number) => Date.now() - last >= MIN_FETCH_INTERVAL

type PersistedSkinCache = { uuid: string; url: string; variant: string; timestamp: number }
type PersistedCapeCache = { uuid: string; capes: Cape[]; activeCapeId: string | null; timestamp: number }

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)", padding: "3px 7px", borderRadius: 4,
          background: "var(--bg-secondary, #1a1a2e)", color: "var(--text-primary, #eee)",
          fontSize: 11, whiteSpace: "nowrap", pointerEvents: "none", zIndex: 100,
          border: "1px solid var(--border-color, #333)",
        }}>
          {label}
        </div>
      )}
    </div>
  )
}

function ToolBtn({ onClick, disabled, title, color, children }: {
  onClick?: () => void; disabled?: boolean; title: string; color?: string; children: React.ReactNode
}) {
  return (
    <Tooltip label={title}>
      <button
        onClick={onClick} disabled={disabled}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 34, height: 34, borderRadius: 6, border: "none",
          cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
          background: "transparent",
          color: color ?? "var(--text-muted)",
          transition: "background 0.15s, color 0.15s", flexShrink: 0,
        }}
        onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}
      >
        {children}
      </button>
    </Tooltip>
  )
}

function PillBtn({ onClick, active, children }: { onClick: () => void; active: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 10px", borderRadius: 8, border: "none",
        cursor: "pointer", fontSize: 13, fontWeight: 600, letterSpacing: "0.01em",
        background: active ? "var(--accent-primary, #4572e3)" : "var(--bg-secondary)",
        color: active ? "#fff" : "var(--text-muted)",
        transition: "background 0.15s, color 0.15s", flexShrink: 0, whiteSpace: "nowrap", boxSizing: "border-box",
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover, #2a2a3e)" }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-secondary)" }}
    >
      {children}
    </button>
  )
}

function ElytraToggle({ showElytra, onToggle }: { showElytra: boolean; onToggle: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Tooltip label={showElytra ? "Show as cape" : "Show as elytra"}>
      <button
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 34, height: 34, borderRadius: 6, border: "none",
          cursor: "pointer", background: hovered ? "var(--bg-hover)" : "transparent",
          color: "var(--text-muted)",
          transition: "background 0.15s", flexShrink: 0,
        }}
      >
        {showElytra ? <RectangleVertical size={20} strokeWidth={2.5} /> : <Plane size={20} strokeWidth={2.5} />}
      </button>
    </Tooltip>
  )
}

function CapeBar({ capes, activeCape, loadingCapes, getCapeImageName, onSelect, onRemove }: {
  capes: Cape[]; activeCape: string | null; loadingCapes: boolean
  getCapeImageName: (alias: string) => string; onSelect: (id: string) => void; onRemove: () => void
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  if (loadingCapes) return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <Loader2 size={14} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Capes…</span>
    </div>
  )
  if (capes.length === 0) return <span style={{ fontSize: 11, color: "var(--text-muted)" }}>No capes</span>

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      {capes.map(cape => {
        const isActive = activeCape === cape.id
        const isHovered = hoveredId === cape.id
        return (
          <Tooltip key={cape.id} label={cape.alias}>
            <div
              onClick={() => isActive ? onRemove() : onSelect(cape.id)}
              onMouseEnter={() => setHoveredId(cape.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: "pointer", flexShrink: 0, lineHeight: 0 }}
            >
            <div style={{
              width: 26, height: 38, borderRadius: 4,
              border: isHovered ? "2px solid var(--text-muted)" : "2px solid transparent",
              overflow: "hidden", background: "var(--bg-secondary)",
              transition: "border-color 0.15s", position: "relative",
            }}>
              <img
                src={`/capes/${getCapeImageName(cape.alias)}.webp`}
                alt={cape.alias}
                draggable={false}
                style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated", display: "block" }}
                onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = "/logo.png" }}
              />
              {isActive && (
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(0,0,0,0.45)",
                }}>
                  <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke={isHovered ? "#ef4444" : "#22c55e"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          </div>
          </Tooltip>
        )
      })}
    </div>
  )
}

function RecentSkinsBar({ recentSkins, uploading, onSelect }: {
  recentSkins: RecentSkin[]; uploading: boolean; onSelect: (skin: RecentSkin) => void
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      padding: "5px 6px", borderRadius: 12, background: "var(--bg-elevated)",
      backdropFilter: "blur(12px)", flexShrink: 0,
    }}>
      {recentSkins.map((skin, index) => {
        const match = skin.url.match(/texture\/([a-f0-9]+)/)
        const hash = match ? match[1] : null
        const bustUrl = hash
          ? `https://renders.stellarmc.gg/bust/${hash}${skin.variant === "slim" ? "?slim" : ""}`
          : skin.url
        const isHovered = hoveredIdx === index
        return (
          <Tooltip label="Apply recent skin" key={`${skin.url}-${index}`}>
          <button
            onClick={() => onSelect(skin)}
            disabled={uploading}
            onMouseEnter={() => setHoveredIdx(index)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{
              boxSizing: "border-box",
              width: 40, height: 40, borderRadius: 6, padding: 0,
              border: isHovered ? "2px solid var(--text-muted)" : "2px solid transparent",
              overflow: "hidden", background: "transparent",
              cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.4 : 1,
              transition: "border-color 0.15s", flexShrink: 0,
            }}
          >
            <img
              src={bustUrl} alt="Recent skin"
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "pixelated", display: "block" }}
            />
          </button>
          </Tooltip>
        )
      })}
    </div>
  )
}

interface SkinViewer3DProps {
  loading: boolean
  skinUrl: string | null
  capeUrl: string | null
  slim: boolean
  showElytra: boolean
  width: number
  height: number
  onViewerReady?: (viewer: skinview3d.SkinViewer | null) => void
}

function SkinViewer3D({ loading, skinUrl, capeUrl, slim, showElytra, width, height, onViewerReady }: SkinViewer3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewerRef = useRef<skinview3d.SkinViewer | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const viewer = new skinview3d.SkinViewer({
      canvas: canvasRef.current,
      width,
      height,
    })

    viewer.renderer.setClearColor(0x000000, 0)

    viewer.globalLight.intensity = 3.0
    viewer.cameraLight.intensity = 0.0

    viewer.animation = new skinview3d.IdleAnimation()
    viewer.animation.speed = 1

    viewer.controls.enabled = false

    viewer.fov = 70
    viewer.zoom = 0.6

    viewer.playerObject.rotation.y = 0.3

    viewer.camera.position.y += 8
    viewer.camera.lookAt(viewer.playerObject.position)

    viewerRef.current = viewer
    onViewerReady?.(viewer)

    return () => {
      viewer.dispose()
      viewerRef.current = null
      onViewerReady?.(null)
    }
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    if (skinUrl) {
      viewer.loadSkin(skinUrl, { model: slim ? "slim" : "default" })
    } else {
      viewer.loadSkin(null)
    }
  }, [skinUrl, slim])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    if (capeUrl) {
      viewer.loadCape(capeUrl, showElytra ? { backEquipment: "elytra" } : undefined)
    } else {
      viewer.loadCape(null)
    }
  }, [capeUrl, showElytra])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    viewer.width = width
    viewer.height = height
  }, [width, height])

  return (
    <div style={{ width, height, position: "relative", overflow: "hidden" }}>
      <img
        src="/skinstab/background.webp"
        alt=""
        aria-hidden
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", zIndex: 0,
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 1 }} />
      {loading && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 3,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "#3b82f6", marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>Loading skin…</p>
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{
          width, height, display: "block", position: "relative", zIndex: 2,
          opacity: loading ? 0 : 1, transition: "opacity 0.2s",
        }}
      />
    </div>
  )
}

export function SkinsTab({ activeAccount, isAuthenticated }: SkinsTabProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [skinVariant, setSkinVariant] = useState<"classic" | "slim">("classic")
  const [capes, setCapes] = useState<Cape[]>([])
  const [activeCape, setActiveCape] = useState<string | null>(null)
  const [loadingCapes, setLoadingCapes] = useState(false)
  const [showElytra, setShowElytra] = useState(false)
  const [recentSkins, setRecentSkins] = useState<RecentSkin[]>([])
  const [currentSkinUrl, setCurrentSkinUrl] = useState<string | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastProfileFetchRef = useRef<number>(0)
  const lastCapeFetchRef = useRef<Record<string, number>>({})

  const skinViewerRef = useRef<skinview3d.SkinViewer | null>(null)
  const dragRef = useRef<{ active: boolean; startX: number; startRot: number }>({
    active: false, startX: 0, startRot: 0.3,
  })
  const [hasPendingChanges, setHasPendingChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const originalRef = useRef<{ skinUrl: string | null; variant: 'classic' | 'slim'; activeCape: string | null }>({
    skinUrl: null, variant: 'classic', activeCape: null,
  })
  const pendingSkinOp = useRef<{ type: 'upload'; base64: string; variant: 'classic' | 'slim' } | { type: 'recent'; url: string; variant: 'classic' | 'slim' } | { type: 'reset' } | null>(null)
  const pendingCapeOp = useRef<{ type: 'select'; capeId: string } | { type: 'remove' } | null>(null)
  const loadUserSkinRef = useRef<(forceRefresh?: boolean) => Promise<void>>(async () => {})

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setContainerSize({ width: Math.round(width), height: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const activeCapeObj = capes.find(c => c.id === activeCape) ?? null
  const activeCapeUrl: string | null = activeCapeObj?.url ?? null

  useEffect(() => {
    if (currentSkinUrl?.startsWith('blob:')) URL.revokeObjectURL(currentSkinUrl)
    pendingSkinOp.current = null
    pendingCapeOp.current = null
    setHasPendingChanges(false)
  }, [activeAccount])

  useEffect(() => {
    if (!activeAccount) { setRecentSkins([]); return }
    loadRecentSkins()
  }, [activeAccount])

  useEffect(() => { loadUserSkin() }, [activeAccount])

  const loadRecentSkins = async () => {
    if (!activeAccount) return
    try {
      const result = await invoke<RecentSkin[]>("load_recent_skins", { accountUuid: activeAccount.uuid })
      setRecentSkins(Array.isArray(result) ? result : [])
    } catch { setRecentSkins([]) }
  }

  const addToRecentSkins = async (url: string, variant: "classic" | "slim") => {
    if (!activeAccount) return
    setRecentSkins(prev =>
      [{ url, variant, timestamp: Date.now() }, ...prev.filter(s => s.url !== url)].slice(0, 3)
    )
    try { await invoke<void>("save_recent_skin", { accountUuid: activeAccount.uuid, skinUrl: url, variant }) }
    catch { console.error("Failed to save recent skin") }
  }

  const applyUploadedSkin = (result: { url: string; variant: string }): "classic" | "slim" | null => {
    if (!result?.url) return null
    const variant: "classic" | "slim" = result.variant === "slim" ? "slim" : "classic"
    setSkinVariant(variant)
    setCurrentSkinUrl(result.url)
    if (activeAccount) {
      saveCache<PersistedSkinCache>(SKIN_CACHE_KEY, {
        uuid: activeAccount.uuid, url: result.url, variant, timestamp: Date.now(),
      })
    }
    return variant
  }

  const getCapeImageName = (alias: string) => CAPE_IMAGE_MAP[alias.toLowerCase()] ?? "unknown"

  const loadUserSkin = async (forceRefresh = false) => {
    if (!isAuthenticated || !activeAccount || !invoke) {
      setLoading(false); setError("Please sign in to view your skin"); return
    }
    try {
      setLoading(true); setError(null)
      const now = Date.now()
      const persisted = loadCache<PersistedSkinCache>(SKIN_CACHE_KEY)
      const cacheValid =
        persisted && persisted.uuid === activeAccount.uuid && (now - persisted.timestamp) < CACHE_DURATION

      const applyCached = () => {
        if (!cacheValid) return
        setCurrentSkinUrl(persisted!.url)
        setSkinVariant(persisted!.variant as "classic" | "slim")
        originalRef.current = { ...originalRef.current, skinUrl: persisted!.url, variant: persisted!.variant as "classic" | "slim" }
      }

      if (!forceRefresh && cacheValid) { applyCached(); setLoading(false); loadCapes(); return }
      if (!canFetch(lastProfileFetchRef.current)) { applyCached(); setLoading(false); loadCapes(); return }

      lastProfileFetchRef.current = now
      const skinData = await invoke<{ url: string; variant: string }>("get_current_skin")
      if (skinData?.url) {
        const variant = skinData.variant === "slim" ? "slim" : "classic"
        setCurrentSkinUrl(skinData.url)
        setSkinVariant(variant)
        originalRef.current = { ...originalRef.current, skinUrl: skinData.url, variant }
        saveCache<PersistedSkinCache>(SKIN_CACHE_KEY, {
          uuid: activeAccount.uuid, url: skinData.url, variant, timestamp: now,
        })
      } else {
        setCurrentSkinUrl(null)
      }
      setLoading(false); loadCapes()
    } catch (err: any) {
      if (typeof err === "string" && err.includes("429")) {
        setError("Rate limited — please wait before refreshing.")
        const persisted = loadCache<PersistedSkinCache>(SKIN_CACHE_KEY)
        if (persisted && persisted.uuid === activeAccount?.uuid) {
          setCurrentSkinUrl(persisted.url)
          setSkinVariant(persisted.variant as "classic" | "slim")
          originalRef.current = { ...originalRef.current, skinUrl: persisted.url, variant: persisted.variant as "classic" | "slim" }
        }
      } else {
        setError(`Failed to load skin: ${err}`); setCurrentSkinUrl(null)
      }
      setLoading(false)
    }
  }
  loadUserSkinRef.current = loadUserSkin

  const loadCapes = async () => {
    if (!isAuthenticated || !activeAccount) return
    const now = Date.now()
    const persisted = loadCache<PersistedCapeCache>(CAPE_CACHE_KEY)
    const cacheValid =
      persisted && persisted.uuid === activeAccount.uuid && (now - persisted.timestamp) < CACHE_DURATION
    if (cacheValid) {
      setCapes(persisted!.capes); setActiveCape(persisted!.activeCapeId)
      originalRef.current = { ...originalRef.current, activeCape: persisted!.activeCapeId }
      return
    }

    setCapes([]); setActiveCape(null)
    if (!canFetch(lastCapeFetchRef.current[activeAccount.uuid] ?? 0)) return
    try {
      setLoadingCapes(true)
      lastCapeFetchRef.current[activeAccount.uuid] = now
      const capeData = await invoke<{ capes: Cape[] }>("get_user_capes")
      if (capeData?.capes) {
        setCapes(capeData.capes)
        const activeId = capeData.capes.find((c: Cape) => c.state === "ACTIVE")?.id ?? null
        setActiveCape(activeId)
        originalRef.current = { ...originalRef.current, activeCape: activeId }
        saveCache<PersistedCapeCache>(CAPE_CACHE_KEY, {
          uuid: activeAccount.uuid, capes: capeData.capes, activeCapeId: activeId, timestamp: now,
        })
      }
    } catch { console.error("Failed to load capes") } finally { setLoadingCapes(false) }
  }

  const handleCapeSelect = async (capeId: string) => {
    setActiveCape(capeId)
    pendingCapeOp.current = { type: 'select', capeId }
    setHasPendingChanges(true)
  }

  const handleCapeRemove = async () => {
    setActiveCape(null)
    pendingCapeOp.current = { type: 'remove' }
    setHasPendingChanges(true)
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const localUrl = URL.createObjectURL(file)
    setUploading(true)
    setCurrentSkinUrl(localUrl)
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1]
      pendingSkinOp.current = { type: 'upload', base64, variant: skinVariant }
      setHasPendingChanges(true)
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  const handleReset = async () => {
    pendingSkinOp.current = { type: 'reset' }
    setHasPendingChanges(true)
  }

  const handleRecentSkinSelect = async (skin: RecentSkin) => {
    setCurrentSkinUrl(skin.url)
    setSkinVariant(skin.variant)
    pendingSkinOp.current = { type: 'recent', url: skin.url, variant: skin.variant }
    setHasPendingChanges(true)
  }

  const handleSave = async () => {
    setSaving(true); setError(null)
    let finalSkinUrl = currentSkinUrl
    let finalVariant = skinVariant
    let finalCape = activeCape
    try {
      const skinOp = pendingSkinOp.current
      if (skinOp) {
        if (skinOp.type === 'upload') {
          const result = await invoke<{ url: string; variant: string }>('upload_skin', { skinData: skinOp.base64, variant: skinVariant })
          const variant = applyUploadedSkin(result)
          finalSkinUrl = result.url
          finalVariant = variant ?? finalVariant
          if (variant) await addToRecentSkins(result.url, variant)
        } else if (skinOp.type === 'recent') {
          const response = await fetch(skinOp.url)
          const blob = await response.blob()
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve((reader.result as string).split(',')[1])
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          const result = await invoke<{ url: string; variant: string }>('upload_skin', { skinData: base64, variant: skinVariant })
          const variant = applyUploadedSkin(result)
          finalSkinUrl = result.url
          finalVariant = variant ?? finalVariant
          if (variant) await addToRecentSkins(result.url, variant)
        } else if (skinOp.type === 'reset') {
          await invoke<void>('reset_skin')
          sessionStorage.removeItem(SKIN_CACHE_KEY)
          setTimeout(() => loadUserSkinRef.current(false), 2000)
        }
      }

      const capeOp = pendingCapeOp.current
      if (capeOp) {
        if (capeOp.type === 'select') {
          await invoke<void>('equip_cape', { capeId: capeOp.capeId })
          finalCape = capeOp.capeId
        } else if (capeOp.type === 'remove') {
          await invoke<void>('remove_cape')
          finalCape = null
        }
        if (activeAccount) {
          const cached = loadCache<PersistedCapeCache>(CAPE_CACHE_KEY)
          if (cached?.uuid === activeAccount.uuid) {
            saveCache(CAPE_CACHE_KEY, { ...cached, activeCapeId: finalCape, timestamp: Date.now() })
          }
        }
      }

      if (currentSkinUrl?.startsWith('blob:')) URL.revokeObjectURL(currentSkinUrl)
      originalRef.current = { skinUrl: finalSkinUrl, variant: finalVariant, activeCape: finalCape }
      pendingSkinOp.current = null
      pendingCapeOp.current = null
      setHasPendingChanges(false)
    } catch (err) {
      setError(`Save failed: ${err}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    if (currentSkinUrl?.startsWith('blob:')) URL.revokeObjectURL(currentSkinUrl)
    pendingSkinOp.current = null
    pendingCapeOp.current = null
    setCurrentSkinUrl(originalRef.current.skinUrl)
    setSkinVariant(originalRef.current.variant)
    setActiveCape(originalRef.current.activeCape)
    setHasPendingChanges(false)
    setError(null)
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
            <p className="text-sm text-[var(--text-muted)]">
              Please sign in with your Microsoft account to manage your skin
            </p>
          </div>
        </div>
      </div>
    )
  }

  const viewer = (
    <SkinViewer3D
      loading={loading}
      skinUrl={currentSkinUrl}
      capeUrl={activeCapeUrl}
      slim={skinVariant === "slim"}
      showElytra={showElytra}
      width={containerSize.width}
      height={containerSize.height}
      onViewerReady={v => { skinViewerRef.current = v }}
    />
  )

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative", overflow: "hidden", height: "100%", boxSizing: "border-box",
        userSelect: "none", WebkitUserSelect: "none",
      }}
      onPointerDown={e => {
        if ((e.target as HTMLElement).closest("button, input")) return
        dragRef.current = {
          active: true,
          startX: e.clientX,
          startRot: skinViewerRef.current?.playerObject.rotation.y ?? 0.3,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={e => {
        if (!dragRef.current.active || !skinViewerRef.current) return
        const dx = e.clientX - dragRef.current.startX
        skinViewerRef.current.playerObject.rotation.y = dragRef.current.startRot + dx * 0.01
      }}
      onPointerUp={() => { dragRef.current.active = false }}
      onPointerCancel={() => { dragRef.current.active = false }}
    >
      <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        {viewer}
      </div>

      <div style={{ position: "relative", zIndex: 1, height: "100%", boxSizing: "border-box", padding: "32px 32px 88px" }}>
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
              {activeAccount?.username ?? "Skins"}
            </h1>
          </div>
        </div>

        {error && (
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            pointerEvents: "auto",
          }}>
            <div className="bg-[var(--bg-tertiary)] rounded-md p-4 max-w-sm w-full">
              <p className="text-xs text-red-400 leading-relaxed text-center">{error}</p>
            </div>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/png" onChange={handleFileSelect} className="hidden" />

      <div
        onPointerDown={e => e.stopPropagation()}
        style={{
          position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)",
          zIndex: 10, display: "flex", alignItems: "center", gap: 12,
          maxWidth: "calc(100% - 64px)", flexWrap: "wrap", justifyContent: "center",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: 12, background: "var(--bg-elevated)",
          backdropFilter: "blur(12px)", justifyContent: "center",
        }}>
          <ToolBtn onClick={() => fileInputRef.current?.click()} disabled={uploading || loading} title="Upload skin" color="#16a34a">
            {uploading
              ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
              : <Upload size={20} strokeWidth={2.5} />}
          </ToolBtn>
          <ToolBtn onClick={handleReset} disabled={loading} title="Reset to default skin">
            <RotateCcw size={20} strokeWidth={2.5} />
          </ToolBtn>
          <PillBtn onClick={() => setSkinVariant("classic")} active={skinVariant === "classic"}>Classic</PillBtn>
          <PillBtn onClick={() => setSkinVariant("slim")} active={skinVariant === "slim"}>Slim</PillBtn>
          {(loadingCapes || capes.length > 0) && (
            <>
              <CapeBar
                capes={capes}
                activeCape={activeCape}
                loadingCapes={loadingCapes}
                getCapeImageName={getCapeImageName}
                onSelect={handleCapeSelect}
                onRemove={handleCapeRemove}
              />
              {activeCapeUrl && <ElytraToggle showElytra={showElytra} onToggle={() => setShowElytra(v => !v)} />}
            </>
          )}
          {hasPendingChanges && (
            <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexShrink: 0 }}>
            <button
              onClick={handleDiscard}
              disabled={saving}
              style={{
                padding: "6px 16px", borderRadius: 8, border: "none",
                background: "var(--bg-secondary, #1a1a2e)", color: "var(--text-muted, #888)",
                cursor: saving ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600,
                opacity: saving ? 0.5 : 1, transition: "background 0.15s, opacity 0.15s",
              }}
              onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover, #2a2a3e)" }}
              onMouseLeave={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-secondary, #1a1a2e)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "6px 16px", borderRadius: 8, border: "none",
                background: "#16a34a", color: "#fff",
                cursor: saving ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600,
                opacity: saving ? 0.6 : 1, transition: "background 0.15s, opacity 0.15s",
                display: "flex", alignItems: "center", gap: 6,
              }}
              onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = "#15803d" }}
              onMouseLeave={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = "#16a34a" }}
            >
              {saving ? "Saving…" : <><Save size={16} strokeWidth={2.5} /> Save</>}
            </button>
          </div>
          )}
        </div>

        {recentSkins.length > 0 && (
          <RecentSkinsBar
            recentSkins={recentSkins}
            uploading={uploading}
            onSelect={handleRecentSkinSelect}
          />
        )}
      </div>
    </div>
  )
}