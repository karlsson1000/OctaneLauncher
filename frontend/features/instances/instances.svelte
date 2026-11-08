<script lang="ts">
  import { onMount } from "svelte"
  import { Package, FolderOpen, Copy, FileArchive, FolderSymlink, FolderX, Trash2, Search, Plus, FolderPlus, Save, ClipboardCheck } from "lucide-svelte"
  import { invoke } from "@tauri-apps/api/core"
  import type { Instance } from "../../types"
  import ContextMenu from "../../components/ui/context-menu.svelte"
  import Hero from "./library/hero.svelte"
  import Toolbar from "./library/toolbar.svelte"
  import InstanceGroups from "./library/instance-groups.svelte"
  import GroupModal from "./library/group-modal.svelte"
  import { sortInstances, type SortOption } from "./library/sort"
  import { buildInstanceToGroup, withoutInstance, DEFAULT_GROUP, type Groups } from "./library/groups"

  import {
    store, handleCreateNew,
    handleOpenInstanceFolderByInstance,
    handleDuplicateInstance, handleDeleteInstance, handleDeleteInstances,
    setExportModal, setSelectedInstance, handleShowDetails,
  } from "../../lib/launcherStore.svelte"
  import { storeGet, storeSet } from "../../lib/store"
  import { showToast } from "../../lib/toastStore.svelte"

  type MenuItem = {
    label?: string
    icon?: any
    onClick?: () => void
    danger?: boolean
    separator?: boolean
  }

  const TOAST_MS = 5000

  let contextMenu = $state<{ x: number; y: number; instance: Instance } | null>(null)
  let groupContextMenu = $state<{ x: number; y: number; group: string } | null>(null)
  let groups = $state<Groups>({})
  let groupsLoaded = $state(false)
  let collapsed = $state<Record<string, boolean>>({})
  let searchQuery = $state("")
  let sortBy = $state<SortOption>("recently-played")
  let layout = $state<"list" | "grid">("list")
  let selectMode = $state(false)
  let selected = $state<Set<string>>(new Set())
  let lastSelectedName = $state<string | null>(null)

  let groupModalInstance = $state<Instance | null>(null)

  onMount(async () => {
    const [savedGroups, savedCollapsed, savedLayout] = await Promise.all([
      storeGet<Groups>("instance_groups"),
      storeGet<Record<string, boolean>>("group_collapsed"),
      storeGet<"list" | "grid">("instances_layout"),
    ])
    if (savedGroups) groups = savedGroups
    if (savedCollapsed) collapsed = savedCollapsed
    if (savedLayout === "list" || savedLayout === "grid") layout = savedLayout
    groupsLoaded = true
  })

  async function persistLayout(next: "list" | "grid") {
    layout = next
    await storeSet("instances_layout", next)
  }

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

  function handleContextMenu(e: MouseEvent, instance: Instance) {
    e.preventDefault()
    contextMenu = { x: e.clientX, y: e.clientY, instance }
  }

  function handleGroupHeaderContextMenu(e: MouseEvent, group: string) {
    e.preventDefault()
    groupContextMenu = { x: e.clientX, y: e.clientY, group }
  }

  let filteredInstances = $derived(
    store.instances.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  let lastPlayedInstance = $derived<Instance | null>(
    [...store.instances]
      .filter(i => i.last_played)
      .sort((a, b) => new Date(b.last_played!).getTime() - new Date(a.last_played!).getTime())[0] ?? null
  )

  let instanceToGroup = $derived(buildInstanceToGroup(groups))
  let namedGroups = $derived(Object.keys(groups))
  let hasAnyGroups = $derived(namedGroups.length > 0)

  let visibleNamedGroups = $derived(
    namedGroups.map(group => ({
      name: group,
      instances: sortInstances(filteredInstances.filter(i => instanceToGroup.get(i.name) === group), sortBy),
    }))
  )

  let ungrouped = $derived(
    sortInstances(filteredInstances.filter(i => !instanceToGroup.has(i.name)), sortBy)
  )

  let visibleNames = $derived([
    ...visibleNamedGroups.flatMap(group => group.instances.map(i => i.name)),
    ...ungrouped.map(i => i.name),
  ])

  let allVisibleSelected = $derived(
    visibleNames.length > 0 && visibleNames.every(name => selected.has(name))
  )

  function exitSelectMode() {
    selectMode = false
    selected = new Set()
    lastSelectedName = null
  }

  function handleSelect(e: MouseEvent | KeyboardEvent, instance: Instance) {
    selectMode = true
    const name = instance.name
    if (e.shiftKey && lastSelectedName) {
      const from = visibleNames.indexOf(lastSelectedName)
      const to = visibleNames.indexOf(name)
      if (from !== -1 && to !== -1) {
        const next = new Set(selected)
        for (let i = Math.min(from, to); i <= Math.max(from, to); i++) next.add(visibleNames[i])
        selected = next
        return
      }
    }
    const next = new Set(selected)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    selected = next
    lastSelectedName = name
  }

  function toggleSelectAll() {
    selected = allVisibleSelected ? new Set() : new Set(visibleNames)
    lastSelectedName = null
  }

  const deleteSelected = () => handleDeleteInstances([...selected])

  $effect(() => {
    if (!selectMode) return
    const existing = new Set(store.instances.map(i => i.name))
    const kept = [...selected].filter(name => existing.has(name))
    if (kept.length === selected.size) return
    if (kept.length === 0) exitSelectMode()
    else selected = new Set(kept)
  })

  let contextMenuItems = $derived.by((): MenuItem[] => {
    const cm = contextMenu
    if (!cm) return []

    const { instance } = cm
    const closeMenu = () => { contextMenu = null }
    const currentGroup = instanceToGroup.get(instance.name)

    if (selected.size > 1 && selected.has(instance.name)) {
      return [
        {
          label: `Delete ${selected.size} instances`,
          icon: Trash2,
          onClick: () => { deleteSelected(); closeMenu() },
          danger: true,
        },
      ]
    }

    const items: MenuItem[] = [
      { label: "Open", icon: Package, onClick: () => { setSelectedInstance(instance); handleShowDetails(instance) } },
      { label: "Open Folder", icon: FolderOpen, onClick: () => handleOpenInstanceFolderByInstance(instance) },
      { label: "Duplicate", icon: Copy, onClick: () => handleDuplicateInstance(instance) },
      { label: "Export", icon: FileArchive, onClick: () => { setExportModal(instance); closeMenu() } },
      { separator: true },
      { label: "Save Instance Options", icon: Save, onClick: () => { handleSaveOptionsAsDefault(instance.name); closeMenu() } },
      { label: "Apply Saved Options", icon: ClipboardCheck, onClick: () => { handleApplySavedOptions(instance.name); closeMenu() } },
      { separator: true },
      { label: "Add to group", icon: FolderPlus, onClick: () => { groupModalInstance = instance; closeMenu() } },
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

<svelte:window onkeydown={(e) => { if (e.key === "Escape" && selectMode) exitSelectMode() }} />

<div class="p-8 space-y-4">
  <div class="max-w-7xl mx-auto">
    {#if lastPlayedInstance}
      <Hero instance={lastPlayedInstance} onContextMenu={handleContextMenu} />
    {/if}

    <Toolbar
      bind:searchQuery
      bind:sortBy
      {layout}
      hasInstances={store.instances.length > 0}
      {selectMode}
      selectedCount={selected.size}
      {allVisibleSelected}
      onToggleSelectAll={toggleSelectAll}
      onDeleteSelected={deleteSelected}
      onExitSelect={exitSelectMode}
      onSelectMode={() => selectMode = true}
      onLayoutChange={persistLayout}
    />

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
      <InstanceGroups
        groups={visibleNamedGroups}
        {ungrouped}
        {hasAnyGroups}
        {collapsed}
        {layout}
        selecting={selectMode}
        {selected}
        onContextMenu={handleContextMenu}
        onSelect={handleSelect}
        onToggle={toggleCollapsed}
        onGroupContextMenu={handleGroupHeaderContextMenu}
      />
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
  <GroupModal
    instance={gmi}
    groups={namedGroups.filter(g => g !== instanceToGroup.get(gmi.name))}
    onAssign={(group) => assignToGroup(gmi, group)}
    onClose={() => groupModalInstance = null}
  />
{/if}
