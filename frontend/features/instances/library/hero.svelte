<script lang="ts">
  import { Play, MoreVertical } from "lucide-svelte"
  import type { Instance } from "../../../types"
  import { store, handleLaunch, handleKillInstance } from "../../../lib/launcherStore.svelte"
  import InstanceIcon from "../shared/instance-icon.svelte"

  let { instance, onContextMenu }: {
    instance: Instance
    onContextMenu: (e: MouseEvent, instance: Instance) => void
  } = $props()

  const CONTINUE_MESSAGES = [
    "Continue where you left off..",
    "Pick up where you left off..",
    "Jump back in..",
  ]

  let isRunning = $derived(store.runningInstances.has(instance.name))
  let isLaunching = $derived(store.launchingInstanceName === instance.name)
  let disabled = $derived(
    !isRunning && (!store.isAuthenticated || (store.launchingInstanceName !== null && !isLaunching))
  )

  let continueMessage = $state(CONTINUE_MESSAGES[0])
  let continueTarget = $state<string | null>(null)

  $effect(() => {
    if (instance.name !== continueTarget) {
      continueTarget = instance.name
      continueMessage = CONTINUE_MESSAGES[Math.floor(Math.random() * CONTINUE_MESSAGES.length)]
    }
  })
</script>

<div class="w-full rounded-md bg-[var(--bg-tertiary)] flex items-center gap-4 px-4 py-3 mb-8">
  <div class="w-12 h-12 rounded-md flex items-center justify-center overflow-hidden flex-shrink-0">
    <InstanceIcon {instance} className="w-12 h-12 object-cover rounded-md" iconSize={32} strokeWidth={1.5} />
  </div>

  <div class="flex-1 min-w-0">
    <div class="text-lg font-semibold text-[var(--text-primary)] truncate leading-tight">{continueMessage}</div>
    <div class="text-sm text-[var(--text-secondary)] truncate mt-0.5">{instance.name}</div>
  </div>

  <button
    onclick={() => isRunning ? handleKillInstance(instance) : handleLaunch(instance)}
    disabled={disabled}
    class="h-10 px-5 rounded-md flex items-center justify-center gap-2.5 text-lg cursor-pointer disabled:opacity-40 shrink-0 {isRunning || isLaunching ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 font-medium' : 'bg-[#16a34a] text-[#181a1f] hover:bg-[#15803d] font-semibold'}"
    title={isRunning ? "Stop" : `Play ${instance.name}`}
  >
    {#if isLaunching || isRunning}
      <div class="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
    {:else}
      <Play size={20} fill="currentColor" strokeWidth={0} />
    {/if}
    <span>{isRunning ? "Stop" : isLaunching ? "Launching..." : "Play"}</span>
  </button>

  <button
    onclick={(e) => onContextMenu(e, instance)}
    class="w-9 h-9 rounded-md flex items-center justify-center cursor-pointer text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] shrink-0"
    aria-label="Instance options"
  >
    <MoreVertical size={20} strokeWidth={2} />
  </button>
</div>
