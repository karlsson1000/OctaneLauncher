<script lang="ts">
  import { fly, slide } from "svelte/transition"
  import { cubicIn, cubicOut } from "svelte/easing"
  import type { FabricVersion, NeoForgeVersion, ForgeVersion } from "../../../types"
  import { LOADERS, type LoaderType } from "./constants"
  import CreateDropdown from "./create-dropdown.svelte"
  import StatusBox from "./status-box.svelte"

  let { loaderType, selectedVersion, isCreating, loaderDir, hasUnavailableLoaders, isLoaderSupported, isLoadingFabric, isLoadingNeoforge, isLoadingForge, fabricVersions, selectedFabricVersion, neoforgeVersions, selectedNeoforgeVersion, forgeVersions, selectedForgeVersion, onLoaderChange, onFabricSelect, onNeoforgeSelect, onForgeSelect }: {
    loaderType: LoaderType
    selectedVersion: string
    isCreating: boolean
    loaderDir: number
    hasUnavailableLoaders: boolean
    isLoaderSupported: (loader: LoaderType, version: string) => boolean
    isLoadingFabric: boolean
    isLoadingNeoforge: boolean
    isLoadingForge: boolean
    fabricVersions: FabricVersion[]
    selectedFabricVersion: string
    neoforgeVersions: NeoForgeVersion[]
    selectedNeoforgeVersion: string
    forgeVersions: ForgeVersion[]
    selectedForgeVersion: string
    onLoaderChange: (loader: LoaderType) => void
    onFabricSelect: (version: string) => void
    onNeoforgeSelect: (version: string) => void
    onForgeSelect: (version: string) => void
  } = $props()
</script>

<div class="flex-1 min-h-0 flex flex-col">
  <h3 class="text-sm font-semibold text-[var(--text-primary)]">Choose a modloader</h3>
  {#if hasUnavailableLoaders}
    <p class="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">Greyed-out loaders don't support this version.</p>
  {/if}

  <div class="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Modloader">
    {#each LOADERS as loader (loader.id)}
      {@const isActive = loaderType === loader.id}
      {@const supported = isLoaderSupported(loader.id, selectedVersion)}
      <button
        type="button"
        role="radio"
        aria-checked={isActive}
        title={supported ? undefined : `${loader.label} isn't available for Minecraft ${selectedVersion}`}
        onclick={() => onLoaderChange(loader.id)}
        disabled={isCreating || !supported}
        class="px-3 h-9 rounded-sm text-[13px] font-medium flex items-center justify-center gap-2 {!supported ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] opacity-40 cursor-not-allowed' : isActive ? `${loader.bg} text-white cursor-pointer` : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] cursor-pointer'}"
      >
        <div class="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center {isActive ? 'border-white' : 'border-gray-500'}">
          {#if isActive}
            <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
          {/if}
        </div>
        <span>{loader.label}</span>
      </button>
    {/each}
  </div>

  {#if loaderType !== "vanilla"}
  <div class="mt-5 grid" transition:slide={{ duration: 250, easing: cubicOut }}>
  {#key loaderType}
  <div class="col-start-1 row-start-1" in:fly={{ x: 20 * loaderDir, duration: 250, delay: 120, easing: cubicOut }} out:fly={{ x: -20 * loaderDir, duration: 150, easing: cubicIn }}>
  {#if loaderType === "fabric"}
    <div>
      <label for="create-fabric-btn" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Fabric Loader</label>
      {#if isLoadingFabric}
        <StatusBox kind="loading" text="Loading versions..." color="#3b82f6" />
      {:else}
        <CreateDropdown
          id="fabric"
          options={fabricVersions.map((v) => ({ value: v.version, label: `${v.version}${v.stable ? " (Stable)" : ""}` }))}
          selected={selectedFabricVersion}
          display={`${selectedFabricVersion} ${fabricVersions.find((v) => v.version === selectedFabricVersion)?.stable ? "(Stable)" : ""}`}
          onPick={onFabricSelect}
        />
      {/if}
    </div>
  {/if}

  {#if loaderType === "neoforge"}
    <div>
      <label for="create-neoforge-btn" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">NeoForge Version</label>
      {#if isLoadingNeoforge}
        <StatusBox kind="loading" text="Loading NeoForge versions..." color="#f97316" />
      {:else if neoforgeVersions.length === 0}
        <StatusBox kind="empty" text={`No NeoForge versions available for Minecraft ${selectedVersion}`} />
      {:else}
        <CreateDropdown
          id="neoforge"
          options={neoforgeVersions.map((v) => ({ value: v.neoforge_version, label: v.neoforge_version }))}
          selected={selectedNeoforgeVersion}
          display={selectedNeoforgeVersion}
          onPick={onNeoforgeSelect}
        />
      {/if}
    </div>
  {/if}

  {#if loaderType === "forge"}
    <div>
      <label for="create-forge-btn" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Forge Version</label>
      {#if isLoadingForge}
        <StatusBox kind="loading" text="Loading Forge versions..." color="#e05d2e" />
      {:else if forgeVersions.length === 0}
        <StatusBox kind="empty" text={`No Forge versions available for Minecraft ${selectedVersion}`} />
      {:else}
        <CreateDropdown
          id="forge"
          options={forgeVersions.map((v) => ({ value: v.forge_version, label: v.forge_version }))}
          selected={selectedForgeVersion}
          display={selectedForgeVersion}
          onPick={onForgeSelect}
        />
      {/if}
    </div>
  {/if}
  </div>
  {/key}
  </div>
  {/if}
</div>
