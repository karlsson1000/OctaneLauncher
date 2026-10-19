<script lang="ts">
  import { Camera, TriangleAlert } from "lucide-svelte"

  let { title, message, isError = false }: {
    title: string
    message: string
    isError?: boolean
  } = $props()
</script>

<div class="flex flex-col items-center justify-center py-16">
  {#if isError}
    <TriangleAlert size={56} class="text-[var(--text-muted)] mb-4" strokeWidth={1.5} />
  {:else}
    <Camera size={56} class="text-[var(--text-muted)] mb-4" strokeWidth={1.5} />
  {/if}
  <h3 class="text-lg font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
  <p class="text-sm text-[var(--text-muted)] text-center max-w-md">{message}</p>
</div>
