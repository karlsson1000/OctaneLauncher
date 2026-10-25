<script lang="ts">
  import { ArrowBigDownDash, Loader2, Pin } from "lucide-svelte"
  import { untrack } from "svelte"
  import type { Instance } from "../../../types"
  import { formatDownloads } from "../../../lib/format"
  import type {
    AddonCategoryConfig,
    AddonHit,
    AddonSourceAdapter,
    ContentSource,
  } from "../adapters"
  import { isModdedLoader } from "../adapters"

  const ITEMS_PER_PAGE = 20

  let {
    source,
    category,
    searchQuery = "",
    onViewProjectDetail,
    selectedInstance = null,
    instances = [],
    onSetSelectedInstance = (_: Instance) => {},
  }: {
    source: ContentSource
    category: AddonCategoryConfig
    searchQuery?: string
    onViewProjectDetail: (source: ContentSource, projectId: string, slug: string, projectType: string, author?: string) => void
    selectedInstance?: Instance | null
    instances?: Instance[]
    onSetSelectedInstance?: (instance: Instance) => void
  } = $props()

  const adapter: AddonSourceAdapter = $derived(category.sources[source])

  let hits: AddonHit[] = $state([])
  let isSearching = $state(false)
  let isLoadingMore = $state(false)
  let sentinelEl: HTMLDivElement | undefined = $state()
  let searchTimeout: ReturnType<typeof setTimeout> | undefined
  let offset = 0
  let hasMore = true

  let pinnedHit: AddonHit | null = $state(null)

  $effect(() => {
    if (!category.requiresModdedLoader) return
    if (!selectedInstance || !isModdedLoader(selectedInstance.loader)) {
      const modded = instances.filter(i => isModdedLoader(i.loader))
      if (modded.length > 0) onSetSelectedInstance(modded[0])
    }
  })

  $effect(() => {
    let cancelled = false
    adapter.loadPinned?.().then(hit => {
      if (!cancelled && hit) pinnedHit = hit
    })
    return () => { cancelled = true }
  })

  $effect(() => {
    searchQuery;
    if (searchTimeout) clearTimeout(searchTimeout)
    offset = 0
    hasMore = true
    const delay = untrack(() => hits.length === 0 ? 0 : 300)
    searchTimeout = setTimeout(() => {
      fetchHits(0, true)
    }, delay)
    return () => { clearTimeout(searchTimeout) }
  })

  $effect(() => {
    if (!sentinelEl) return
    const el = sentinelEl
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && !isSearching && hasMore) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  })

  const displayedHits = $derived.by(() => {
    if (pinnedHit && !searchQuery.trim() && hits.length > 0 && !hits.some(h => h.id === pinnedHit!.id)) {
      return [pinnedHit, ...hits]
    }
    return hits
  })

  let requestToken = 0

  async function fetchHits(offsetVal: number, replace: boolean) {
    const token = ++requestToken
    const query = searchQuery.trim()
    if (replace) isSearching = true
    else isLoadingMore = true
    try {
      const result = await adapter.search(query, offsetVal, ITEMS_PER_PAGE)
      if (token !== requestToken) return
      offset = offsetVal + result.hits.length
      hasMore = offsetVal + result.hits.length < result.total
      if (replace) {
        hits = result.hits
      } else {
        const ids = new Set(hits.map(h => h.id))
        hits = [...hits, ...result.hits.filter(h => !ids.has(h.id))]
      }
    } catch {} finally {
      if (token === requestToken) {
        if (replace) isSearching = false
        else isLoadingMore = false
      }
    }
  }

  function loadMore() {
    if (!hasMore || isLoadingMore || isSearching) return
    fetchHits(offset, false)
  }

  function openDetail(hit: AddonHit) {
    onViewProjectDetail(source, hit.id, hit.slug, category.projectType, hit.author)
  }
</script>

