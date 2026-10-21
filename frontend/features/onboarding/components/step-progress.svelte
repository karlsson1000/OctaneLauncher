<script lang="ts">
  let { step }: { step: "welcome" | "import" | "done" } = $props()
</script>

<div class="flex items-center gap-1.5">
  {#each ["welcome", "import", "done"] as s (s)}
    <div
      class="h-1 rounded-full transition-all duration-300 {step === s ? 'w-6 bg-[var(--accent-primary)]' : 'w-2 bg-[var(--bg-hover)]'}"
    ></div>
  {/each}
</div>
