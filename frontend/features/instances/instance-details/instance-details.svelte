<script lang="ts">
  import { invoke } from "@tauri-apps/api/core"
  import InstanceSettingsModal from "./instance-settings-modal.svelte"
  import InstanceHeader from "./instance-header.svelte"
  import ModsSection from "./mods-section.svelte"
  import WorldsSection from "./worlds-section.svelte"
  import ResourcePacksSection from "./resource-packs-section.svelte"
  import ShaderPacksSection from "./shader-packs-section.svelte"
  import type { Instance } from "../../../types"
  import { instanceIconSrc } from "../../../lib/icons"
  import { handleCloseDetails, loadInstances } from "../../../lib/launcherStore.svelte"

  let { instance }: {
    instance: Instance
  } = $props()

  let isSettingsOpen = $state(false)
  let detailSection = $state<"mods" | "worlds" | "resourcepacks" | "shaderpacks">("mods")

  const instanceIcon = $derived(instanceIconSrc(instance.icon_path, instance.name))

  function tabClass(section: string) {
    return detailSection === section
      ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
      : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
  }

  async function handleOpenFolder() {
    try {
      await invoke("open_instance_folder", { instanceName: instance.name })
    } catch {}
  }

  function handleInstanceUpdated() {
    loadInstances()
  }

  function handleInstanceDeleted() {
    handleCloseDetails()
  }
</script>

<div class="flex flex-col h-full overflow-hidden">
  <InstanceHeader
    {instance}
    icon={instanceIcon}
    onOpenFolder={handleOpenFolder}
    onOpenSettings={() => (isSettingsOpen = true)}
  />

  <div class="flex-1 overflow-hidden px-8">
    <div class="max-w-7xl mx-auto flex flex-col h-full">

      <!-- Section tabs -->
      <div class="flex-shrink-0 flex gap-1 mb-4">
        <button onclick={() => detailSection = "mods"} class="px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer {tabClass('mods')}">
          Mods
        </button>
        <button onclick={() => detailSection = "worlds"} class="px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer {tabClass('worlds')}">
          Worlds
        </button>
        <button onclick={() => detailSection = "resourcepacks"} class="px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer {tabClass('resourcepacks')}">
          Resource Packs
        </button>
        <button onclick={() => detailSection = "shaderpacks"} class="px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer {tabClass('shaderpacks')}">
          Shader Packs
        </button>
      </div>

      {#if detailSection === "mods"}
        <ModsSection {instance} />
      {:else if detailSection === "worlds"}
        <WorldsSection {instance} />
      {:else if detailSection === "resourcepacks"}
        <ResourcePacksSection {instance} />
      {:else}
        <ShaderPacksSection {instance} />
      {/if}

    </div>
  </div>
</div>

<InstanceSettingsModal
  isOpen={isSettingsOpen}
  instance={instance}
  instanceIcon={instanceIcon}
  onClose={() => isSettingsOpen = false}
  onInstanceUpdated={handleInstanceUpdated}
  onInstanceDeleted={handleInstanceDeleted}
/>
