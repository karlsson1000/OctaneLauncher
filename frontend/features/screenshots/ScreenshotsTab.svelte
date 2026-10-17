<script lang="ts">
  import { onMount } from "svelte"
  import { invoke, convertFileSrc } from "@tauri-apps/api/core"
  import { Camera, Package, X, Trash2, ExternalLink, ChevronLeft, ChevronRight, ChevronDown, Calendar, Check, FolderOpen, TriangleAlert } from "lucide-svelte"
  import type { Screenshot } from "../../types"
  import { formatFileSize, formatDate } from "../../lib/format"
  import { store } from "../../lib/launcherStore.svelte"

  let screenshots = $state<Screenshot[]>([])
  let loading = $state(true)
  let loadError = $state(false)
  let selectedInstance = $state<string | null>(null)
  let sortBy = $state<"date" | "instance">("date")
  let viewerPath = $state<string | null>(null)
  let isDropdownOpen = $state(false)
  let dropdownEl = $state<HTMLDivElement | undefined>(undefined)

  const viewerIconButton =
    "w-9 h-9 flex items-center justify-center rounded-md cursor-pointer shrink-0 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
  const viewerNavButton =
    "w-9 h-9 flex items-center justify-center rounded-md cursor-pointer shrink-0 bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:bg-[var(--accent-primary)] hover:text-white"

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

  function selectInstance(name: string | null) {
    selectedInstance = name
    isDropdownOpen = false
  }

  function navigateViewer(delta: number) {
    const count = filteredScreenshots.length
    if (viewerIndex < 0 || count < 2) return
    viewerPath = filteredScreenshots[(viewerIndex + delta + count) % count].path
  }

  $effect(() => {
    if (!isDropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (dropdownEl && !dropdownEl.contains(e.target as Node)) isDropdownOpen = false
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  })

  function handleWindowKeyDown(e: KeyboardEvent) {
    if (viewerShot) {
      if (e.key === "Escape") viewerPath = null
      else if (e.key === "ArrowLeft") navigateViewer(-1)
      else if (e.key === "ArrowRight") navigateViewer(1)
    } else if (e.key === "Escape" && isDropdownOpen) {
      isDropdownOpen = false
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) viewerPath = null
  }

  function handleCardKeyDown(e: KeyboardEvent, s: Screenshot) {
    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault()
      viewerPath = s.path
    }
  }

  function fadeIn(img: HTMLImageElement) {
    const show = () => img.classList.remove("opacity-0")
    if (img.complete) show()
    else {
      img.addEventListener("load", show, { once: true })
      img.addEventListener("error", show, { once: true })
    }
  }

  function focusDialog(node: HTMLElement) {
    const previouslyFocused = document.activeElement as HTMLElement | null
    node.focus()
    return { destroy: () => previouslyFocused?.focus?.() }
  }

  onMount(loadScreenshots)
</script>

<svelte:window onkeydown={handleWindowKeyDown} onfocus={loadScreenshots} />

