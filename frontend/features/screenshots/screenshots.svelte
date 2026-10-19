<script lang="ts">
  import { onMount } from "svelte"
  import { invoke, convertFileSrc } from "@tauri-apps/api/core"
  import { Package, Calendar, FolderOpen } from "lucide-svelte"
  import type { Screenshot } from "../../types"
  import { store } from "../../lib/launcherStore.svelte"
  import EmptyState from "./components/empty-state.svelte"
  import InstanceFilterDropdown from "./components/instance-filter-dropdown.svelte"
  import ScreenshotCard from "./components/screenshot-card.svelte"
  import ScreenshotViewer from "./components/screenshot-viewer.svelte"

  let screenshots = $state<Screenshot[]>([])
  let loading = $state(true)
  let loadError = $state(false)
  let selectedInstance = $state<string | null>(null)
  let sortBy = $state<"date" | "instance">("date")
  let viewerPath = $state<string | null>(null)

  let gridCols = $derived(store.showFriendsPanel ? "grid-cols-2" : "grid-cols-3")

  let instanceCounts = $derived(
    screenshots.reduce<Record<string, number>>((acc, s) => {
      acc[s.instance_name] = (acc[s.instance_name] || 0) + 1
      return acc
    }, {})
  )

  let sortedInstances = $derived(
    Object.entries(instanceCounts).sort(([a], [b]) => a.localeCompare(b))
  )

  let activeInstance = $derived(
    selectedInstance && selectedInstance in instanceCounts ? selectedInstance : null
  )

  let filteredScreenshots = $derived(
    screenshots
      .filter((s) => !activeInstance || s.instance_name === activeInstance)
      .sort((a, b) =>
        sortBy === "date"
          ? b.timestamp - a.timestamp
          : a.instance_name.localeCompare(b.instance_name) || b.timestamp - a.timestamp
      )
  )

  let viewerIndex = $derived(
    viewerPath === null ? -1 : filteredScreenshots.findIndex((s) => s.path === viewerPath)
  )
  let viewerShot = $derived(viewerIndex >= 0 ? filteredScreenshots[viewerIndex] : null)

  $effect(() => {
    if (viewerPath !== null && viewerIndex === -1) viewerPath = null
  })

  $effect(() => {
    const count = filteredScreenshots.length
    if (viewerIndex < 0 || count < 2) return
    for (const offset of [-1, 1]) {
      const neighbour = filteredScreenshots[(viewerIndex + offset + count) % count]
      if (neighbour) new Image().src = convertFileSrc(neighbour.path)
    }
  })

  async function loadScreenshots() {
    try {
      screenshots = await invoke<Screenshot[]>("get_all_screenshots")
      loadError = false
    } catch {
      loadError = true
    } finally {
      loading = false
    }
  }

  async function deleteScreenshot(s: Screenshot): Promise<boolean> {
    try {
      await invoke("delete_screenshot", { path: s.path })
      screenshots = screenshots.filter((x) => x.path !== s.path)
      return true
    } catch {
      return false
    }
  }

  async function deleteFromViewer(s: Screenshot) {
    const list = filteredScreenshots
    const i = list.findIndex((x) => x.path === s.path)
    const neighbour = list[i + 1] ?? list[i - 1] ?? null
    if (await deleteScreenshot(s)) viewerPath = neighbour?.path ?? null
  }

  async function openScreenshot(s: Screenshot) {
    try {
      await invoke("open_screenshot", { path: s.path })
    } catch {
    }
  }

  async function openScreenshotsFolder() {
    try {
      await invoke("open_screenshots_folder", { instanceName: activeInstance })
    } catch {
    }
  }

  function navigateViewer(delta: number) {
    const count = filteredScreenshots.length
    if (viewerIndex < 0 || count < 2) return
    viewerPath = filteredScreenshots[(viewerIndex + delta + count) % count].path
  }

  function handleWindowKeyDown(e: KeyboardEvent) {
    if (viewerShot) {
      if (e.key === "Escape") viewerPath = null
      else if (e.key === "ArrowLeft") navigateViewer(-1)
      else if (e.key === "ArrowRight") navigateViewer(1)
    }
  }

  onMount(loadScreenshots)
</script>

<svelte:window onkeydown={handleWindowKeyDown} onfocus={loadScreenshots} />

<div class="p-8 space-y-4">
  <div class="max-w-7xl mx-auto">
    {#if loading}
      <div class="animate-pulse" aria-busy="true">
        <div class="flex items-center justify-between mb-4">
          <div class="h-8 w-40 rounded bg-[var(--bg-tertiary)]"></div>
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-md bg-[var(--bg-tertiary)]"></div>
            <div class="w-28 h-8 rounded-md bg-[var(--bg-tertiary)]"></div>
            <div class="w-16 h-8 rounded-md bg-[var(--bg-tertiary)]"></div>
          </div>
        </div>
        <div class="grid {gridCols} gap-3">
          {#each { length: 8 } as _}
            <div class="aspect-video rounded-md bg-[var(--bg-tertiary)]"></div>
          {/each}
        </div>
      </div>
    {:else if loadError && screenshots.length === 0}
      <EmptyState
        title="Couldn't load screenshots"
        message="Something went wrong while reading your screenshots. Switch away and back to try again."
        isError
      />
    {:else}
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          {filteredScreenshots.length} screenshot{filteredScreenshots.length !== 1 ? "s" : ""}
        </h1>

        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={openScreenshotsFolder}
            class="w-8 h-8 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-md flex items-center justify-center cursor-pointer"
            title="Open screenshots folder"
            aria-label="Open screenshots folder"
          >
            <FolderOpen size={16} />
          </button>

          <InstanceFilterDropdown
            {activeInstance}
            {instanceCounts}
            {sortedInstances}
            total={screenshots.length}
            onSelect={(name) => (selectedInstance = name)}
          />

          <button
            type="button"
            onclick={() => (sortBy = sortBy === "date" ? "instance" : "date")}
            class="px-3 h-8 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-md text-sm flex items-center gap-2 cursor-pointer"
            title="Change sort order"
          >
            {#if sortBy === "date"}
              <Calendar size={14} />
              Date
            {:else}
              <Package size={14} />
              Instance
            {/if}
          </button>
        </div>
      </div>

      {#if filteredScreenshots.length === 0}
        {#if screenshots.length === 0}
          <EmptyState title="No screenshots yet" message="Take some screenshots in-game using F2 to see them here." />
        {:else}
          <EmptyState title="No results found" message="Try selecting a different instance or clearing your filter." />
        {/if}
      {:else}
        <div class="grid {gridCols} gap-3">
          {#each filteredScreenshots as screenshot (screenshot.path)}
            <ScreenshotCard
              {screenshot}
              onOpen={(s) => (viewerPath = s.path)}
              onOpenExternal={openScreenshot}
              onDelete={deleteScreenshot}
            />
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  {#if viewerShot}
    <ScreenshotViewer
      shot={viewerShot}
      index={viewerIndex}
      total={filteredScreenshots.length}
      onClose={() => (viewerPath = null)}
      onPrev={() => navigateViewer(-1)}
      onNext={() => navigateViewer(1)}
      onOpen={openScreenshot}
      onDelete={deleteFromViewer}
    />
  {/if}
</div>
