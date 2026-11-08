<script lang="ts">
  import { CheckCheck, Loader2, TriangleAlert, Minimize2, Maximize2 } from "lucide-svelte"
  import { fly } from "svelte/transition"
  import { toastStore } from "../../lib/toastStore.svelte"

  let compact = $state(false)
</script>

{#snippet progressTrack(progress: number, status: string, wrapperClass: string)}
  {@const pct = Math.min(100, Math.max(0, progress))}
  <div class={wrapperClass}>
    <div class="bars h-3">
      <div class="fill h-full {status === 'error' ? 'bg-red-500' : 'bg-[#16a34a]'}" style="--p: {pct}%"></div>
    </div>
  </div>
{/snippet}

{#if toastStore.progress.length > 0}
  <div class="absolute inset-x-8 bottom-4 z-40 flex flex-col items-end gap-2 pointer-events-none">
    {#each toastStore.progress as p (p.id)}
      <div
        transition:fly|global={{ y: 16, duration: 160 }}
        class="bg-[var(--bg-tertiary)] rounded-lg shadow-md border border-[var(--border-subtle)] select-none pointer-events-auto px-2.5 py-1.5
          {compact ? 'w-96 max-w-full' : 'w-full'}"
      >
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 flex items-center justify-center shrink-0">
            {#if p.status === "creating"}
              <Loader2 size={18} strokeWidth={2.5} class="animate-spin text-[#16a34a]" />
            {:else if p.status === "success"}
              <CheckCheck size={18} strokeWidth={2.5} class="text-[#16a34a]" />
            {:else}
              <TriangleAlert size={18} strokeWidth={2.5} class="text-red-400" />
            {/if}
          </div>

          {#if compact}
            <span class="text-sm text-[var(--text-primary)] truncate whitespace-nowrap min-w-0 max-w-[45%] mr-3">{p.title}</span>
          {:else}
            <div class="flex items-center gap-2 w-[376px] shrink-0 min-w-0">
              <span class="text-sm text-[var(--text-primary)] truncate whitespace-nowrap shrink-0 max-w-40">{p.title}</span>
              <span class="text-sm text-[var(--text-muted)] truncate whitespace-nowrap min-w-0 flex-1">{p.stage}</span>
            </div>
          {/if}
          {@render progressTrack(p.progress, p.status, "flex-1 min-w-[40px]")}
          <span class="text-sm text-[var(--text-secondary)] tabular-nums shrink-0 whitespace-nowrap w-9 text-right">{Math.round(p.progress)}%</span>

          <button
            type="button"
            onclick={() => (compact = !compact)}
            aria-label={compact ? "Expand progress bar" : "Switch to compact progress bar"}
            class="w-5 h-5 flex items-center justify-center rounded cursor-pointer shrink-0 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            {#if compact}
              <Maximize2 size={14} strokeWidth={2.5} />
            {:else}
              <Minimize2 size={14} strokeWidth={2.5} />
            {/if}
          </button>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .bars {
    --bars-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='5' height='12'%3E%3Crect width='2' height='12' rx='1'/%3E%3C/svg%3E");
    width: round(down, 100%, 5px);
    background-color: var(--bg-secondary);
    -webkit-mask: var(--bars-mask) repeat-x 0 0 / 5px 12px;
    mask: var(--bars-mask) repeat-x 0 0 / 5px 12px;
  }

  .fill {
    width: round(down, var(--p), 5px);
  }
</style>
