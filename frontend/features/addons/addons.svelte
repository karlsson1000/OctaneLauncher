<script lang="ts">
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

  type DetailSelection = {
    source: "modrinth" | "curseforge"
    projectId: string
    projectSlug?: string
    projectType: string
    author?: string
    previewTitle: string
    previewIconUrl: string | null
  }

  let viewDetail = $state<DetailSelection | null>(null)

  let contentSource = $state<ContentSource>("modrinth")
  let searchQuery = $state("")

  $effect(() => {
    if (store.pendingAddonsSearch !== null) {
      searchQuery = store.pendingAddonsSearch
      store.pendingAddonsSearch = null
    }
  })

  function handleViewProjectDetail(selection: DetailSelection) {
    viewDetail = selection
  }

  const modpackTab = $derived(store.addonsSubTab === "modpacks")
</script>

<div class="relative flex flex-col h-full overflow-hidden">
  <div class="flex-shrink-0 px-8 pt-8 pb-4">
    <div class="max-w-7xl mx-auto">
      <div class="flex gap-2 items-stretch">
        <SourceDropdown source={contentSource} onSelect={(s) => contentSource = s} />
        <div class="w-90 flex-shrink-0 flex">
          <AddonSearch
            bind:value={searchQuery}
            placeholder={ADDON_CATEGORIES[store.addonsSubTab].placeholder}
          />
        </div>
        <AddonSubtabs
          active={store.addonsSubTab}
          onSelect={(id) => setAddonsSubTab(id)}
        />
      </div>
    </div>
  </div>

  <div class="flex-1 min-h-0 px-8 overflow-hidden">
    <div class="h-full max-w-7xl mx-auto grid grid-cols-1">
      <div class="overflow-y-auto">
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
    </div>
  </div>

  {#if !viewDetail && !modpackTab}
    <InstallTargetPicker
      selectedInstance={store.selectedInstance}
      instances={store.instances}
      onSelect={setSelectedInstance}
    />
  {/if}

  {#if viewDetail}
    <ProjectDetail
      source={viewDetail.source}
      projectId={viewDetail.projectId}
      projectSlug={viewDetail.projectSlug}
      projectType={viewDetail.projectType}
      author={viewDetail.author}
      previewTitle={viewDetail.previewTitle}
      previewIconUrl={viewDetail.previewIconUrl}
      selectedInstance={store.selectedInstance}
      instances={store.instances}
      onShowCreationToast={handleStartCreating}
      onRefreshInstances={loadInstances}
      onBack={() => viewDetail = null}
    />
  {/if}
</div>
