<script lang="ts">
  import { Package, Play } from "lucide-svelte"
  import { store, setSelectedInstance, handleShowDetails, handleLaunch, handleKillInstance } from "../../../lib/launcherStore.svelte"
  import { instanceIconSrc } from "../../../lib/icons"
  import { getMinecraftVersion } from "../../../lib/version"
  import type { Instance } from "../../../types"
  import { getLoaderMeta } from "./loader-meta"

  let { instance, onContextMenu }: {
    instance: Instance
    onContextMenu: (e: MouseEvent, instance: Instance) => void
  } = $props()

  let isRunning = $derived(store.runningInstances.has(instance.name))
  let isLaunching = $derived(store.launchingInstanceName === instance.name)
  let isBusy = $derived(isRunning || isLaunching)
  let loader = $derived(getLoaderMeta(instance.loader))
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
  class="group relative rounded-b-md cursor-pointer bg-[var(--bg-tertiary)] transition-all hover:brightness-120 px-3 pb-3 pt-[15px] flex flex-col items-center"
>
  <div class="absolute top-0 left-0 right-0 h-[3px] {loader.accent}"></div>
  <div class="relative w-full aspect-square">
    {#if iconSrc}
      <img src={iconSrc} alt={instance.name} class="w-full h-full object-cover rounded-md" />
    {:else}
      <div class="w-full h-full bg-[var(--bg-secondary)] rounded-md flex items-center justify-center">
        <Package size={64} class="text-[var(--text-muted)]" />
      </div>
    {/if}
    {#if store.isAuthenticated}
      <button
        title={isRunning ? "Stop instance" : "Launch instance"}
        onclick={(e) => {
          e.stopPropagation()
          if (isRunning) handleKillInstance(instance)
          else quickLaunch()
        }}
        disabled={store.launchingInstanceName !== null && !isRunning}
        class="absolute bottom-1.5 right-1.5 w-12 h-12 flex items-center justify-center rounded-md cursor-pointer {isBusy ? 'bg-red-500/10 text-red-400 opacity-100 hover:bg-red-500/20' : 'opacity-0 group-hover:opacity-100 bg-[#16a34a] hover:bg-[#15803d] text-[#181a1f]'} disabled:opacity-50"
      >
        {#if isBusy}
          <div class="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
        {:else}
          <Play size={24} fill="currentColor" strokeWidth={0} />
        {/if}
      </button>
    {/if}
  </div>
  <div class="w-full text-lg font-semibold text-[var(--text-primary)] tracking-tight leading-tight truncate mt-2">{instance.name}</div>
  <div class="w-full text-sm text-[var(--text-muted)] truncate leading-tight mt-0.5">{getMinecraftVersion(instance)} • <span class={loader.text}>{loader.label}</span></div>
</div>