{#if category.requiresInstance && !selectedInstance}
  {@const EmptyIcon = category.fallbackIcon}
  <div class="max-w-7xl mx-auto">
    <div class="flex items-center justify-center py-20">
      <div class="text-center">
        <EmptyIcon size={64} class="mx-auto mb-4 text-[var(--text-muted)]" strokeWidth={1.5} />
        <h3 class="text-lg font-semibold text-[var(--text-primary)] mb-2">No instance selected</h3>
        <p class="text-sm text-[var(--text-muted)]">{category.noInstanceHint}</p>
      </div>
    </div>
  </div>
{:else}
  <div class="max-w-7xl mx-auto h-full flex flex-col">
    <div class="flex-1 min-h-0">
      <div class="space-y-2 overflow-y-auto pr-2">
        {#if isSearching && displayedHits.length === 0}
          <div class="space-y-2 animate-pulse motion-reduce:animate-none" aria-hidden="true">
            {#each Array(8) as _}
              <div class="flex items-center gap-4 rounded-lg bg-[var(--bg-tertiary)] p-3 pr-4">
                <div class="w-[86px] h-[86px] rounded-lg bg-[var(--bg-secondary)] shrink-0"></div>
                <div class="flex-1 space-y-2">
                  <div class="h-4 w-1/3 rounded bg-[var(--bg-secondary)]"></div>
                  <div class="h-3 w-3/4 rounded bg-[var(--bg-secondary)]"></div>
                  <div class="h-3 w-1/2 rounded bg-[var(--bg-secondary)]"></div>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          {#each displayedHits as hit (hit.id)}
            {@const isPinned = pinnedHit?.id === hit.id}
            {@const tags = (hit.categories ?? []).slice(0, 2)}
            <div
              class="flex items-center gap-4 rounded-lg bg-[var(--bg-tertiary)] p-3 pr-4 cursor-pointer outline-none focus-visible:ring-2"
              style={`--tw-ring-color: ${category.accentMain}`}
              role="button"
              tabindex="0"
              onkeydown={(e) => { if (e.key === 'Enter') openDetail(hit); }}
              onclick={() => openDetail(hit)}
            >
              {#if hit.imageUrl}
                <div class="w-[86px] h-[86px] shrink-0 rounded-lg overflow-hidden">
                  <img
                    src={hit.imageUrl}
                    alt=""
                    loading="lazy"
                    class="w-full h-full object-cover rounded-lg"
                  />
                </div>
              {:else}
                {@const FallbackIcon = category.fallbackIcon}
                <div class="w-[86px] h-[86px] shrink-0 flex items-center justify-center">
                  <FallbackIcon size={51} style={`color: ${category.accentMain}`} />
                </div>
              {/if}

              <div class="flex-1 min-w-0 self-stretch min-h-[86px] flex flex-col">
                <div class="flex items-baseline gap-2 min-w-0">
                  <h3 class="font-semibold text-base text-[var(--text-primary)] truncate">{hit.title}</h3>
                  <span class="text-xs text-[var(--text-muted)] truncate shrink-[2]">by {hit.author}</span>
                </div>
                <p class="text-sm leading-snug text-[var(--text-muted)] line-clamp-2">{hit.summary}</p>
                {#if isPinned || tags.length > 0}
                  <div class="flex items-center gap-1.5 flex-wrap mt-auto pt-1">
                    {#if isPinned}
                      <span
                        class="inline-flex items-center gap-1 rounded px-1.5 py-px text-xs font-medium"
                        style={`color: ${category.accentMain}; background-color: ${category.accentMain}1f`}
                      >
                        <Pin size={13} />
                        Featured
                      </span>
                    {/if}
                    {#each tags as cat}
                      <span class="rounded px-1.5 py-px text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)]">{cat}</span>
                    {/each}
                  </div>
                {/if}
              </div>

              <div class="shrink-0 text-right pl-2" title={`${hit.downloads.toLocaleString()} downloads`}>
                <div class="flex items-center justify-end gap-1.5 text-[var(--text-primary)]">
                  <ArrowBigDownDash size={21} style={`color: ${category.accentMain}`} />
                  <span class="text-lg font-semibold tabular-nums leading-none">{formatDownloads(hit.downloads)}</span>
                </div>
                <div class="text-xs text-[var(--text-muted)] mt-1">downloads</div>
              </div>
            </div>
          {/each}

          <div bind:this={sentinelEl} class="flex items-center justify-center py-4">
            {#if isLoadingMore}
              <Loader2 size={20} class="animate-spin" style={`color: ${category.accentMain}`} />
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
