<script lang="ts">
  import { onMount } from "svelte"
  import { Package, FolderOpen, Copy, FileArchive, FolderSymlink, FolderX, Trash2, Search, Plus, FolderPlus, ChevronDown, Save, ClipboardCheck, LayoutGrid, List, Check } from "lucide-svelte"
  import { invoke } from "@tauri-apps/api/core"
  import type { Instance } from "../../types"
  import { getMinecraftVersion } from "../../lib/version"
  import ContextMenu from "../../components/ui/context-menu.svelte"
  import GroupHeader from "./components/group-header.svelte"
  import InstanceLayout from "./components/instance-layout.svelte"

  import {
    store, handleCreateNew,
    handleOpenInstanceFolderByInstance,
    handleDuplicateInstance, handleDeleteInstance,
    setExportModal, setSelectedInstance, handleShowDetails,
  } from "../../lib/launcherStore.svelte"
  import { storeGet, storeSet } from "../../lib/store"
  import { showToast } from "../../lib/toastStore.svelte"

  type SortOption = "recently-played" | "version" | "name-asc" | "name-desc"
  type Groups = Record<string, string[]>
  type MenuItem = {
    label?: string
    icon?: any
    onClick?: () => void
    danger?: boolean
    separator?: boolean
  }

  const SORT_LABELS: Record<SortOption, string> = {
    "recently-played": "Recently played",
    "version": "Minecraft version",
    "name-asc": "Name (A–Z)",
    "name-desc": "Name (Z–A)",
  }
  const SORT_OPTIONS = Object.keys(SORT_LABELS) as SortOption[]

  const DEFAULT_GROUP = "__ungrouped__"
  const TOAST_MS = 5000

  let contextMenu = $state<{ x: number; y: number; instance: Instance } | null>(null)
  let groupContextMenu = $state<{ x: number; y: number; group: string } | null>(null)
  let groups = $state<Groups>({})
  let groupsLoaded = $state(false)
  let collapsed = $state<Record<string, boolean>>({})
  let searchQuery = $state("")
  let sortBy = $state<SortOption>("recently-played")
  let layout = $state<"list" | "grid">("list")

  let groupModalInstance = $state<Instance | null>(null)
  let groupModalValue = $state("")
  let groupModalInputEl: HTMLInputElement | undefined = $state()
  let groupModalClosing = $state(false)
  let groupModalTimer: ReturnType<typeof setTimeout> | undefined

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
    if (groupModalTimer) clearTimeout(groupModalTimer)
    groupModalClosing = false
    groupModalInstance = instance
    groupModalValue = ""
  }

  function closeGroupModal() {
    if (groupModalClosing) return
    groupModalClosing = true
    groupModalTimer = setTimeout(() => {
      groupModalInstance = null
      groupModalClosing = false
    }, 150)
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

  function handleContextMenu(e: MouseEvent, instance: Instance) {
    e.preventDefault()
    contextMenu = { x: e.clientX, y: e.clientY, instance }
  }

  function handleGroupHeaderContextMenu(e: MouseEvent, group: string) {
    e.preventDefault()
    groupContextMenu = { x: e.clientX, y: e.clientY, group }
  }

  let isSortDropdownOpen = $state(false)
  let sortDropdownRef = $state<HTMLDivElement | undefined>(undefined)

  $effect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortDropdownRef && !sortDropdownRef.contains(event.target as Node)) isSortDropdownOpen = false
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  })

  function sortInstances(list: Instance[]) {
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "name-asc": return a.name.localeCompare(b.name)
        case "name-desc": return b.name.localeCompare(a.name)
        case "version": {
          const byVersion = getMinecraftVersion(b).localeCompare(getMinecraftVersion(a), undefined, { numeric: true })
          return byVersion !== 0 ? byVersion : a.name.localeCompare(b.name)
        }
        case "recently-played":
        default: {
          const aTime = a.last_played ? new Date(a.last_played).getTime() : 0
          const bTime = b.last_played ? new Date(b.last_played).getTime() : 0
          return bTime - aTime
        }
      }
    })
  }

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
      { label: "Open", icon: Package, onClick: () => { setSelectedInstance(instance); handleShowDetails(instance) } },
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
          <div class="relative" bind:this={sortDropdownRef}>
            <button
              onclick={() => isSortDropdownOpen = !isSortDropdownOpen}
              class="relative h-8 pl-3 pr-8 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] rounded-md flex items-center gap-1.5 cursor-pointer"
            >
              <span class="text-sm text-[var(--text-muted)] font-medium whitespace-nowrap">Sort by:</span>
              <span class="text-sm text-[var(--text-primary)] font-semibold whitespace-nowrap">{SORT_LABELS[sortBy]}</span>
              <span class="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-secondary)]">
                <ChevronDown size={16} strokeWidth={3} class="transition-transform {isSortDropdownOpen ? 'rotate-180' : ''}" />
              </span>
            </button>
            {#if isSortDropdownOpen}
              <div role="menu" class="dropdown-menu drop-right absolute right-0 z-[60] w-full min-w-[180px] bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] shadow-md rounded-md overflow-hidden p-1.5 flex flex-col mt-1.5">
                {#each SORT_OPTIONS as option (option)}
                  <button
                    type="button"
                    role="menuitem"
                    onclick={() => { sortBy = option; isSortDropdownOpen = false }}
                    class="w-full flex items-center justify-between gap-2.5 px-2 py-2 text-sm text-left rounded-sm cursor-pointer select-none text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                  >
                    <span class="truncate min-w-0">{SORT_LABELS[option]}</span>
                    {#if sortBy === option}
                      <Check size={15} strokeWidth={3} class="text-[var(--accent-primary)] shrink-0 ml-2" />
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
          <div class="grid grid-cols-2 gap-1 p-0.5 rounded-md bg-[var(--bg-tertiary)]">
            <button
              onclick={() => persistLayout("list")}
              title="List view"
              class="h-7 w-8 rounded-sm flex items-center justify-center cursor-pointer {layout === 'list' ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
            >
              <List size={18} strokeWidth={2.5} />
            </button>
            <button
              onclick={() => persistLayout("grid")}
              title="Grid view"
              class="h-7 w-8 rounded-sm flex items-center justify-center cursor-pointer {layout === 'grid' ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
            >
              <LayoutGrid size={18} strokeWidth={2.5} />
            </button>
          </div>
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
            <GroupHeader groupKey={group.name} label={group.name} named={true} collapsed={collapsed[group.name]} onToggle={toggleCollapsed} onHeaderContextMenu={handleGroupHeaderContextMenu} />
            {#if !collapsed[group.name]}
              <InstanceLayout instances={group.instances} {layout} onContextMenu={handleContextMenu} />
            {/if}
          </div>
        {/each}

        {#if ungrouped.length > 0}
          <div>
            {#if hasAnyGroups}
              <GroupHeader groupKey={DEFAULT_GROUP} label="Ungrouped" named={false} collapsed={collapsed[DEFAULT_GROUP]} onToggle={toggleCollapsed} onHeaderContextMenu={handleGroupHeaderContextMenu} />
            {/if}
            {#if !collapsed[DEFAULT_GROUP]}
              <InstanceLayout instances={ungrouped} {layout} onContextMenu={handleContextMenu} />
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
    class:closing={groupModalClosing}
    onclick={closeGroupModal}
    onkeydown={(e) => { if (e.key === 'Escape') closeGroupModal() }}
  >
    <div
      role="presentation"
      class="bg-[var(--content-bg)] rounded-md border border-[var(--border-subtle)] shadow-md w-80 modal-content p-5 space-y-4"
      class:closing={groupModalClosing}
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
