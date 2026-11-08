<script lang="ts">
  import { ChevronDown } from "lucide-svelte"

  let { groupKey, label, named, collapsed, onToggle, onHeaderContextMenu }: {
    groupKey: string
    label: string
    named: boolean
    collapsed: boolean
    onToggle: (key: string) => void
    onHeaderContextMenu: (e: MouseEvent, key: string) => void
  } = $props()
</script>

<div
  role="presentation"
  class="flex items-center gap-1.5 mb-2 select-none"
  oncontextmenu={named ? (e) => onHeaderContextMenu(e, groupKey) : undefined}
>
  <ChevronDown
    size={16}
    strokeWidth={3}
    class="text-[var(--text-muted)] flex-shrink-0 transition-transform duration-150 {collapsed ? '-rotate-90' : ''}"
  />
  <span
    role="button"
    tabindex="0"
    class="text-sm font-semibold text-[var(--text-muted)] truncate cursor-pointer"
    onclick={() => onToggle(groupKey)}
    onkeydown={(e) => { if (e.key === 'Enter') onToggle(groupKey) }}
  >{label}</span>
</div>
