<script lang="ts">
  import { CheckCheck, TriangleAlert, Trash2, X } from "lucide-svelte"
  import { fly } from "svelte/transition"
  import { toastStore, dismissToast } from "../../lib/toastStore.svelte"
</script>

{#if toastStore.toasts.length > 0}
  {@const visible = toastStore.toasts.slice(-3)}
  <div class="relative grid min-w-0">
    {#each visible as toast, i (toast.id)}
      {@const depth = visible.length - 1 - i}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div
        transition:fly|global={{ x: 12, duration: 200 }}
        class="[grid-area:1/1] h-7 max-w-[360px] min-w-0 flex items-center gap-2 pl-2.5 pr-1.5 rounded-md bg-[var(--bg-tertiary)] ring-2 ring-[var(--bg-primary)] cursor-pointer transition-[transform,opacity] duration-200 ease-out {depth > 0
          ? 'opacity-70'
          : 'opacity-100'}"
        inert={depth > 0}
        style="z-index: {i + 1}; transform: translateX(-{depth * 10}px)"
        onclick={() => dismissToast(toast.id)}
      >
        {#if toast.type === "success"}
          <CheckCheck size={16} strokeWidth={2.5} class="text-[#16a34a] flex-shrink-0" />
        {:else if toast.type === "info"}
          <Trash2 size={16} strokeWidth={2.5} class="text-red-400 flex-shrink-0" />
        {:else}
          <TriangleAlert size={16} strokeWidth={2.5} class="text-red-400 flex-shrink-0" />
        {/if}
        <span class="text-sm text-[var(--text-primary)] truncate">{toast.message}</span>
        <button
          title="Dismiss"
          onclick={(e) => { e.stopPropagation(); dismissToast(toast.id) }}
          class="flex-shrink-0 p-0.5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>
    {/each}
  </div>
{/if}
