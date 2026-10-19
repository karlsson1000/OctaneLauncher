<script lang="ts">
  import { Check } from "lucide-svelte"

  let { label, checked, onclick }: {
    label: string
    checked: boolean
    onclick: () => void
  } = $props()
</script>

<button
  role="menuitem"
  {onclick}
  class="w-full flex items-center justify-between gap-2.5 px-2 py-2 text-sm text-left rounded-sm cursor-pointer select-none text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
>
  <span class="truncate min-w-0">{label}</span>
  {#if checked}<Check size={15} strokeWidth={3} class="text-[var(--accent-primary)] shrink-0 ml-2" />{/if}
</button>
