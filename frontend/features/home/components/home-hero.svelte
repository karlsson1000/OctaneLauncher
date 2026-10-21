<script lang="ts">
  import { Play, MoreVertical } from "lucide-svelte"
  import type { Instance } from "../../../types"
  import { store, handleLaunch, handleKillInstance } from "../../../lib/launcherStore.svelte"

  let { lastPlayedInstance, onDotsMenu }: {
    lastPlayedInstance: Instance | null
    onDotsMenu: (e: MouseEvent, instance: Instance) => void
  } = $props()

  let isLastPlayedRunning = $derived(lastPlayedInstance ? store.runningInstances.has(lastPlayedInstance.name) : false)
  let isLastPlayedLaunching = $derived(lastPlayedInstance ? store.launchingInstanceName === lastPlayedInstance.name : false)

  let heroBtnClass = $derived(
    isLastPlayedRunning || isLastPlayedLaunching
      ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
      : "bg-[#16a34a] text-[#181a1f] hover:bg-[#15803d]"
  )

  let heroDisabled = $derived(store.launchingInstanceName !== null && !isLastPlayedRunning && !isLastPlayedLaunching)

  function getGreeting(): string {
    const h = new Date().getHours()
    if (h < 5) return "Good night"
    if (h < 12) return "Good morning"
    if (h < 18) return "Good afternoon"
    return "Good evening"
  }
</script>

<div class="max-w-7xl mx-auto">
  <div class="w-full h-34 bg-[var(--bg-tertiary)] rounded-md relative flex items-center px-8">
    {#if store.activeAccount}
      <div class="absolute left-12 bottom-0 z-10">
        <img
          src="https://renders.stellarmc.gg/bust/{store.activeAccount.username}"
          alt={store.activeAccount.username}
          class="h-48 w-auto object-contain block [image-rendering:pixelated]"
        />
      </div>
    {/if}

    <div class="{store.activeAccount ? 'w-44' : 'w-0'} flex-shrink-0"></div>

    <div class="flex-1 flex justify-center">
      {#if store.isAuthenticated && store.activeAccount}
        <h2 class="text-3xl font-semibold text-[var(--text-primary)] tracking-tight">
          {getGreeting()}, {store.activeAccount.username}
        </h2>
      {:else}
        <div class="text-center">
          <h2 class="text-3xl font-semibold text-[var(--text-primary)] tracking-tight">
            Welcome to Octane Launcher
          </h2>
          <p class="text-sm text-[var(--text-secondary)] mt-1">Sign in to get started</p>
        </div>
      {/if}
    </div>

    <div class="{store.isAuthenticated && lastPlayedInstance ? 'w-auto' : (store.activeAccount ? 'w-44' : 'w-0')} flex-shrink-0 flex items-center justify-end">
      {#if store.isAuthenticated && lastPlayedInstance && !store.showFriendsPanel}
        <div class="flex items-center gap-1">
          <button
            onclick={() => isLastPlayedRunning
              ? handleKillInstance(lastPlayedInstance)
              : handleLaunch(lastPlayedInstance)
            }
            disabled={heroDisabled}
            class="h-10 px-5 rounded-md flex items-center justify-center gap-3 text-lg font-semibold cursor-pointer disabled:opacity-40 {heroBtnClass}"
            title={isLastPlayedRunning ? "Stop" : `Play ${lastPlayedInstance.name}`}
          >
            {#if isLastPlayedLaunching || isLastPlayedRunning}
              <div class="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
            {:else}
              <Play size={24} fill="currentColor" strokeWidth={0} />
            {/if}
            <span class="truncate max-w-[140px]">{isLastPlayedRunning ? "Stop" : isLastPlayedLaunching ? "Launching..." : lastPlayedInstance.name}</span>
          </button>
          <button
            onclick={(e) => onDotsMenu(e, lastPlayedInstance)}
            class="h-10 w-10 rounded-md flex items-center justify-center cursor-pointer bg-transparent text-[var(--text-secondary)] hover:bg-white/10 hover:text-[var(--text-primary)]"
            aria-label="Instance options"
          >
            <MoreVertical size={22} strokeWidth={2} />
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>
