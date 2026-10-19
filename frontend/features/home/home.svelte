<script lang="ts">
  import { Package, FolderOpen, Copy, FileArchive, Trash2 } from "lucide-svelte"
  import type { Instance } from "../../types"
  import ContextMenu from "../../components/ui/context-menu.svelte"
  import HomeHero from "./components/home-hero.svelte"
  import RecentlyPlayed from "./components/recently-played.svelte"
  import SnapshotCarousel from "./components/snapshot-carousel.svelte"
  import {
    store,
    handleDeleteInstance, handleShowDetails,
    handleOpenInstanceFolderByInstance, handleDuplicateInstance,
    setExportModal,
  } from "../../lib/launcherStore.svelte"

  let contextMenu = $state<{ x: number; y: number; instance: Instance } | null>(null)

  let recentInstances = $derived<Instance[]>(
    [...store.instances]
      .filter(i => i.last_played)
      .sort((a, b) => new Date(b.last_played!).getTime() - new Date(a.last_played!).getTime())
      .slice(0, store.showFriendsPanel ? 4 : 5)
  )

  let lastPlayedInstance = $derived<Instance | null>(recentInstances[0] ?? null)

  function handleContextMenu(e: MouseEvent, instance: Instance) {
    e.preventDefault()
    contextMenu = { x: e.clientX, y: e.clientY, instance }
  }

  function handleDotsMenu(e: MouseEvent, instance: Instance) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    contextMenu = { x: rect.left, y: rect.bottom + 4, instance }
  }
</script>

<div class="px-8 pb-8 pt-[75px] space-y-10">
  <HomeHero {lastPlayedInstance} onDotsMenu={handleDotsMenu} />

  {#if recentInstances.length > 0}
    <RecentlyPlayed instances={recentInstances} onContextMenu={handleContextMenu} />
  {/if}

  <SnapshotCarousel />

  {#if contextMenu}
    {@const cm = contextMenu}
    <ContextMenu
      x={cm.x}
      y={cm.y}
      onClose={() => contextMenu = null}
      items={[
        { label: "Open", icon: Package, onClick: () => handleShowDetails(cm.instance) },
        { label: "Open Folder", icon: FolderOpen, onClick: () => handleOpenInstanceFolderByInstance(cm.instance) },
        { label: "Duplicate", icon: Copy, onClick: () => handleDuplicateInstance(cm.instance) },
        { label: "Export", icon: FileArchive, onClick: () => { setExportModal(cm.instance); contextMenu = null } },
        { separator: true },
        { label: "Delete", icon: Trash2, onClick: () => handleDeleteInstance(cm.instance.name), danger: true },
      ]}
    />
  {/if}
</div>
