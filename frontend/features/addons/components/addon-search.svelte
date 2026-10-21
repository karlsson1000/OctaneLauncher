<script lang="ts">
  import { Search, X } from "lucide-svelte"

  let { value = $bindable(), placeholder }: {
    value: string
    placeholder: string
  } = $props()
</script>

<div class="relative flex-1 rounded-md bg-[var(--bg-tertiary)]">
  <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-20 pointer-events-none" strokeWidth={2} />
  <input
    type="text"
    {placeholder}
    bind:value
    class="w-full bg-transparent rounded-md pl-10 pr-10 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition-all relative z-10"
  />
  {#if value}
    <button
      onclick={() => (value = "")}
      class="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 h-6 w-6 flex items-center justify-center rounded cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]"
    >
      <X size={16} strokeWidth={2} />
    </button>
  {/if}
</div>
