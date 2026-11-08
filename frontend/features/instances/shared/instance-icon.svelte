<script lang="ts">
  import { Package } from "lucide-svelte"
  import type { Instance } from "../../../types"
  import { instanceIconSrc } from "../../../lib/icons"

  let { instance, className = "", iconSize = 36, strokeWidth = 2 }: {
    instance: Instance
    className?: string
    iconSize?: number
    strokeWidth?: number
  } = $props()

  const src = $derived(instanceIconSrc(instance.icon_path, instance.name))
</script>

{#if src}
  <img src={src} alt={instance.name} class={className} />
{:else}
  <div class="{className} bg-[var(--bg-secondary)] flex items-center justify-center">
    <Package size={iconSize} strokeWidth={strokeWidth} class="text-[var(--text-muted)]" />
  </div>
{/if}
