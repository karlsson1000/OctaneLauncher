<script lang="ts">
  import { onMount } from "svelte"
  import { Package, FolderOpen, Copy, FileArchive, FolderSymlink, FolderX, Trash2, Play, Search, Plus, FolderPlus, ChevronDown, ChevronUp, Save, ClipboardCheck } from "lucide-svelte"
  import { invoke } from "@tauri-apps/api/core"
  import { instanceIconSrc } from "../../lib/icons"
  import type { Instance } from "../../types"
  import { getMinecraftVersion } from "../../lib/version"
  import ContextMenu from "../../components/ui/ContextMenu.svelte"

  import {
    store, setSelectedInstance, handleLaunch, handleCreateNew,
    handleShowDetails, handleOpenInstanceFolderByInstance,
    handleDuplicateInstance, handleDeleteInstance, handleKillInstance,
    setExportModal,
  } from "../../lib/launcherStore.svelte"
  import { storeGet, storeSet } from "../../lib/store"
  import { showToast } from "../../lib/toastStore.svelte"

  type SortOption = "recently-played" | "name-asc" | "name-desc"
  type Groups = Record<string, string[]>
  type LoaderMeta = { label: string; icon: string | null; accent: string }
  type MenuItem = {
    label?: string
    icon?: any
    onClick?: () => void
    danger?: boolean
    separator?: boolean
  }

  const SORT_CYCLE: SortOption[] = ["recently-played", "name-asc", "name-desc"]

  const SORT_LABELS: Record<SortOption, string> = {
    "recently-played": "Recently played",
    "name-asc": "Name (A–Z)",
    "name-desc": "Name (Z–A)",
  }

  const DEFAULT_GROUP = "__ungrouped__"
  const TOAST_MS = 5000

  const VANILLA: LoaderMeta = { label: "Vanilla", icon: null, accent: "bg-[#16a34a]" }
  const LOADERS: Record<string, LoaderMeta> = {
    fabric: { label: "Fabric", icon: "/loaders/fabric.png", accent: "bg-[#3b82f6]" },
    neoforge: { label: "NeoForge", icon: "/loaders/neoforge.png", accent: "bg-[#f97316]" },
    forge: { label: "Forge", icon: "/loaders/forge.png", accent: "bg-[#e05d2e]" },
  }

  const getLoaderMeta = (loader?: string | null): LoaderMeta => (loader && LOADERS[loader]) || VANILLA

  let contextMenu = $state<{ x: number; y: number; instance: Instance } | null>(null)
  let groupContextMenu = $state<{ x: number; y: number; group: string } | null>(null)
  let groups = $state<Groups>({})
  let groupsLoaded = $state(false)
  let collapsed = $state<Record<string, boolean>>({})
  let searchQuery = $state("")
  let sortBy = $state<SortOption>("recently-played")

  let groupModalInstance = $state<Instance | null>(null)
  let groupModalValue = $state("")
  let groupModalInputEl: HTMLInputElement | undefined = $state()

  onMount(async () => {
    const [savedGroups, savedCollapsed] = await Promise.all([
      storeGet<Groups>("instance_groups"),
      storeGet<Record<string, boolean>>("group_collapsed"),
    ])
    if (savedGroups) groups = savedGroups
    if (savedCollapsed) collapsed = savedCollapsed
    groupsLoaded = true
  })

  $effect(() => {
    if (groupModalInstance && groupModalInputEl) {
      const t = setTimeout(() => groupModalInputEl?.focus(), 50)
      return () => clearTimeout(t)
    }
  })

  $effect(() => {
    if (!groupsLoaded || store.instances.length === 0) return

    const existing = new Set(store.instances.map(i => i.name))
    let changed = false
    const next: Groups = {}
    for (const [group, names] of Object.entries(groups)) {
      const kept = names.filter(n => existing.has(n))
      if (kept.length !== names.length) changed = true
      if (kept.length > 0) next[group] = kept
    }
    if (changed) persistGroups(next)
  })

  async function persistGroups(next: Groups) {
    groups = next
    await storeSet("instance_groups", next)
  }

  async function persistCollapsed(next: Record<string, boolean>) {
    collapsed = next
    await storeSet("group_collapsed", next)
  }

  async function runOptionsCommand(command: string, instanceName: string, successMessage: string, errorPrefix: string) {
    try {
      await invoke(command, { instanceName })
      showToast("success", successMessage, TOAST_MS)
    } catch (error) {
      showToast("error", `${errorPrefix}: ${error}`, TOAST_MS)
    }
  }

  const handleSaveOptionsAsDefault = (name: string) =>
    runOptionsCommand("save_options_as_default", name, "Options saved", "Failed to save options")

  const handleApplySavedOptions = (name: string) =>
    runOptionsCommand("apply_saved_options", name, "Saved options applied", "Failed to apply options")

  function withoutInstance(source: Groups, instanceName: string): Groups {
    const next: Groups = {}
    for (const [group, names] of Object.entries(source)) {
      next[group] = names.filter(n => n !== instanceName)
    }
    return next
  }

  async function assignToGroup(instance: Instance, group: string) {
    const name = group.trim()
    if (!name || name === DEFAULT_GROUP) return
    const next = withoutInstance(groups, instance.name)
    next[name] = [...(next[name] ?? []), instance.name]
    await persistGroups(next)
  }

  const handleRemoveFromGroup = (instance: Instance) =>
    persistGroups(withoutInstance(groups, instance.name))

  async function handleDeleteGroup(group: string) {
    const { [group]: _removed, ...rest } = groups
    await persistGroups(rest)
    groupContextMenu = null
  }

  const toggleCollapsed = (group: string) =>
    persistCollapsed({ ...collapsed, [group]: !collapsed[group] })

  function openGroupModal(instance: Instance) {
    groupModalInstance = instance
    groupModalValue = ""
  }

  function closeGroupModal() {
    groupModalInstance = null
  }

  function submitGroupModal() {
    if (!groupModalInstance || !groupModalValue.trim()) return
    assignToGroup(groupModalInstance, groupModalValue)
    closeGroupModal()
  }

  function pickExistingGroup(group: string) {
    if (!groupModalInstance) return
    assignToGroup(groupModalInstance, group)
    closeGroupModal()
  }

  function openInstance(instance: Instance) {
    setSelectedInstance(instance)
    handleShowDetails(instance)
  }

  function handleQuickLaunch(instance: Instance) {
    setSelectedInstance(instance)
    handleLaunch(instance)
  }

  function handleContextMenu(e: MouseEvent, instance: Instance) {
    e.preventDefault()
    contextMenu = { x: e.clientX, y: e.clientY, instance }
  }

  function handleGroupHeaderContextMenu(e: MouseEvent, group: string) {
    e.preventDefault()
    groupContextMenu = { x: e.clientX, y: e.clientY, group }
  }

  function handleCycleSort() {
    const currentIndex = SORT_CYCLE.indexOf(sortBy)
    sortBy = SORT_CYCLE[(currentIndex + 1) % SORT_CYCLE.length]
  }

  function sortInstances(list: Instance[]) {
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "name-asc": return a.name.localeCompare(b.name)
        case "name-desc": return b.name.localeCompare(a.name)
        case "recently-played":
        default: {
          const aTime = a.last_played ? new Date(a.last_played).getTime() : 0
          const bTime = b.last_played ? new Date(b.last_played).getTime() : 0
          return bTime - aTime
        }
      }
    })
  }

  let sortIsDesc = $derived(sortBy === "recently-played" || sortBy === "name-desc")

  let filteredInstances = $derived(
    store.instances.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  let instanceToGroup = $derived.by(() => {
    const map = new Map<string, string>()
    for (const [group, names] of Object.entries(groups)) {
      for (const name of names) map.set(name, group)
    }
    return map
  })

  let namedGroups = $derived(Object.keys(groups))
  let hasAnyGroups = $derived(namedGroups.length > 0)

  let visibleNamedGroups = $derived(
    namedGroups.map(group => ({
      name: group,
      instances: sortInstances(filteredInstances.filter(i => instanceToGroup.get(i.name) === group)),
    }))
  )

  let ungrouped = $derived(
    sortInstances(filteredInstances.filter(i => !instanceToGroup.has(i.name)))
  )

  let contextMenuItems = $derived.by((): MenuItem[] => {
    const cm = contextMenu
    if (!cm) return []

    const { instance } = cm
    const closeMenu = () => { contextMenu = null }
    const currentGroup = instanceToGroup.get(instance.name)

    const items: MenuItem[] = [
      { label: "Open", icon: Package, onClick: () => openInstance(instance) },
      { label: "Open Folder", icon: FolderOpen, onClick: () => handleOpenInstanceFolderByInstance(instance) },
      { label: "Duplicate", icon: Copy, onClick: () => handleDuplicateInstance(instance) },
      { label: "Export", icon: FileArchive, onClick: () => { setExportModal(instance); closeMenu() } },
      { separator: true },
      { label: "Save Instance Options", icon: Save, onClick: () => { handleSaveOptionsAsDefault(instance.name); closeMenu() } },
      { label: "Apply Saved Options", icon: ClipboardCheck, onClick: () => { handleApplySavedOptions(instance.name); closeMenu() } },
      { separator: true },
      { label: "Add to group", icon: FolderPlus, onClick: () => { openGroupModal(instance); closeMenu() } },
    ]

    if (currentGroup) {
      items.push({ label: "Remove from group", icon: FolderX, onClick: () => { handleRemoveFromGroup(instance); closeMenu() }, danger: true })
    }

    const otherGroups = namedGroups.filter(g => g !== currentGroup)
    if (otherGroups.length > 0) {
      items.push({ separator: true })
      for (const g of otherGroups) {
        items.push({ label: `Move to "${g}"`, icon: FolderSymlink, onClick: () => { assignToGroup(instance, g); closeMenu() } })
      }
    }

    items.push(
      { separator: true },
      { label: "Delete", icon: Trash2, onClick: () => handleDeleteInstance(instance.name), danger: true },
    )
    return items
  })
</script>

{#snippet groupHeader(key: string, label: string, named: boolean)}
  <div
    role="presentation"
    class="flex items-center gap-1.5 mb-2 select-none"
    oncontextmenu={named ? (e) => handleGroupHeaderContextMenu(e, key) : undefined}
  >
    <ChevronDown
      size={16}
      strokeWidth={3}
      class="text-[var(--text-muted)] flex-shrink-0 transition-transform duration-150 {collapsed[key] ? '-rotate-90' : ''}"
    />
    <span
      role="button"
      tabindex="0"
      class="text-sm font-semibold text-[var(--text-muted)] truncate cursor-pointer"
      onclick={() => toggleCollapsed(key)}
      onkeydown={(e) => { if (e.key === 'Enter') toggleCollapsed(key) }}
    >{label}</span>
  </div>
{/snippet}

{#snippet instanceCard(instance: Instance)}
  {@const isRunning = store.runningInstances.has(instance.name)}
  {@const isLaunching = store.launchingInstanceName === instance.name}
  {@const isBusy = isRunning || isLaunching}
  {@const loader = getLoaderMeta(instance.loader)}
  {@const iconSrc = instanceIconSrc(instance.icon_path, instance.name)}
  <div
    role="button"
    tabindex="0"
    onclick={() => openInstance(instance)}
    oncontextmenu={(e) => handleContextMenu(e, instance)}
    onkeydown={(e) => { if (e.key === 'Enter') openInstance(instance) }}
    class="bg-[var(--bg-tertiary)] rounded-r-md cursor-pointer transition-all hover:brightness-120 group relative"
  >
    <div class="flex min-h-0 relative z-0 items-center">
      <div class="absolute -left-[3px] top-0 bottom-0 w-[3px] {loader.accent}"></div>

      <div class="relative flex-shrink-0">
        {#if iconSrc}
          <img src={iconSrc} alt={instance.name} class="w-[76px] h-[76px] object-cover rounded my-2 mr-2 ml-4" />
        {:else}
          <div class="w-[76px] h-[76px] bg-[var(--bg-secondary)] rounded my-2 mr-2 ml-4 flex items-center justify-center">
            <Package size={36} class="text-[var(--text-muted)]" />
          </div>
        {/if}
      </div>

      <div class="py-2 pl-3 flex-1 min-w-0 {isBusy ? 'pr-12' : 'pr-2 group-hover:pr-12'}">
        <div class="text-[18px] font-semibold text-[var(--text-primary)] truncate leading-tight">{instance.name}</div>
        <div class="h-px bg-gradient-to-r from-[var(--border-default)] to-transparent my-2.5"></div>
        <div class="flex items-center gap-2 text-xs flex-wrap">
          <span class="bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">{getMinecraftVersion(instance)}</span>
          <span class="bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)] flex items-center gap-1">
            {#if loader.icon}
              <img src={loader.icon} alt={loader.label} class="w-4 h-4" />
            {/if}
            {loader.label}
          </span>
        </div>
      </div>

      {#if store.isAuthenticated}
        <button
          title={isRunning ? "Stop instance" : "Launch instance"}
          onclick={(e) => {
            e.stopPropagation()
            if (isRunning) handleKillInstance(instance)
            else handleQuickLaunch(instance)
          }}
          disabled={store.launchingInstanceName !== null && !isRunning}
          class="flex-shrink-0 w-[54px] h-[54px] mr-4 flex items-center justify-center rounded cursor-pointer {isBusy ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'opacity-0 group-hover:opacity-100 bg-[#16a34a] hover:bg-[#15803d] text-[#181a1f]'} disabled:opacity-50"
        >
          {#if isBusy}
            <div class="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
          {:else}
            <Play size={28} fill="currentColor" strokeWidth={0} />
          {/if}
        </button>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet instanceGrid(list: Instance[])}
  <div class="grid grid-cols-2 gap-4 pl-1">
    {#each list as instance (instance.name)}
      {@render instanceCard(instance)}
    {/each}
  </div>
{/snippet}

<div class="p-8 space-y-4">
  <div class="max-w-7xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        {#if store.instances.length > 0}
          <div class="relative rounded-md bg-[var(--bg-tertiary)]">
            <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-20 pointer-events-none" strokeWidth={2} />
            <input
              type="text"
              placeholder="Search instances..."
              bind:value={searchQuery}
              class="w-72 bg-transparent rounded-md pl-9 pr-3 py-1.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition-all relative z-10"
            />
          </div>
        {/if}
      </div>
      <div class="flex items-center gap-2">
        {#if store.instances.length > 0}
          <button
            onclick={handleCycleSort}
            class="h-8 px-2.5 hover:bg-[var(--bg-tertiary)] rounded flex items-center gap-1.5 cursor-pointer group"
          >
            <span class="text-sm text-[var(--text-muted)] font-medium">Sort by:</span>
            <span class="text-sm text-[var(--text-muted)] group-hover:text-[var(--text-primary)] font-semibold">{SORT_LABELS[sortBy]}</span>
            {#if sortIsDesc}
              <ChevronDown size={14} class="text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" strokeWidth={2.5} />
            {:else}
              <ChevronUp size={14} class="text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" strokeWidth={2.5} />
            {/if}
          </button>
        {/if}
        <button
          onclick={handleCreateNew}
          class="px-4 h-8 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-md text-sm font-medium flex items-center gap-2 cursor-pointer"
        >
          <Plus size={16} />
          New
        </button>
      </div>
    </div>

    {#if store.instances.length === 0}
      <div class="flex flex-col items-center justify-center py-14">
        <Package size={48} class="text-[var(--text-muted)] mb-3" strokeWidth={1.5} />
        <h3 class="text-base font-semibold text-[var(--text-primary)] mb-1">No instances yet</h3>
        <p class="text-sm text-[var(--text-muted)] mb-4">Create your first instance to get started</p>
        <button
          onclick={handleCreateNew}
          class="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded font-medium text-sm flex items-center gap-2 cursor-pointer"
        >
          <Plus size={16} strokeWidth={2} />
          <span>Create Instance</span>
        </button>
      </div>
    {:else if filteredInstances.length === 0}
      <div class="rounded-md p-8 flex flex-col items-center justify-center">
        <Search size={48} class="text-[var(--text-primary)] mb-3" strokeWidth={1.5} />
        <h3 class="text-base font-semibold text-[var(--text-primary)] mb-1">No instances found</h3>
        <p class="text-sm text-[var(--text-muted)]">Try adjusting your search query</p>
      </div>
    {:else}
      <div class="space-y-5">
        {#each visibleNamedGroups as group (group.name)}
          <div>
            {@render groupHeader(group.name, group.name, true)}
            {#if !collapsed[group.name]}
              {@render instanceGrid(group.instances)}
            {/if}
          </div>
        {/each}

        {#if ungrouped.length > 0}
          <div>
            {#if hasAnyGroups}
              {@render groupHeader(DEFAULT_GROUP, "Ungrouped", false)}
            {/if}
            {#if !collapsed[DEFAULT_GROUP]}
              {@render instanceGrid(ungrouped)}
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

{#if contextMenu}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    onClose={() => contextMenu = null}
    items={contextMenuItems}
  />
{/if}

{#if groupContextMenu}
  {@const gcm = groupContextMenu}
  <ContextMenu
    x={gcm.x}
    y={gcm.y}
    onClose={() => groupContextMenu = null}
    items={[
      { label: "Delete group", icon: Trash2, onClick: () => handleDeleteGroup(gcm.group), danger: true },
    ]}
  />
{/if}

{#if groupModalInstance}
  {@const gmi = groupModalInstance}
  {@const otherGroups = namedGroups.filter(g => g !== instanceToGroup.get(gmi.name))}
  <div
    role="presentation"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm modal-backdrop"
    onclick={closeGroupModal}
    onkeydown={(e) => { if (e.key === 'Escape') closeGroupModal() }}
  >
    <div
      role="presentation"
      class="bg-[var(--content-bg)] rounded-md border border-[var(--border-subtle)] shadow-md w-80 modal-content p-5 space-y-4"
      onclick={(e) => e.stopPropagation()}
    >
      <div>
        <h3 class="text-lg font-semibold text-[var(--text-primary)] tracking-tight">Add to group</h3>
        <p class="text-[13px] text-[var(--text-muted)] mt-0.5 truncate">Move "{gmi.name}" into a group</p>
      </div>

      {#if otherGroups.length > 0}
        <div class="flex flex-col max-h-48 overflow-y-auto custom-scrollbar">
          {#each otherGroups as g (g)}
            <button
              onclick={() => pickExistingGroup(g)}
              class="flex items-center gap-2.5 px-2 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-sm cursor-pointer text-left"
            >
              <FolderOpen size={16} strokeWidth={2} class="text-[var(--text-muted)] flex-shrink-0" />
              <span class="truncate">{g}</span>
            </button>
          {/each}
          <div class="h-px bg-[var(--border-default)] my-1"></div>
        </div>
      {/if}

      <div class="flex gap-2">
        <input
          bind:this={groupModalInputEl}
          type="text"
          placeholder="New group name"
          bind:value={groupModalValue}
          onkeydown={(e) => {
            if (e.key === "Enter") submitGroupModal()
            if (e.key === "Escape") closeGroupModal()
          }}
          class="flex-1 min-w-0 h-9 bg-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-sm px-3 text-sm outline-none border border-transparent"
        />
        <button
          onclick={submitGroupModal}
          disabled={!groupModalValue.trim()}
          class="h-9 px-4 text-sm bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-md font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          Create
        </button>
      </div>
    </div>
  </div>
{/if}
