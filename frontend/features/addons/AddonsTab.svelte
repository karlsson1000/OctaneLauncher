<script lang="ts">
  import { tick } from "svelte"
  import { Search, Check, Puzzle, Layers, Image, Sparkles, Package, X, ChevronUp } from "lucide-svelte"
  import AddonList from "./AddonList.svelte"
  import ProjectDetail from "./ProjectDetail.svelte"
  import { ADDON_CATEGORIES, type ContentSource } from "./adapters"
  import {
    store, setSelectedInstance, loadInstances,
    handleStartCreating, setAddonsSubTab
  } from "../../lib/launcherStore.svelte"
  import type { Instance } from "../../types"
  import { getMinecraftVersion } from "../../lib/version"
  import { instanceIconSrc } from "../../lib/icons"

  let viewDetail = $state<{
    source: "modrinth" | "curseforge"
    projectId: string
    projectSlug?: string
    projectType: string
    author?: string
  } | null>(null)

  let contentSource = $state<ContentSource>("modrinth")
  let showSourceDropdown = $state(false)

  $effect(() => {
    if (!showSourceDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest("[data-source-dropdown]") && !target.closest("[data-source-button]")) {
        showSourceDropdown = false
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  })
  let searchQuery = $state("")
  const moddedInstances = $derived(store.instances.filter(i => i.loader === "fabric" || i.loader === "neoforge" || i.loader === "forge"))

  $effect(() => {
    if (store.pendingAddonsSearch !== null) {
      searchQuery = store.pendingAddonsSearch
      store.pendingAddonsSearch = null
    }
  })

  const tabs = [
    { id: "mods" as const, label: "Mods", icon: Puzzle, color: "text-[#16a34a]" },
    { id: "modpacks" as const, label: "Modpacks", icon: Layers, color: "text-[#3b82f6]" },
    { id: "resourcepacks" as const, label: "Resource Packs", icon: Image, color: "text-[#8b5cf6]" },
    { id: "shaderpacks" as const, label: "Shader Packs", icon: Sparkles, color: "text-[#f59e0b]" },
  ]

  const getLoaderDisplay = (instance: Instance): { name: string; color: string } => {
    if (instance.loader === "fabric") return { name: "Fabric", color: "text-[#3b82f6]" }
    if (instance.loader === "neoforge") return { name: "NeoForge", color: "text-[#f97316]" }
    if (instance.loader === "forge") return { name: "Forge", color: "text-[#e05d2e]" }
    return { name: "Vanilla", color: "text-[#16a34a]" }
  }

  let listScroller: HTMLDivElement | undefined
  let savedListScroll = 0

  function handleViewProjectDetail(
    source: "modrinth" | "curseforge",
    projectId: string,
    projectSlug: string | undefined,
    projectType: string,
    author?: string,
  ) {
    savedListScroll = listScroller?.scrollTop ?? 0
    viewDetail = { source, projectId, projectSlug, projectType, author }
  }

  async function goBackToList() {
    viewDetail = null
    await tick()
    if (listScroller) listScroller.scrollTop = savedListScroll
  }

  let showInstallPicker = $state(false)
  let installPickerRef: HTMLDivElement | undefined = $state()
  const modpackTab = $derived(store.addonsSubTab === "modpacks")

  $effect(() => {
    if (!showInstallPicker) return
    const handleClickOutside = (e: MouseEvent) => {
      if (installPickerRef && !installPickerRef.contains(e.target as Node)) showInstallPicker = false
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  })
</script>

{#snippet installTargets(asMenu: boolean = false)}
  {#if moddedInstances.length === 0}
    <p class="text-xs text-[#3a3f4b] px-1">No modded instances</p>
  {:else}
    <div class={asMenu ? "flex flex-col" : "space-y-1.5"}>
      {#each moddedInstances as instance}
        {@const icon = instanceIconSrc(instance.icon_path, instance.name)}
        {@const loader = getLoaderDisplay(instance)}
        {@const selected = store.selectedInstance?.name === instance.name}
        <button
          onclick={() => { setSelectedInstance(instance); showInstallPicker = false }}
          class="w-full flex items-center text-left text-sm cursor-pointer text-[var(--text-primary)] {asMenu ? 'gap-2.5 px-2 py-2 rounded-sm select-none hover:bg-[var(--bg-hover)]' : `gap-3 px-3 py-1.5 rounded-md ${selected ? 'bg-[var(--bg-tertiary)]' : 'hover:bg-[var(--bg-tertiary)]'}`}"
        >
          {#if icon}
            <img src={icon} alt={instance.name} class="{asMenu ? 'w-8 h-8' : 'w-11 h-11'} rounded object-cover flex-shrink-0" />
          {:else}
            <div class="{asMenu ? 'w-8 h-8' : 'w-11 h-11'} flex items-center justify-center flex-shrink-0">
              <Package size={asMenu ? 20 : 28} class="text-[var(--text-muted)]" strokeWidth={1.5} />
            </div>
          {/if}
          <div class="flex-1 min-w-0">
            <div class="font-medium {asMenu ? 'text-sm' : 'text-base'} text-[var(--text-primary)] truncate leading-tight">{instance.name}</div>
            <div class="text-xs text-[var(--text-muted)] truncate mt-0.5">
              {getMinecraftVersion(instance)} <span class="text-[#3a3f4b]">•</span> <span class={loader.color}>{loader.name}</span>
            </div>
          </div>
          {#if selected}
            <Check size={18} class="flex-shrink-0 text-[#16a34a]" strokeWidth={3} />
          {/if}
        </button>
      {/each}
    </div>
  {/if}
{/snippet}

<div class="relative flex flex-col h-full overflow-hidden">
  <div class="flex-shrink-0 px-8 pt-8 pb-4">
    <div class="max-w-7xl mx-auto">
      <div class="flex items-center gap-4">
        {#each tabs as tab, index}
          {@const Icon = tab.icon}
          {@const isActive = store.addonsSubTab === tab.id}
          <button
            onclick={() => { setAddonsSubTab(tab.id); viewDetail = null }}
            class="flex items-center gap-2 text-2xl font-semibold tracking-tight cursor-pointer {isActive ? tab.color : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
          >
            <Icon size={24} strokeWidth={2} />
            <span>{tab.label}</span>
          </button>
          {#if index < tabs.length - 1}
            <div class="h-8 w-px bg-[var(--bg-hover-strong)]"></div>
          {/if}
        {/each}
      </div>
    </div>
  </div>

  {#if !viewDetail}
    <div class="flex-shrink-0 px-8 pb-4">
      <div class="max-w-7xl mx-auto">
        <div class="flex gap-2 items-stretch">
        <div class="relative">
          <button
            data-source-button
            onclick={() => showSourceDropdown = !showSourceDropdown}
            class="w-10 h-10 flex items-center justify-center bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] rounded-md cursor-pointer"
          >
            <img
              src={contentSource === "modrinth" ? "/modrinth.svg" : "/curseforge.svg"}
              alt={contentSource}
              class="w-6 h-6"
            />
          </button>
          {#if showSourceDropdown}
            <div data-source-dropdown class="dropdown-menu absolute top-full mt-2 left-0 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-md overflow-hidden z-50 min-w-[140px] shadow-md p-1.5 flex flex-col gap-1">
              <button
                onclick={() => { contentSource = "modrinth"; showSourceDropdown = false }}
                class="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm cursor-pointer {contentSource === 'modrinth' ? 'bg-[#16a34a]/10 text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}"
              >
                <img src="/modrinth.svg" alt="Modrinth" class="w-6 h-6" />
                Modrinth
              </button>
              <button
                onclick={() => { contentSource = "curseforge"; showSourceDropdown = false }}
                class="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm cursor-pointer {contentSource === 'curseforge' ? 'bg-[#f97316]/20 text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}"
              >
                <img src="/curseforge.svg" alt="CurseForge" class="w-6 h-6" />
                CurseForge
              </button>
            </div>
          {/if}
        </div>

        <div class="relative flex-1 rounded-md bg-[var(--bg-tertiary)]">
          <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-20 pointer-events-none" strokeWidth={2} />
          <input
            type="text"
            placeholder={ADDON_CATEGORIES[store.addonsSubTab].placeholder}
            bind:value={searchQuery}
            class="w-full bg-transparent rounded-md pl-10 pr-10 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition-all relative z-10"
          />
          {#if searchQuery}
            <button
              onclick={() => (searchQuery = "")}
              class="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 h-6 w-6 flex items-center justify-center rounded cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X size={16} strokeWidth={2} />
            </button>
          {/if}
        </div>

        </div>
      </div>
    </div>
  {/if}

  <div class="flex-1 min-h-0 px-8 overflow-hidden">
    <div class="h-full max-w-7xl mx-auto grid grid-cols-1">
      <div class="overflow-y-auto" bind:this={listScroller}>
        <div class={viewDetail ? "hidden" : ""}>
          {#key `${contentSource}:${store.addonsSubTab}`}
            <AddonList
              source={contentSource}
              category={ADDON_CATEGORIES[store.addonsSubTab]}
              searchQuery={searchQuery}
              onViewProjectDetail={handleViewProjectDetail}
              selectedInstance={store.selectedInstance}
              instances={store.instances}
              onSetSelectedInstance={setSelectedInstance}
              isDetailOpen={viewDetail !== null}
            />
          {/key}
        </div>
        {#if viewDetail}
          <ProjectDetail
            source={viewDetail.source}
            projectId={viewDetail.projectId}
            projectSlug={viewDetail.projectSlug}
            projectType={viewDetail.projectType}
            author={viewDetail.author}
            selectedInstance={store.selectedInstance}
            instances={store.instances}
            onShowCreationToast={handleStartCreating}
            onRefreshInstances={loadInstances}
            onBack={goBackToList}
          />
        {/if}
      </div>

    </div>
  </div>

  {#if !viewDetail && !modpackTab}
    <div class="absolute bottom-4 right-4 z-30" bind:this={installPickerRef}>
      {#if showInstallPicker}
        <div role="menu" class="dropdown-menu absolute bottom-full right-0 mb-1.5 z-[60] w-64 min-w-[190px] bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] shadow-md rounded-md overflow-hidden p-1.5 flex flex-col max-h-60 overflow-y-auto custom-scrollbar">
          {@render installTargets(true)}
        </div>
      {/if}
      <button
        onclick={() => showInstallPicker = !showInstallPicker}
        class="flex items-center gap-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 hover:bg-[var(--bg-hover)] cursor-pointer"
      >
        {#if store.selectedInstance}
          {@const selectedIcon = instanceIconSrc(store.selectedInstance.icon_path, store.selectedInstance.name)}
          {#if selectedIcon}
            <img src={selectedIcon} alt={store.selectedInstance.name} class="w-9 h-9 rounded object-cover flex-shrink-0" />
          {:else}
            <div class="w-9 h-9 flex items-center justify-center flex-shrink-0">
              <Package size={26} class="text-[var(--text-muted)]" />
            </div>
          {/if}
          <div class="text-left">
            <div class="text-xs leading-tight text-[var(--text-muted)]">Install to</div>
            <div class="text-[15px] font-semibold text-[var(--text-primary)] max-w-[180px] truncate leading-tight">{store.selectedInstance.name}</div>
          </div>
        {:else}
          <Package size={22} class="text-[var(--text-muted)] ml-2" />
          <span class="text-[15px] font-medium text-[var(--text-secondary)]">Select instance</span>
        {/if}
        <ChevronUp size={18} strokeWidth={3} class="text-[var(--text-secondary)] ml-0.5 transition-transform {showInstallPicker ? 'rotate-180' : ''}" />
      </button>
    </div>
  {/if}
</div>
