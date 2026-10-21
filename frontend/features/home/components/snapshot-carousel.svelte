<script lang="ts">
  import { Package, ExternalLink, ChevronLeft, ChevronRight } from "lucide-svelte"
  import { invoke } from "@tauri-apps/api/core"
  import type { Snapshot, SnapshotsResponse } from "../../../types"
  import { cleanVersionName, formatRelativeDate } from "../../../lib/format"
  import { store } from "../../../lib/launcherStore.svelte"

  let snapshots = $state<Snapshot[]>([])
  let loadingSnapshots = $state(true)
  let snapshotStart = $state(0)

  let snapshotPageSize = $derived(store.showFriendsPanel ? 2 : 3)

  let maxSnapshotStart = $derived(Math.max(snapshots.length - snapshotPageSize, 0))

  $effect(() => {
    if (snapshotStart > maxSnapshotStart) snapshotStart = maxSnapshotStart
  })

  function goToSnapshot(i: number) {
    snapshotStart = Math.min(Math.max(i, 0), maxSnapshotStart)
  }

  const DOT_COUNT = 5
  const snapshotNavBtnClass = "w-7 h-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-[var(--text-muted)]"
  let dotWindow = $derived.by<number[]>(() => {
    const total = maxSnapshotStart + 1
    if (total <= DOT_COUNT) return Array.from({ length: total }, (_, i) => i)
    const start = Math.min(Math.max(snapshotStart - 2, 0), maxSnapshotStart - DOT_COUNT + 1)
    return [start, start + 1, start + 2, start + 3, start + 4]
  })

  $effect(() => {
    const loadSnapshots = async () => {
      try {
        const response = await fetch('https://launchercontent.mojang.com/v2/javaPatchNotes.json')
        const data: SnapshotsResponse = await response.json()
        snapshots = data.entries.slice(0, 12)
      } catch {
      } finally {
        loadingSnapshots = false
      }
    }
    loadSnapshots()
  })

  function getVersionUrl(version: string): string {
    const cleanVersion = cleanVersionName(version)
    return `https://www.minecraft.net/en-us/article/minecraft-${cleanVersion.toLowerCase().replace('.', '-')}`
  }
</script>

<div class="max-w-7xl mx-auto">
  <div class="mb-4 flex items-center justify-between">
    <h2 class="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Latest Updates</h2>
    {#if maxSnapshotStart > 0}
      <div class="flex items-center gap-1">
        <button
          onclick={() => goToSnapshot(snapshotStart - 1)}
          disabled={snapshotStart === 0}
          class={snapshotNavBtnClass}
        >
          <ChevronLeft size={18} strokeWidth={3} />
        </button>
        <button
          onclick={() => goToSnapshot(snapshotStart + 1)}
          disabled={snapshotStart >= maxSnapshotStart}
          class={snapshotNavBtnClass}
        >
          <ChevronRight size={18} strokeWidth={3} />
        </button>
      </div>
    {/if}
  </div>
  {#if !loadingSnapshots && snapshots.length === 0}
    <div class="bg-[var(--bg-tertiary)] rounded-md p-8 text-center">
      <p class="text-[var(--text-muted)]">Unable to load snapshots</p>
    </div>
  {:else if !loadingSnapshots}
    <div class="overflow-hidden">
      <div
        class="-mx-2 flex transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
        style="transform: translateX(-{snapshotStart * 100 / snapshotPageSize}%)"
      >
        {#each snapshots as snapshot (snapshot.id)}
          <div class="shrink-0 px-2" style="width: {100 / snapshotPageSize}%">
            <div
              role="button"
              tabindex="0"
              onclick={() => { invoke('open_url', { url: getVersionUrl(snapshot.version) }).catch(() => {}) }}
              onkeydown={(e) => { if (e.key === 'Enter') invoke('open_url', { url: getVersionUrl(snapshot.version) }).catch(() => {}) }}
              class="bg-[var(--bg-tertiary)] rounded-md overflow-hidden relative group cursor-pointer transition-all flex flex-col h-full"
            >
              <div class="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink size={16} class="text-[var(--text-primary)]" />
              </div>
              <div class="h-40 bg-[var(--bg-secondary)] overflow-hidden relative flex-shrink-0 z-0">
                {#if snapshot.image?.url}
                  <img src="https://launchercontent.mojang.com{snapshot.image.url}" alt={snapshot.title} class="w-full h-full object-cover" />
                {:else}
                  <div class="w-full h-full flex items-center justify-center">
                    <Package size={48} class="text-[var(--text-muted)]" />
                  </div>
                {/if}
                <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <div class="p-4 flex-1 flex flex-col relative z-0">
                <div class="flex items-center justify-between gap-2 mb-2">
                  <h3 class="text-sm font-semibold text-[var(--text-primary)] truncate">{cleanVersionName(snapshot.version)}</h3>
                  {#if snapshot.date}
                    <span class="text-xs text-[var(--text-muted)] whitespace-nowrap">{formatRelativeDate(snapshot.date)}</span>
                  {/if}
                </div>
                {#if snapshot.shortText}
                  <p class="text-xs text-[var(--text-muted)] line-clamp-2 leading-snug">{snapshot.shortText}</p>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
    {#if maxSnapshotStart > 0}
      <div class="mt-6 -mb-4 h-0 overflow-visible flex items-center justify-center gap-1.5">
        {#each dotWindow as p (p)}
          <button
            onclick={() => goToSnapshot(p)}
            aria-label="Show updates from card {p + 1}"
            class="h-1 rounded-full transition-all duration-300 cursor-pointer {snapshotStart === p ? 'w-6 bg-[var(--accent-primary)]' : 'w-2 bg-[var(--bg-hover)] hover:bg-[var(--text-muted)]'}"
          ></button>
        {/each}
      </div>
    {/if}
  {/if}
</div>
