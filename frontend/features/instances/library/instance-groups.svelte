<script lang="ts">
  import type { Instance } from "../../../types"
  import { DEFAULT_GROUP } from "./groups"
  import GroupHeader from "./group-header.svelte"
  import InstanceLayout from "./instance-layout.svelte"

  let { groups, ungrouped, hasAnyGroups, collapsed, layout, selecting, selected, onContextMenu, onSelect, onToggle, onGroupContextMenu }: {
    groups: { name: string; instances: Instance[] }[]
    ungrouped: Instance[]
    hasAnyGroups: boolean
    collapsed: Record<string, boolean>
    layout: "list" | "grid"
    selecting: boolean
    selected: Set<string>
    onContextMenu: (e: MouseEvent, instance: Instance) => void
    onSelect: (e: MouseEvent | KeyboardEvent, instance: Instance) => void
    onToggle: (group: string) => void
    onGroupContextMenu: (e: MouseEvent, group: string) => void
  } = $props()
</script>

<div class="space-y-5">
  {#each groups as group (group.name)}
    <div>
      <GroupHeader groupKey={group.name} label={group.name} named={true} collapsed={collapsed[group.name]} onToggle={onToggle} onHeaderContextMenu={onGroupContextMenu} />
      {#if !collapsed[group.name]}
        <InstanceLayout instances={group.instances} {layout} {onContextMenu} {selecting} {selected} {onSelect} />
      {/if}
    </div>
  {/each}

  {#if ungrouped.length > 0}
    <div>
      {#if hasAnyGroups}
        <GroupHeader groupKey={DEFAULT_GROUP} label="Ungrouped" named={false} collapsed={collapsed[DEFAULT_GROUP]} onToggle={onToggle} onHeaderContextMenu={onGroupContextMenu} />
      {/if}
      {#if !collapsed[DEFAULT_GROUP]}
        <InstanceLayout instances={ungrouped} {layout} {onContextMenu} {selecting} {selected} {onSelect} />
      {/if}
    </div>
  {/if}
</div>
