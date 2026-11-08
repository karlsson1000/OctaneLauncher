<script lang="ts">
  import { store, setSelectedInstance, handleShowDetails } from "../../../lib/launcherStore.svelte"
  import { getMinecraftVersion } from "../../../lib/version"
  import type { Instance } from "../../../types"
  import { getLoaderMeta } from "../shared/loader-meta"
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

  let loader = $derived(getLoaderMeta(instance.loader))

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
  class="group relative rounded-b-md cursor-pointer hover:brightness-120 px-3 pb-3 pt-[15px] flex flex-col items-center {selected ? 'bg-[var(--accent-primary)]/20' : 'bg-[var(--bg-tertiary)]'}"
>
  <div class="absolute top-0 left-0 right-0 h-[3px] {loader.accent}"></div>
  <div class="relative w-full aspect-square">
    <InstanceIcon {instance} className="w-full h-full object-cover rounded-md" iconSize={64} />
    {#if store.isAuthenticated && !selecting}
      <LaunchButton {instance} className="absolute bottom-1.5 right-1.5 w-12 h-12 rounded-md" iconSize={24} />
    {/if}
    {#if selected}
      <SelectBadge />
    {/if}
  </div>
  <div class="w-full text-lg font-semibold text-[var(--text-primary)] tracking-tight leading-tight truncate mt-2">{instance.name}</div>
  <div class="w-full text-sm text-[var(--text-muted)] truncate leading-tight mt-0.5">{getMinecraftVersion(instance)} • <span class={loader.text}>{loader.label}</span></div>
</div>
