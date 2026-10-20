<script lang="ts">
  import type { Component } from "svelte"
  import { fly } from "svelte/transition"
  import { CheckCheck, Loader2, TriangleAlert, Minimize2, Maximize2 } from "lucide-svelte"
  import InstanceDetails from "../../features/instances/instance-details/instance-details.svelte"
  import CreationProgress from "../../features/instances/components/creation-progress.svelte"
  import { store, handleCreationError } from "../../lib/launcherStore.svelte"
  import { toastStore } from "../../lib/toastStore.svelte"

  let { activeTab }: { activeTab: Component | undefined } = $props()

  let compact = $state(false)

  const backgroundStyle = $derived(
    store.background
      ? `background-image: url("${store.background}"); background-size: cover; background-position: center`
      : "background-color: var(--content-bg)"
  )

  const overlayStyle = $derived.by(() => {
    const darkness = ((store.settings?.background_darkness ?? 80) / 100).toFixed(2)
    const blur = store.settings?.background_blur ?? 0
    return `background: rgba(0,0,0,${darkness});${blur > 0 ? ` backdrop-filter: blur(${blur}px);` : ""}`
  })

  function dismissCreationToast() {
    store.creatingInstanceName = null
  }
</script>

{#snippet progressTrack(progress: number, status: string, wrapperClass: string)}
  <div class="h-1 rounded-full bg-[var(--bg-secondary)] overflow-hidden {wrapperClass}">
    <div
      class="h-full rounded-full transition-all duration-300 {status === 'error' ? 'bg-red-500' : 'bg-[#16a34a]'}"
      style="width: {Math.min(100, Math.max(0, progress))}%"
    ></div>
  </div>
{/snippet}

<div class="flex-1 rounded-xl overflow-hidden flex flex-col relative" style={backgroundStyle}>
  {#if store.background}
    <div class="absolute inset-0" style={overlayStyle}></div>
  {/if}

  <main class="flex-1 min-h-0 overflow-y-auto relative">
    {#if store.showInstanceDetails && store.selectedInstance}
      <InstanceDetails instance={store.selectedInstance} />
    {:else if activeTab}
      {@const Tab = activeTab}
      <Tab />
    {/if}
  </main>

  {#if store.creatingInstanceName}
    <CreationProgress
      instanceName={store.creatingInstanceName}
      onDismiss={dismissCreationToast}
      onError={handleCreationError}
    />
  {/if}

  {#if toastStore.progress.length > 0}
    <div class="absolute inset-x-4 bottom-4 z-20 flex flex-col items-end gap-2 pointer-events-none">
      {#each toastStore.progress as p (p.id)}
        <div
          transition:fly|global={{ y: 16, duration: 160 }}
          class="bg-[var(--bg-tertiary)] rounded-lg shadow-md border border-[var(--border-subtle)] select-none pointer-events-auto transition-[width,padding] duration-200
            {compact ? 'w-80 max-w-full px-2.5 py-1.5' : 'w-full px-3 pt-2 pb-3'}"
        >
          <div class="flex items-center gap-2">
            <div class="{compact ? 'w-6 h-6' : 'w-8 h-8'} flex items-center justify-center shrink-0">
              {#if p.status === "creating"}
                <Loader2 size={compact ? 18 : 22} strokeWidth={2.5} class="animate-spin text-[#16a34a]" />
              {:else if p.status === "success"}
                <CheckCheck size={compact ? 18 : 22} strokeWidth={2.5} class="text-[#16a34a]" />
              {:else}
                <TriangleAlert size={compact ? 18 : 22} strokeWidth={2.5} class="text-red-400" />
              {/if}
            </div>

            {#if compact}
              <span class="text-sm text-[var(--text-primary)] truncate whitespace-nowrap min-w-0 max-w-[45%]">{p.title}</span>
              {@render progressTrack(p.progress, p.status, "flex-1 min-w-[40px]")}
              <span class="text-sm text-[var(--text-secondary)] tabular-nums shrink-0 whitespace-nowrap">{Math.round(p.progress)}%</span>
            {:else}
              <span class="text-[15px] text-[var(--text-primary)] truncate whitespace-nowrap">{p.title}</span>
              <span class="text-[15px] text-[var(--text-muted)] flex-1 min-w-0 truncate whitespace-nowrap">{p.stage}</span>
              <span class="text-[15px] text-[var(--text-secondary)] tabular-nums shrink-0 whitespace-nowrap">{Math.round(p.progress)}%</span>
            {/if}

            <button
              type="button"
              onclick={() => (compact = !compact)}
              aria-label={compact ? "Expand progress bar" : "Switch to compact progress bar"}
              class="{compact ? 'w-5 h-5' : 'w-6 h-6'} flex items-center justify-center rounded cursor-pointer shrink-0 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              {#if compact}
                <Maximize2 size={14} strokeWidth={2.5} />
              {:else}
                <Minimize2 size={16} strokeWidth={2.5} />
              {/if}
            </button>
          </div>

          {#if !compact}
            {@render progressTrack(p.progress, p.status, "mt-1.5")}
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
