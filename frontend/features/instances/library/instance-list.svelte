<script lang="ts">
  import { store, setSelectedInstance, handleShowDetails } from "../../../lib/launcherStore.svelte"
  import { getMinecraftVersion } from "../../../lib/version"
  import { formatPlaytime } from "../../../lib/format"
  import type { Instance } from "../../../types"
  import { getLoaderMeta, getLoaderVersion } from "../shared/loader-meta"
  import InstanceIcon from "../shared/instance-icon.svelte"
  import LaunchButton from "../shared/launch-button.svelte"
  import SelectBadge from "../shared/select-badge.svelte"

  let { instance, onContextMenu, selecting, selected, onSelect }: {
    instance: Instance
    onContextMenu: (e: MouseEvent, instance: Instance) => void
    selecting: boolean
    selected: boolean
    onSelect: (e: MouseEvent | KeyboardEvent, instance: Instance) => void
  } = $props()

  let isRunning = $derived(store.runningInstances.has(instance.name))
  let isLaunching = $derived(store.launchingInstanceName === instance.name)
  let isBusy = $derived(isRunning || isLaunching)
  let loader = $derived(getLoaderMeta(instance.loader))
  let loaderVersion = $derived(getLoaderVersion(instance))

  function openInstance() {
    setSelectedInstance(instance)
    handleShowDetails(instance)
  }

  function activate(e: MouseEvent | KeyboardEvent) {
    if (selecting || e.shiftKey || e.ctrlKey || e.metaKey) {
      onSelect(e, instance)
      return
    }
    openInstance()
  }
</script>

<div
  role="button"
  tabindex="0"
  onclick={activate}
  oncontextmenu={(e) => onContextMenu(e, instance)}
  onkeydown={(e) => { if (e.key === 'Enter') activate(e) }}
  class="rounded-r-md cursor-pointer hover:brightness-120 group relative {selected ? 'bg-[var(--accent-primary)]/20' : 'bg-[var(--bg-tertiary)]'}"
>
  <div class="flex min-h-0 relative z-0 items-center">
    <div class="absolute left-0 top-0 bottom-0 w-[3px] {loader.accent}"></div>

    <div class="relative flex-shrink-0">
      <InstanceIcon {instance} className="w-[76px] h-[76px] object-cover rounded my-2 mr-2 ml-4" iconSize={36} />
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

    {#if store.isAuthenticated && !selecting}
      <LaunchButton {instance} className="flex-shrink-0 w-[54px] h-[54px] mr-4" iconSize={28} />
    {/if}
  </div>

  {#if selected}
    <SelectBadge />
  {/if}
</div>
