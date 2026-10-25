<script lang="ts">
  import { Play, FolderOpen, Package, Settings } from "lucide-svelte"
  import type { Instance } from "../../../types"
  import { getMinecraftVersion, getFabricLoaderVersion, getNeoForgeVersion, getForgeVersion } from "../../../lib/version"
  import { formatPlaytime } from "../../../lib/format"
  import { store, handleLaunch } from "../../../lib/launcherStore.svelte"

  let { instance, icon, onOpenFolder, onOpenSettings }: {
    instance: Instance
    icon: string | null
    onOpenFolder: () => void
    onOpenSettings: () => void
  } = $props()

  const fabricLoaderVersion = $derived(getFabricLoaderVersion(instance))
  const neoforgeVersion = $derived(getNeoForgeVersion(instance))
</script>

<div class="flex-shrink-0 px-8 pt-8 pb-6">
  <div class="max-w-7xl mx-auto">
    <div class="flex items-center gap-4">
      <div class="flex-shrink-0">
        {#if icon}
          <div class="w-16 h-16 rounded-md overflow-hidden">
            <img src={icon} alt={instance.name} class="w-full h-full object-cover" />
          </div>
        {:else}
          <div class="w-16 h-16 rounded-md flex items-center justify-center">
            <Package size={48} class="text-[var(--text-muted)]" strokeWidth={1.5} />
          </div>
        {/if}
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-semibold text-[var(--text-primary)] tracking-tight leading-tight">{instance.name}</h1>
              {#if (instance.total_playtime_seconds ?? 0) > 0}
                <span class="px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-xs rounded">
                  {formatPlaytime(instance.total_playtime_seconds ?? 0)}
                </span>
              {/if}
            </div>
            <p class="text-sm text-[var(--text-muted)] mt-1">
              Minecraft {getMinecraftVersion(instance)}
              {" • "}
              {#if instance.loader === "fabric"}
                <span class="text-[#3b82f6]">Fabric</span>
                {#if fabricLoaderVersion}<span class="text-[var(--text-muted)]"> {fabricLoaderVersion}</span>{/if}
              {:else if instance.loader === "neoforge"}
                <span class="text-[#f97316]">NeoForge</span>
                {#if neoforgeVersion}<span class="text-[var(--text-muted)]"> {neoforgeVersion}</span>{/if}
              {:else if instance.loader === "forge"}
                <span class="text-[#e05d2e]">Forge</span>
                {#if getForgeVersion(instance)}<span class="text-[var(--text-muted)]"> {getForgeVersion(instance)}</span>{/if}
              {:else}
                <span class="text-[#16a34a]">Vanilla</span>
              {/if}
            </p>
          </div>
          <div class="flex gap-2">
            <button
              onclick={() => handleLaunch(instance)}
              disabled={!store.isAuthenticated || store.launchingInstanceName !== null || store.runningInstances.has(instance.name)}
              class="px-6 py-2 rounded-md font-semibold text-base flex items-center gap-2 cursor-pointer {store.launchingInstanceName === instance.name || store.runningInstances.has(instance.name) ? 'bg-red-500/10 text-red-400' : 'bg-[#16a34a] hover:bg-[#15803d] text-[#181a1f]'} disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if store.launchingInstanceName === instance.name || store.runningInstances.has(instance.name)}
                  <div class="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
                  <span>Running...</span>
              {:else}
                <Play size={20} fill="currentColor" strokeWidth={0} />
                <span>Play</span>
              {/if}
            </button>
            <button onclick={onOpenFolder} class="px-4 py-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-md font-medium text-sm flex items-center gap-2 cursor-pointer">
              <FolderOpen size={18} strokeWidth={2.5} /><span>Open Folder</span>
            </button>
            <button onclick={onOpenSettings} class="px-4 py-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-md font-medium text-sm flex items-center gap-2 cursor-pointer" title="Instance Settings">
              <Settings size={19} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
