<script lang="ts">
  import { Package, Play } from "lucide-svelte"
  import { store, setSelectedInstance, handleShowDetails, handleLaunch, handleKillInstance } from "../../../lib/launcherStore.svelte"
  import { instanceIconSrc } from "../../../lib/icons"
  import { getMinecraftVersion } from "../../../lib/version"
  import { formatPlaytime } from "../../../lib/format"
  import type { Instance } from "../../../types"
  import { getLoaderMeta, getLoaderVersion } from "./loader-meta"

  let { instance, onContextMenu }: {
    instance: Instance
    onContextMenu: (e: MouseEvent, instance: Instance) => void
  } = $props()

  let isRunning = $derived(store.runningInstances.has(instance.name))
  let isLaunching = $derived(store.launchingInstanceName === instance.name)
  let isBusy = $derived(isRunning || isLaunching)
  let loader = $derived(getLoaderMeta(instance.loader))
  let loaderVersion = $derived(getLoaderVersion(instance))
  let iconSrc = $derived(instanceIconSrc(instance.icon_path, instance.name))

  function openInstance() {
    setSelectedInstance(instance)
    handleShowDetails(instance)
  }

  function quickLaunch() {
    setSelectedInstance(instance)
    handleLaunch(instance)
  }
</script>

<div
  role="button"
  tabindex="0"
  onclick={openInstance}
  oncontextmenu={(e) => onContextMenu(e, instance)}
  onkeydown={(e) => { if (e.key === 'Enter') openInstance() }}
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
      <div class="flex items-center gap-3 min-w-0">
        <h3 class="text-xl font-semibold text-[var(--text-primary)] tracking-tight leading-tight truncate">{instance.name}</h3>
        {#if (instance.total_playtime_seconds ?? 0) > 0}
          <span class="flex-shrink-0 px-2 py-0.5 bg-[var(--bg-secondary)] text-[var(--text-muted)] text-xs rounded">
            {formatPlaytime(instance.total_playtime_seconds ?? 0)}
          </span>
        {/if}
      </div>
      <p class="text-sm text-[var(--text-muted)] mt-1.5 truncate">
          {getMinecraftVersion(instance)}
        {" • "}
        <span class={loader.text}>{loader.label}</span>
        {#if loaderVersion}<span class="text-[var(--text-muted)]"> {loaderVersion}</span>{/if}
      </p>
    </div>

    {#if store.isAuthenticated}
      <button
        title={isRunning ? "Stop instance" : "Launch instance"}
        onclick={(e) => {
          e.stopPropagation()
          if (isRunning) handleKillInstance(instance)
          else quickLaunch()
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
