<script lang="ts">
  import { invoke } from "@tauri-apps/api/core"
  import { untrack } from "svelte"
  import type { RecentSkin, Cape } from "../../types"
  import { storeRemove } from "../../lib/store"
  import { store } from "../../lib/launcherStore.svelte"
  import {
    SKIN_CACHE_KEY, CAPE_CACHE_KEY, CACHE_DURATION, canFetch, loadCache, saveCache, normalizeCapeUrl,
    type PersistedSkinCache, type PersistedCapeCache,
  } from "./components/skin-cache"
  import SkinViewer from "./components/skin-viewer.svelte"
  import SkinsToolbar from "./components/skins-toolbar.svelte"
  import SkinsSignIn from "./components/skins-signin.svelte"

  let loading = $state(true)
  let error = $state<string | null>(null)
  let uploading = $state(false)
  let skinVariant = $state<"classic" | "slim">("classic")
  let capes = $state<Cape[]>([])
  let activeCape = $state<string | null>(null)
  let loadingCapes = $state(false)
  let showElytra = $state(false)
  let recentSkins = $state<RecentSkin[]>([])
  let currentSkinUrl = $state<string | null>(null)
  let hasPendingChanges = $state(false)
  let saving = $state(false)

  let fileInputEl: HTMLInputElement | undefined = $state()

  let skinResetTimeout: ReturnType<typeof setTimeout> | undefined
  let lastProfileFetch: Record<string, number> = {}
  let lastCapeFetch: Record<string, number> = {}
  let originalState = { skinUrl: null as string | null, variant: 'classic' as 'classic' | 'slim', activeCape: null as string | null }
  let pendingSkinOp: { type: 'upload'; base64: string } | { type: 'recent'; url: string } | { type: 'reset' } | null = null
  let pendingCapeOp: { type: 'select'; capeId: string } | { type: 'remove' } | null = null
  let loadUserSkinFn: (forceRefresh?: boolean) => Promise<void> = async () => {}

  let activeCapeObj = $derived(capes.find(c => c.id === activeCape) ?? null)
  let activeCapeUrl = $derived<string | null>(activeCapeObj?.url ?? null)

  let prevSkinUrl: string | undefined
  $effect(() => {
    store.activeAccount
    untrack(() => {
      if (prevSkinUrl?.startsWith('blob:')) URL.revokeObjectURL(prevSkinUrl)
      prevSkinUrl = currentSkinUrl ?? undefined
      pendingSkinOp = null
      pendingCapeOp = null
      hasPendingChanges = false
    })
  })

  $effect(() => {
    if (!store.activeAccount) { recentSkins = []; return }
    loadRecentSkins()
  })

  $effect(() => { loadUserSkin() })

  $effect(() => {
    const timeout = skinResetTimeout
    return () => clearTimeout(timeout)
  })

  async function loadRecentSkins() {
    if (!store.activeAccount) return
    try {
      const result = await invoke<RecentSkin[]>("load_recent_skins", { accountUuid: store.activeAccount.uuid })
      recentSkins = Array.isArray(result) ? result : []
    } catch { recentSkins = [] }
  }

  async function addToRecentSkins(url: string, variant: "classic" | "slim") {
    if (!store.activeAccount) return
    recentSkins = [{ url, variant, timestamp: Date.now() }, ...recentSkins.filter(s => s.url !== url)].slice(0, 3)
    try { await invoke<void>("save_recent_skin", { accountUuid: store.activeAccount.uuid, skinUrl: url, variant }) }
  catch { }
  }

  function applyUploadedSkin(result: { url: string; variant: string }): "classic" | "slim" | null {
    if (!result?.url) return null
    const variant: "classic" | "slim" = result.variant === "slim" ? "slim" : "classic"
    skinVariant = variant
    currentSkinUrl = result.url
    if (store.activeAccount) {
      saveCache<PersistedSkinCache>(SKIN_CACHE_KEY, {
        uuid: store.activeAccount.uuid, url: result.url, variant, timestamp: Date.now(),
      })
    }
    return variant
  }

  async function loadUserSkin(forceRefresh = false) {
    if (!store.isAuthenticated || !store.activeAccount) {
      loading = false; error = "Please sign in to view your skin"; return
    }
    try {
      loading = true; error = null
      const now = Date.now()
      const persisted = await loadCache<PersistedSkinCache>(SKIN_CACHE_KEY)
      const cacheValid =
        persisted && persisted.uuid === store.activeAccount.uuid && (now - persisted.timestamp) < CACHE_DURATION

      const applyCached = () => {
        if (!cacheValid) return
        currentSkinUrl = persisted!.url
        skinVariant = persisted!.variant as "classic" | "slim"
        originalState = { ...originalState, skinUrl: persisted!.url, variant: persisted!.variant as "classic" | "slim" }
      }

      if (!forceRefresh && cacheValid) { applyCached(); loading = false; loadCapes(); return }
      if (!canFetch(lastProfileFetch[store.activeAccount.uuid] ?? 0)) { applyCached(); loading = false; loadCapes(); return }

      lastProfileFetch[store.activeAccount.uuid] = now
      const skinData = await invoke<{ url: string; variant: string }>("get_current_skin")
      if (skinData?.url) {
        const variant = skinData.variant === "slim" ? "slim" : "classic"
        currentSkinUrl = skinData.url
        skinVariant = variant
        originalState = { ...originalState, skinUrl: skinData.url, variant }
        await saveCache<PersistedSkinCache>(SKIN_CACHE_KEY, {
          uuid: store.activeAccount.uuid, url: skinData.url, variant, timestamp: now,
        })
      } else {
        currentSkinUrl = null
      }
      loading = false; loadCapes()
    } catch (err: unknown) {
      if (typeof err === "string" && err.includes("429")) {
        error = "Rate limited — please wait before refreshing."
        const persisted = await loadCache<PersistedSkinCache>(SKIN_CACHE_KEY)
        if (persisted && persisted.uuid === store.activeAccount?.uuid) {
          currentSkinUrl = persisted.url
          skinVariant = persisted.variant as "classic" | "slim"
          originalState = { ...originalState, skinUrl: persisted.url, variant: persisted.variant as "classic" | "slim" }
        }
      } else {
        error = `Failed to load skin: ${String(err)}`; currentSkinUrl = null
      }
      loading = false
    }
  }
  loadUserSkinFn = loadUserSkin

  async function loadCapes() {
    if (!store.isAuthenticated || !store.activeAccount) return
    const now = Date.now()
    const persisted = await loadCache<PersistedCapeCache>(CAPE_CACHE_KEY)
    const cacheValid =
      persisted && persisted.uuid === store.activeAccount.uuid && (now - persisted.timestamp) < CACHE_DURATION
    if (cacheValid) {
      capes = persisted!.capes.map(c => ({ ...c, url: normalizeCapeUrl(c.url) })); activeCape = persisted!.activeCapeId
      originalState = { ...originalState, activeCape: persisted!.activeCapeId }
      return
    }

    capes = []; activeCape = null
    if (!canFetch(lastCapeFetch[store.activeAccount.uuid] ?? 0)) return
    try {
      loadingCapes = true
      lastCapeFetch[store.activeAccount.uuid] = now
      const capeData = await invoke<{ capes: Cape[] }>("get_user_capes")
      if (capeData?.capes) {
        capes = capeData.capes.map(c => ({ ...c, url: normalizeCapeUrl(c.url) }))
        const activeId = capeData.capes.find((c: Cape) => c.state === "ACTIVE")?.id ?? null
        activeCape = activeId
        originalState = { ...originalState, activeCape: activeId }
        await saveCache<PersistedCapeCache>(CAPE_CACHE_KEY, {
          uuid: store.activeAccount.uuid, capes: capeData.capes, activeCapeId: activeId, timestamp: now,
        })
      }
 } catch { } finally { loadingCapes = false }
  }

  function handleCapeSelect(capeId: string) {
    activeCape = capeId
    pendingCapeOp = { type: 'select', capeId }
    hasPendingChanges = true
  }

  function handleCapeRemove() {
    activeCape = null
    pendingCapeOp = { type: 'remove' }
    hasPendingChanges = true
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const localUrl = URL.createObjectURL(file)
    uploading = true
    currentSkinUrl = localUrl
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = ((e.target?.result) as string).split(",")[1]
      pendingSkinOp = { type: 'upload', base64 }
      hasPendingChanges = true
      uploading = false
    }
    reader.readAsDataURL(file)
  }

  function handleReset() {
    pendingSkinOp = { type: 'reset' }
    hasPendingChanges = true
  }

  function handleRecentSkinSelect(skin: RecentSkin) {
    currentSkinUrl = skin.url
    skinVariant = skin.variant
    pendingSkinOp = { type: 'recent', url: skin.url }
    hasPendingChanges = true
  }

  async function handleSave() {
    saving = true; error = null
    let finalSkinUrl = currentSkinUrl
    let finalVariant = skinVariant
    let finalCape = activeCape
    try {
      const skinOp = pendingSkinOp
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
          await storeRemove(SKIN_CACHE_KEY)
          skinResetTimeout = setTimeout(() => loadUserSkinFn(false), 2000)
        }
      }

      const capeOp = pendingCapeOp
      if (capeOp) {
        if (capeOp.type === 'select') {
          await invoke<void>('equip_cape', { capeId: capeOp.capeId })
          finalCape = capeOp.capeId
        } else if (capeOp.type === 'remove') {
          await invoke<void>('remove_cape')
          finalCape = null
        }
        if (store.activeAccount) {
          const cached = await loadCache<PersistedCapeCache>(CAPE_CACHE_KEY)
          if (cached?.uuid === store.activeAccount.uuid) {
            await saveCache(CAPE_CACHE_KEY, { ...cached, activeCapeId: finalCape, timestamp: Date.now() })
          }
        }
      }

      if (currentSkinUrl?.startsWith('blob:')) URL.revokeObjectURL(currentSkinUrl)
      originalState = { skinUrl: finalSkinUrl, variant: finalVariant, activeCape: finalCape }
      pendingSkinOp = null
      pendingCapeOp = null
      hasPendingChanges = false
    } catch (err) {
      error = `Save failed: ${err}`
    } finally {
      saving = false
    }
  }

  function handleDiscard() {
    if (currentSkinUrl?.startsWith('blob:')) URL.revokeObjectURL(currentSkinUrl)
    pendingSkinOp = null
    pendingCapeOp = null
    currentSkinUrl = originalState.skinUrl
    skinVariant = originalState.variant
    activeCape = originalState.activeCape
    hasPendingChanges = false
    error = null
  }
</script>

{#if !store.isAuthenticated}
  <SkinsSignIn />
{:else}
  <SkinViewer
    skinUrl={currentSkinUrl}
    variant={skinVariant}
    capeUrl={activeCapeUrl}
    {showElytra}
    {loading}
    {error}
    username={store.activeAccount?.username}
  >
    {#snippet children()}
      <input bind:this={fileInputEl} type="file" accept="image/png" onchange={handleFileSelect} class="hidden" />
      <SkinsToolbar
        {uploading}
        {loading}
        {skinVariant}
        {capes}
        {activeCape}
        {loadingCapes}
        {activeCapeUrl}
        {showElytra}
        {recentSkins}
        {hasPendingChanges}
        {saving}
        onUploadClick={() => fileInputEl?.click()}
        onReset={handleReset}
        onSelectVariant={(variant) => skinVariant = variant}
        onCapeSelect={handleCapeSelect}
        onCapeRemove={handleCapeRemove}
        onToggleElytra={() => showElytra = !showElytra}
        onRecentSelect={handleRecentSkinSelect}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    {/snippet}
  </SkinViewer>
{/if}
