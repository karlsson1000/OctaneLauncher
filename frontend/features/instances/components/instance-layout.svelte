<script lang="ts">
  import type { Instance } from "../../../types"
  import InstanceList from "./instance-list.svelte"
  import InstanceGrid from "./instance-grid.svelte"

  let { instances, layout, onContextMenu }: {
    instances: Instance[]
    layout: "list" | "grid"
    onContextMenu: (e: MouseEvent, instance: Instance) => void
  } = $props()
</script>

{#if layout === "grid"}
  <div class="grid gap-x-3 gap-y-4 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
    {#each instances as instance (instance.name)}
      <InstanceGrid {instance} {onContextMenu} />
    {/each}
  </div>
{:else}
  <div class="grid grid-cols-2 gap-4 pl-1">
    {#each instances as instance (instance.name)}
      <InstanceList {instance} {onContextMenu} />
    {/each}
  </div>
{/if}
