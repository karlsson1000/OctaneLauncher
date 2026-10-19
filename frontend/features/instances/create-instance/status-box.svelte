<script lang="ts">
  import { AlertCircle, Loader2 } from "lucide-svelte"

  let { kind, text, color }: { kind: "loading" | "empty"; text: string; color?: string } = $props()
</script>

<div class="flex items-center gap-2 text-[var(--text-muted)] text-sm py-3.5 px-4 bg-[var(--bg-tertiary)] rounded-sm">
  {#if kind === "loading"}
    <Loader2 size={16} class="animate-spin" style={color ? `color: ${color}` : undefined} />
  {:else}
    <AlertCircle size={16} />
  {/if}
  <span>{text}</span>
</div>
