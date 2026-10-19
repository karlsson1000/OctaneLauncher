<script lang="ts">
  import { Package, Play, ChevronRight } from "lucide-svelte"
  import type { Instance } from "../../../types"
  import { getMinecraftVersion } from "../../../lib/version"
  import { instanceIconSrc } from "../../../lib/icons"
  import { formatPlaytime, formatRelativeDate } from "../../../lib/format"
  import {
    store,
    handleLaunch, handleShowDetails,
    handleKillInstance, handleNavigateToInstances,
  } from "../../../lib/launcherStore.svelte"

  let { instances, onContextMenu }: {
    instances: Instance[]
    onContextMenu: (e: MouseEvent, instance: Instance) => void
  } = $props()

  let tooltipInstance = $state<Instance | null>(null)
  let tooltipTimer: ReturnType<typeof setTimeout> | undefined
</script>

<div class="max-w-7xl mx-auto">
  <div class="mb-4 flex items-center justify-between">
    <button onclick={handleNavigateToInstances} class="flex items-center gap-2 cursor-pointer group">
      <h2 class="text-xl font-semibold text-[var(--text-primary)] tracking-tight">
        Recently Played
      </h2>
      <ChevronRight size={18} strokeWidth={3} class="text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
    </button>
  </div>
  <div class="grid gap-3 {store.showFriendsPanel ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}">
    {#each instances as instance (instance.name)}
      {@const isRunning = store.runningInstances.has(instance.name)}
      {@const isLaunching = store.launchingInstanceName === instance.name}
      {@const icon = instanceIconSrc(instance.icon_path, instance.name)}
      <div
        role="button"
        tabindex="0"
        onclick={() => handleShowDetails(instance)}
        oncontextmenu={(e) => onContextMenu(e, instance)}
        onkeydown={(e) => { if (e.key === 'Enter') handleShowDetails(instance) }}
        onmouseenter={() => {
          tooltipTimer = setTimeout(() => tooltipInstance = instance, 1000)
        }}
        onmouseleave={() => {
          if (tooltipTimer) clearTimeout(tooltipTimer)
          tooltipInstance = null
        }}
        class="bg-[var(--bg-tertiary)] rounded-md p-2 flex items-center gap-2 hover:bg-[var(--bg-hover)] cursor-pointer group relative"
      >
        {#if tooltipInstance === instance}
          <div class="absolute bottom-full left-0 right-0 mb-2 z-50 pointer-events-none">
            <div class="bg-[var(--bg-secondary)] rounded-md p-3 mx-2 border border-[var(--border-default)]">
              <div class="text-sm font-medium text-[var(--text-primary)] mb-1.5">{instance.name}</div>
              <div class="space-y-1 text-xs text-[var(--text-muted)]">
                <div class="flex justify-between gap-4">
                  <span>Version</span>
                  <span class="text-[var(--text-primary)]">{getMinecraftVersion(instance)}</span>
                </div>
                {#if instance.loader}
                  <div class="flex justify-between gap-4">
                    <span>Loader</span>
                    <span class="text-[var(--text-primary)] capitalize">{instance.loader}{instance.loader_version ? ` ${instance.loader_version}` : ''}</span>
                  </div>
                {/if}
                <div class="flex justify-between gap-4">
                  <span>Created</span>
                  <span class="text-[var(--text-primary)]">{formatRelativeDate(instance.created_at)}</span>
                </div>
                {#if instance.total_playtime_seconds !== undefined && instance.total_playtime_seconds > 0}
                  <div class="flex justify-between gap-4">
                    <span>Playtime</span>
                    <span class="text-[var(--text-primary)]">{formatPlaytime(instance.total_playtime_seconds)}</span>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/if}
        <div class="relative flex-shrink-0">
          {#if icon}
            <img src={icon} alt={instance.name} class="w-10 h-10 rounded object-cover" />
          {:else}
            <div class="w-10 h-10 bg-[var(--bg-secondary)] rounded flex items-center justify-center">
              <Package size={20} class="text-[var(--text-muted)]" />
            </div>
          {/if}
        </div>
        <div class="flex-1 min-w-0 {(isRunning || isLaunching) ? 'pr-12' : 'group-hover:pr-12'}">
          <div class="text-sm font-medium text-[var(--text-primary)] truncate leading-tight">{instance.name}</div>
          <div class="text-xs text-[var(--text-muted)] truncate leading-tight mt-0.5">
            {instance.last_played && formatRelativeDate(instance.last_played)}
          </div>
        </div>
        <button
          onclick={(e) => { e.stopPropagation();
            if (isRunning) handleKillInstance(instance)
            else handleLaunch(instance)
          }}
          disabled={store.launchingInstanceName !== null && !isLaunching && !isRunning}
          class="absolute right-2 flex-shrink-0 w-10 h-10 flex items-center justify-center rounded {(isRunning || isLaunching) ? 'bg-red-500/10 text-red-400 opacity-100 hover:bg-red-500/20 cursor-pointer' : store.launchingInstanceName !== null ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100 bg-[#16a34a] hover:bg-[#15803d] text-[#181a1f] cursor-pointer'}"
          title={isRunning ? "Stop instance" : "Launch instance"}
        >
          {#if isLaunching || isRunning}
            <div class="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
          {:else}
            <Play size={20} fill="currentColor" strokeWidth={0} />
          {/if}
        </button>
      </div>
    {/each}
  </div>
</div>
