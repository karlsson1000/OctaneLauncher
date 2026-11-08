<script lang="ts">
  import { Play } from "lucide-svelte"
  import type { Instance } from "../../../types"
  import { store, setSelectedInstance, handleLaunch, handleKillInstance } from "../../../lib/launcherStore.svelte"

  let { instance, className = "", iconSize = 24 }: {
    instance: Instance
    className?: string
    iconSize?: number
  } = $props()

  const isRunning = $derived(store.runningInstances.has(instance.name))
  const isLaunching = $derived(store.launchingInstanceName === instance.name)
  const isBusy = $derived(isRunning || isLaunching)

  function activate(e: MouseEvent) {
    e.stopPropagation()
    if (isRunning) {
      handleKillInstance(instance)
      return
    }
    setSelectedInstance(instance)
    handleLaunch(instance)
  }
</script>

<button
  title={isRunning ? "Stop instance" : "Launch instance"}
  onclick={activate}
  disabled={store.launchingInstanceName !== null && !isRunning}
  class="{className} flex items-center justify-center rounded cursor-pointer {isBusy ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'opacity-0 group-hover:opacity-100 bg-[#16a34a] hover:bg-[#15803d] text-[#181a1f]'} disabled:opacity-50"
>
  {#if isBusy}
    <div class="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
  {:else}
    <Play size={iconSize} fill="currentColor" strokeWidth={0} />
  {/if}
</button>
