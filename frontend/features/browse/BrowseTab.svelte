<script lang="ts">
  import { Search, ChevronDown, Check, Puzzle, Layers, Image, Sparkles, Package } from "lucide-svelte"
  import { invoke } from "@tauri-apps/api/core"
  import ModsTab from "../modrinth/ModsTab.svelte"
  import ModpacksTab from "../modrinth/ModpacksTab.svelte"
  import ResourcePacksTab from "../modrinth/ResourcePacksTab.svelte"
  import ShaderPacksTab from "../modrinth/ShaderPacksTab.svelte"
  import CurseforgeModsTab from "../curseforge/ModsTab.svelte"
  import CurseforgeModpacksTab from "../curseforge/ModpacksTab.svelte"
  import CurseforgeResourcePacksTab from "../curseforge/ResourcePacksTab.svelte"
  import CurseforgeShaderPacksTab from "../curseforge/ShaderPacksTab.svelte"
  import {
    store, setSelectedInstance, loadInstances,
    handleStartCreating, setBrowseSubTab
  } from "../../lib/launcherStore.svelte"
  import type { Instance } from "../../types"
  import { getMinecraftVersion } from "../../lib/version"

  type ContentSource = "modrinth" | "curseforge"

  let contentSource = $state<ContentSource>("modrinth")
  let showSourceDropdown = $state(false)
  let showInstanceSelector = $state(false)
  let instanceSelectorEl: HTMLDivElement | undefined = $state()
  let searchQuery = $state("")
  let instanceIcons = $state<Record<string, string | null>>({})
  const moddedInstances = $derived(store.instances.filter(i => i.loader === "fabric" || i.loader === "neoforge" || i.loader === "forge"))

  const placeholderMap: Record<string, string> = {
    mods: "Search mods...",
    modpacks: "Search modpacks...",
    resourcepacks: "Search resource packs...",
    shaderpacks: "Search shader packs...",
  }

  $effect(() => {
    if (store.instances.length === 0) return
    const loadIcons = async () => {
      const icons: Record<string, string | null> = {}
      for (const instance of store.instances) {
        try {
          icons[instance.name] = await invoke<string | null>("get_instance_icon", { instanceName: instance.name })
        } catch {
          icons[instance.name] = null
        }
      }
      instanceIcons = icons
    }
    loadIcons()
  })

  $effect(() => {
    if (!showInstanceSelector) return
    const handleClickOutside = (event: MouseEvent) => {
      if (instanceSelectorEl && !instanceSelectorEl.contains(event.target as Node)) {
        showInstanceSelector = false
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  })

  const getLoaderDisplay = (instance: Instance): { name: string; color: string } => {
    if (instance.loader === "fabric") return { name: "Fabric", color: "text-[#3b82f6]" }
    if (instance.loader === "neoforge") return { name: "NeoForge", color: "text-[#f97316]" }
    if (instance.loader === "forge") return { name: "Forge", color: "text-[#e05d2e]" }
    return { name: "Vanilla", color: "text-[#16a34a]" }
  }

  const tabs = [
    { id: "mods" as const, label: "Mods", icon: Puzzle, color: "text-[#16a34a]" },
    { id: "modpacks" as const, label: "Modpacks", icon: Layers, color: "text-[#3b82f6]" },
    { id: "resourcepacks" as const, label: "Resource Packs", icon: Image, color: "text-[#8b5cf6]" },
    { id: "shaderpacks" as const, label: "Shader Packs", icon: Sparkles, color: "text-[#f59e0b]" },
  ]
</script>

<div class="flex flex-col h-full overflow-hidden">
  <div class="flex-shrink-0 px-8 pt-8 pb-4">
    <div class="max-w-7xl mx-auto">
      <div class="flex items-center gap-4">
        {#each tabs as tab, index}
          {@const Icon = tab.icon}
          {@const isActive = store.browseSubTab === tab.id}
          <button
            onclick={() => setBrowseSubTab(tab.id)}
            class="flex items-center gap-2 text-2xl font-semibold tracking-tight transition-colors cursor-pointer {isActive ? tab.color : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
          >
            <Icon size={24} strokeWidth={2} />
            {#if tab.label}
              <span>{tab.label}</span>
            {/if}
          </button>
          {#if index < tabs.length - 1}
            <div class="h-8 w-px bg-[var(--bg-hover-strong)]"></div>
          {/if}
        {/each}
      </div>
    </div>
  </div>

  <div class="flex-shrink-0 px-8 pb-4">
    <div class="max-w-7xl mx-auto">
      <div class="flex gap-2 items-stretch">
        <div class="relative">
          <button
            onclick={() => showSourceDropdown = !showSourceDropdown}
            class="w-10 h-10 flex items-center justify-center bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors cursor-pointer"
          >
            <img
              src={contentSource === "modrinth" ? "/modrinth.svg" : "/curseforge.svg"}
              alt={contentSource}
              class="w-6 h-6"
            />
          </button>
          {#if showSourceDropdown}
            <div class="absolute top-full mt-2 left-0 bg-[var(--bg-tertiary)] rounded-md overflow-hidden z-50 min-w-[140px] shadow-lg">
              <button
                onclick={() => { contentSource = "modrinth"; showSourceDropdown = false }}
                class="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer {contentSource === 'modrinth' ? 'bg-[#16a34a]/10 text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}"
              >
                <img src="/modrinth.svg" alt="Modrinth" class="w-6 h-6" />
                Modrinth
              </button>
              <button
                onclick={() => { contentSource = "curseforge"; showSourceDropdown = false }}
                class="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer {contentSource === 'curseforge' ? 'bg-[#f97316]/20 text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}"
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
            placeholder={placeholderMap[store.browseSubTab]}
            bind:value={searchQuery}
            class="w-full bg-transparent rounded-md pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition-all relative z-10"
          />
        </div>

        {#if store.selectedInstance && (store.selectedInstance.loader === "fabric" || store.selectedInstance.loader === "neoforge" || store.selectedInstance.loader === "forge")}
          {@const loaderInfo = getLoaderDisplay(store.selectedInstance)}
          <div bind:this={instanceSelectorEl} class="relative">
            <button
              onclick={() => showInstanceSelector = !showInstanceSelector}
              class="flex items-center gap-3 px-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] rounded-md text-sm transition-colors cursor-pointer h-10"
            >
              {#if instanceIcons[store.selectedInstance.name]}
                <img src={instanceIcons[store.selectedInstance.name]} alt={store.selectedInstance.name} class="w-8 h-8 rounded object-cover flex-shrink-0" />
              {:else}
                <div class="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <Package size={26} class="text-[var(--text-muted)]" strokeWidth={2} />
                </div>
              {/if}
              <div class="text-left min-w-0">
                <div class="font-semibold text-[var(--text-primary)] whitespace-nowrap leading-tight">{store.selectedInstance.name}</div>
                <div class="flex items-center gap-1 text-xs leading-tight mt-0.5">
                  <span class="text-[var(--text-muted)]">{getMinecraftVersion(store.selectedInstance)}</span>
                  <span class="text-[#3a3f4b]">•</span>
                  <span class={loaderInfo.color}>{loaderInfo.name}</span>
                </div>
              </div>
              <ChevronDown size={16} class="text-[var(--text-muted)] ml-auto transition-transform {showInstanceSelector ? 'rotate-180' : ''}" strokeWidth={3} />
            </button>
            {#if showInstanceSelector}
              <div class="absolute top-full mt-2 right-0 bg-[var(--bg-tertiary)] rounded-md overflow-hidden z-[100] min-w-[240px] max-h-[400px] overflow-y-auto">
                {#if moddedInstances.length === 0}
                  <div class="px-3 py-4 text-center bg-[var(--bg-tertiary)]">
                    <p class="text-sm text-[var(--text-muted)] mb-1">No modded instances</p>
                    <p class="text-xs text-[#3a3f4b]">Create a modded instance to install mods</p>
                  </div>
                {:else}
                  {#each moddedInstances as instance}
                    {@const icon = instanceIcons[instance.name]}
                    {@const loader = getLoaderDisplay(instance)}
                    <button
                      onclick={() => { setSelectedInstance(instance); showInstanceSelector = false }}
                      class="w-full flex items-center gap-3 px-3 py-2 text-left text-sm cursor-pointer transition-colors {store.selectedInstance.name === instance.name ? 'bg-[#3b82f6]/10 text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}"
                    >
                      {#if icon}
                        <img src={icon} alt={instance.name} class="w-8 h-8 rounded object-cover flex-shrink-0" />
                      {:else}
                        <div class="w-8 h-8 flex items-center justify-center flex-shrink-0">
                          <Package size={24} class="text-[var(--text-muted)]" strokeWidth={1.5} />
                        </div>
                      {/if}
                      <div class="flex-1 min-w-0">
                        <div class="font-semibold text-[var(--text-primary)] truncate">{instance.name}</div>
                        <div class="flex items-center gap-1 text-xs">
                          <span>{getMinecraftVersion(instance)}</span>
                          <span>•</span>
                          <span class={loader.color}>{loader.name}</span>
                        </div>
                      </div>
                      {#if store.selectedInstance.name === instance.name}
                        <Check size={16} class="flex-shrink-0 text-[#16a34a]" strokeWidth={3} />
                      {/if}
                    </button>
                  {/each}
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>

  <div class="flex-1 min-h-0 px-8 overflow-hidden">
    {#if contentSource === "modrinth"}
      {#if store.browseSubTab === "mods"}
        <ModsTab
          selectedInstance={store.selectedInstance}
          instances={store.instances}
          onSetSelectedInstance={setSelectedInstance}
          hideToolbar
          searchQuery={searchQuery}
          onSearchQueryChange={(v: string) => searchQuery = v}
        />
      {/if}
      {#if store.browseSubTab === "modpacks"}
        <ModpacksTab
          instances={store.instances}
          onRefreshInstances={loadInstances}
          onShowCreationToast={handleStartCreating}
          hideToolbar
          searchQuery={searchQuery}
          onSearchQueryChange={(v: string) => searchQuery = v}
        />
      {/if}
      {#if store.browseSubTab === "resourcepacks"}
        <ResourcePacksTab
          selectedInstance={store.selectedInstance}
          hideToolbar
          searchQuery={searchQuery}
          onSearchQueryChange={(v: string) => searchQuery = v}
        />
      {/if}
      {#if store.browseSubTab === "shaderpacks"}
        <ShaderPacksTab
          selectedInstance={store.selectedInstance}
          hideToolbar
          searchQuery={searchQuery}
          onSearchQueryChange={(v: string) => searchQuery = v}
        />
      {/if}
    {:else}
      {#if store.browseSubTab === "mods"}
        <CurseforgeModsTab
          selectedInstance={store.selectedInstance}
          instances={store.instances}
          onSetSelectedInstance={setSelectedInstance}
          hideToolbar
          searchQuery={searchQuery}
          onSearchQueryChange={(v: string) => searchQuery = v}
        />
      {/if}
      {#if store.browseSubTab === "modpacks"}
        <CurseforgeModpacksTab
          instances={store.instances}
          hideToolbar
          searchQuery={searchQuery}
          onSearchQueryChange={(v: string) => searchQuery = v}
          onShowCreationToast={handleStartCreating}
          onRefreshInstances={loadInstances}
        />
      {/if}
      {#if store.browseSubTab === "resourcepacks"}
        <CurseforgeResourcePacksTab
          selectedInstance={store.selectedInstance}
          hideToolbar
          searchQuery={searchQuery}
          onSearchQueryChange={(v: string) => searchQuery = v}
        />
      {/if}
      {#if store.browseSubTab === "shaderpacks"}
        <CurseforgeShaderPacksTab
          selectedInstance={store.selectedInstance}
          hideToolbar
          searchQuery={searchQuery}
          onSearchQueryChange={(v: string) => searchQuery = v}
        />
      {/if}
    {/if}
  </div>
</div>
