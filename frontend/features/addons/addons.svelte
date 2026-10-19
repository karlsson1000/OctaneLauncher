<script lang="ts">
  import { tick } from "svelte"
  import { ADDON_CATEGORIES, type ContentSource } from "./adapters"
  import AddonSubtabs from "./components/addon-subtabs.svelte"
  import SourceDropdown from "./components/source-dropdown.svelte"
  import AddonSearch from "./components/addon-search.svelte"
  import AddonList from "./components/addon-list.svelte"
  import InstallTargetPicker from "./components/install-target-picker.svelte"
  import ProjectDetail from "./project-detail/project-detail.svelte"
  import {
    store, setSelectedInstance, loadInstances,
    handleStartCreating, setAddonsSubTab
  } from "../../lib/launcherStore.svelte"

  let viewDetail = $state<{
    source: "modrinth" | "curseforge"
    projectId: string
    projectSlug?: string
    projectType: string
    author?: string
  } | null>(null)

  let contentSource = $state<ContentSource>("modrinth")
  let searchQuery = $state("")

  $effect(() => {
    if (store.pendingAddonsSearch !== null) {
      searchQuery = store.pendingAddonsSearch
      store.pendingAddonsSearch = null
    }
  })

  let listScroller: HTMLDivElement | undefined
  let savedListScroll = 0

  function handleViewProjectDetail(
    source: "modrinth" | "curseforge",
    projectId: string,
    projectSlug: string | undefined,
    projectType: string,
    author?: string,
  ) {
    savedListScroll = listScroller?.scrollTop ?? 0
    viewDetail = { source, projectId, projectSlug, projectType, author }
  }

  async function goBackToList() {
    viewDetail = null
    await tick()
    if (listScroller) listScroller.scrollTop = savedListScroll
  }

  const modpackTab = $derived(store.addonsSubTab === "modpacks")
</script>

<div class="relative flex flex-col h-full overflow-hidden">
  <AddonSubtabs
    active={store.addonsSubTab}
    onSelect={(id) => { setAddonsSubTab(id); viewDetail = null }}
  />

  {#if !viewDetail}
    <div class="flex-shrink-0 px-8 pb-4">
      <div class="max-w-7xl mx-auto">
        <div class="flex gap-2 items-stretch">
          <SourceDropdown source={contentSource} onSelect={(s) => contentSource = s} />
          <AddonSearch
            bind:value={searchQuery}
            placeholder={ADDON_CATEGORIES[store.addonsSubTab].placeholder}
          />
        </div>
      </div>
    </div>
  {/if}

  <div class="flex-1 min-h-0 px-8 overflow-hidden">
    <div class="h-full max-w-7xl mx-auto grid grid-cols-1">
      <div class="overflow-y-auto" bind:this={listScroller}>
        <div class={viewDetail ? "hidden" : ""}>
          {#key `${contentSource}:${store.addonsSubTab}`}
            <AddonList
              source={contentSource}
              category={ADDON_CATEGORIES[store.addonsSubTab]}
              searchQuery={searchQuery}
              onViewProjectDetail={handleViewProjectDetail}
              selectedInstance={store.selectedInstance}
              instances={store.instances}
              onSetSelectedInstance={setSelectedInstance}
            />
          {/key}
        </div>
        {#if viewDetail}
          <ProjectDetail
            source={viewDetail.source}
            projectId={viewDetail.projectId}
            projectSlug={viewDetail.projectSlug}
            projectType={viewDetail.projectType}
            author={viewDetail.author}
            selectedInstance={store.selectedInstance}
            instances={store.instances}
            onShowCreationToast={handleStartCreating}
            onRefreshInstances={loadInstances}
            onBack={goBackToList}
          />
        {/if}
      </div>
    </div>
  </div>

  {#if !viewDetail && !modpackTab}
    <InstallTargetPicker
      selectedInstance={store.selectedInstance}
      instances={store.instances}
      onSelect={setSelectedInstance}
    />
  {/if}
</div>
