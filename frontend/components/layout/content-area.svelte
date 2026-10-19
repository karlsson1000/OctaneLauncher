<script lang="ts">
  import type { Component } from "svelte"
  import InstanceDetails from "../../features/instances/instance-details/instance-details.svelte"
  import CreationProgress from "../../features/instances/components/creation-progress.svelte"
  import { store, handleCreationError } from "../../lib/launcherStore.svelte"

  let { activeTab }: { activeTab: Component | undefined } = $props()

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
</div>
