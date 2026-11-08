<script lang="ts">
  import type { Component } from "svelte"
  import { InstanceDetails, ProgressTracker } from "../../features/instances"
  import { store, handleCreationError } from "../../lib/launcherStore.svelte"
  import ProgressToaster from "../ui/progress-toaster.svelte"

  let { activeTab }: { activeTab: Component | undefined } = $props()

  const darkness = $derived(((store.settings?.background_darkness ?? 80) / 100).toFixed(2))
  const blur = $derived(store.settings?.background_blur ?? 0)

  const backgroundStyle = $derived(
    store.background
      ? `background-image: linear-gradient(rgba(0,0,0,${darkness}), rgba(0,0,0,${darkness})), url("${store.background}"); background-size: cover; background-position: center`
      : "background-color: var(--content-bg)"
  )

  function dismissCreationToast() {
    store.creatingInstanceName = null
  }
</script>

<div class="flex-1 min-w-0 rounded-lg overflow-hidden flex flex-col relative" style={backgroundStyle}>
  {#if store.background && blur > 0}
    <div class="absolute inset-0 rounded-[inherit] pointer-events-none" style="backdrop-filter: blur({blur}px)"></div>
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
    <ProgressTracker
      instanceName={store.creatingInstanceName}
      onDismiss={dismissCreationToast}
      onError={handleCreationError}
    />
  {/if}

  <ProgressToaster />
</div>