{#snippet instanceOption(label: string, value: string | null)}
  <button
    type="button"
    role="menuitem"
    onclick={() => selectInstance(value)}
    class="w-full flex items-center justify-between gap-2.5 px-2 py-2 text-sm text-left rounded-sm cursor-pointer select-none text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
  >
    <span class="truncate min-w-0">{label}</span>
    {#if activeInstance === value}
      <Check size={15} strokeWidth={3} class="text-[var(--accent-primary)] shrink-0 ml-2" />
    {/if}
  </button>
{/snippet}

{#snippet emptyState(title: string, message: string, isError: boolean = false)}
  <div class="flex flex-col items-center justify-center py-16">
    {#if isError}
      <TriangleAlert size={56} class="text-[var(--text-muted)] mb-4" strokeWidth={1.5} />
    {:else}
      <Camera size={56} class="text-[var(--text-muted)] mb-4" strokeWidth={1.5} />
    {/if}
    <h3 class="text-lg font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
    <p class="text-sm text-[var(--text-muted)] text-center max-w-md">{message}</p>
  </div>
{/snippet}

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
      {@render emptyState(
        "Couldn't load screenshots",
        "Something went wrong while reading your screenshots. Switch away and back to try again.",
        true
      )}
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

          <div class="relative" bind:this={dropdownEl}>
            <button
              type="button"
              onclick={() => (isDropdownOpen = !isDropdownOpen)}
              aria-haspopup="menu"
              aria-expanded={isDropdownOpen}
              class="h-8 pl-3 pr-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-sm text-[var(--text-primary)] rounded-md flex items-center gap-2 cursor-pointer"
            >
              <span class="truncate">
                {activeInstance ? `${activeInstance} (${instanceCounts[activeInstance]})` : `All Instances (${screenshots.length})`}
              </span>
              <ChevronDown
                size={16}
                strokeWidth={3}
                class="shrink-0 text-[var(--text-secondary)] transition-transform {isDropdownOpen ? 'rotate-180' : ''}"
              />
            </button>

            {#if isDropdownOpen}
              <div
                role="menu"
                class="dropdown-menu absolute left-1/2 -translate-x-1/2 z-[60] w-full min-w-[190px] bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] shadow-md rounded-md overflow-hidden p-1.5 flex flex-col mt-1.5 max-h-60 overflow-y-auto custom-scrollbar"
              >
                {@render instanceOption(`All Instances (${screenshots.length})`, null)}
                {#each sortedInstances as [name, count] (name)}
                  {@render instanceOption(`${name} (${count})`, name)}
                {/each}
              </div>
            {/if}
          </div>

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
          {@render emptyState("No screenshots yet", "Take some screenshots in-game using F2 to see them here.")}
        {:else}
          {@render emptyState("No results found", "Try selecting a different instance or clearing your filter.")}
        {/if}
      {:else}
        <div class="grid {gridCols} gap-3">
          {#each filteredScreenshots as screenshot (screenshot.path)}
            <div
              role="button"
              tabindex="0"
              aria-label="View {screenshot.filename}"
              onclick={() => (viewerPath = screenshot.path)}
              onkeydown={(e) => handleCardKeyDown(e, screenshot)}
              class="group relative rounded-md overflow-hidden cursor-pointer screenshot-card"
            >
              <div class="aspect-video relative bg-[var(--bg-tertiary)]">
                <img
                  use:fadeIn
                  src={convertFileSrc(screenshot.path)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  class="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-200"
                />
                <div
                  class="absolute inset-x-0 bottom-0 p-2 pt-7 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none text-left"
                >
                  <p class="text-xs font-medium text-white truncate">{screenshot.instance_name}</p>
                  <div class="flex items-center justify-between text-[11px] text-white/70">
                    <span>{formatDate(screenshot.timestamp)}</span>
                    <span>{formatFileSize(screenshot.size)}</span>
                  </div>
                </div>
              </div>

              <div class="absolute top-2 right-2 flex items-center gap-0.5 p-0.5 rounded-md bg-[var(--bg-tertiary)] opacity-0 group-hover:opacity-100 has-[:focus-visible]:opacity-100 transition-opacity">
                <button
                  type="button"
                  onclick={(e) => {
                    e.stopPropagation()
                    openScreenshot(screenshot)
                  }}
                  class="w-7 h-7 flex items-center justify-center rounded text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
                  title="Open in default viewer"
                  aria-label="Open {screenshot.filename} in default viewer"
                >
                  <ExternalLink size={16} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onclick={(e) => {
                    e.stopPropagation()
                    deleteScreenshot(screenshot)
                  }}
                  class="w-7 h-7 flex items-center justify-center rounded cursor-pointer text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:text-red-400"
                  title="Delete screenshot"
                  aria-label="Delete {screenshot.filename}"
                >
                  <Trash2 size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  {#if viewerShot}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <div
      use:focusDialog
      role="dialog"
      aria-modal="true"
      aria-label="Screenshot viewer"
      tabindex="-1"
      class="fixed inset-0 bg-black/80 backdrop-blur-[3px] z-50 flex items-center justify-center outline-none"
      onclick={handleBackdropClick}
    >
      <div class="flex flex-col items-center gap-8">
        <img
          src={convertFileSrc(viewerShot.path)}
          alt={viewerShot.filename}
          class="max-w-[85vw] max-h-[80vh] object-contain rounded-md"
        />

        <div class="relative w-full max-w-[85vw] z-30">
          <div class="relative flex items-center gap-2 bg-[var(--bg-elevated)]/95 backdrop-blur-md rounded-lg px-3 py-2">
            {#if filteredScreenshots.length > 1}
              <span class="absolute left-1/2 -translate-x-1/2 text-base text-[var(--text-secondary)] select-none whitespace-nowrap pointer-events-none">
                {viewerIndex + 1} / {filteredScreenshots.length}
              </span>
            {/if}

            <button type="button" onclick={() => (viewerPath = null)} class="{viewerIconButton} hover:text-[var(--text-primary)]" title="Close" aria-label="Close">
              <X size={24} strokeWidth={2.5} />
            </button>

            <span class="text-base text-[var(--text-muted)] select-none flex-1 min-w-0 truncate whitespace-nowrap">{viewerShot.filename}</span>

            <button type="button" onclick={() => openScreenshot(viewerShot)} class="{viewerIconButton} hover:text-[var(--text-primary)]" title="Open in default viewer" aria-label="Open in default viewer">
              <ExternalLink size={20} strokeWidth={2.5} />
            </button>
            <button type="button" onclick={() => deleteFromViewer(viewerShot)} class="{viewerIconButton} hover:text-red-400" title="Delete" aria-label="Delete screenshot">
              <Trash2 size={20} strokeWidth={2.5} />
            </button>

            {#if filteredScreenshots.length > 1}
              <button type="button" onclick={() => navigateViewer(-1)} class={viewerNavButton} title="Previous" aria-label="Previous screenshot">
                <ChevronLeft size={24} strokeWidth={2.5} />
              </button>
              <button type="button" onclick={() => navigateViewer(1)} class={viewerNavButton} title="Next" aria-label="Next screenshot">
                <ChevronRight size={24} strokeWidth={2.5} />
              </button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>