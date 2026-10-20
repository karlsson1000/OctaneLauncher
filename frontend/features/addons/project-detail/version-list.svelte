<script lang="ts">
  import { ArrowBigDownDash, Check, Loader2 } from "lucide-svelte"
  import type { ModrinthVersion, CurseforgeFile } from "../../../types"
  import { formatFileSize } from "../../../lib/format"

  let {
    needsInstance, isLoadingVersions, source, versions, curseforgeFiles,
    latestVersionId, latestCurseforgeFileId,
    installedFiles, downloadingMap, completedIds,
    onInstall, onInstallFile,
  }: {
    needsInstance: boolean
    isLoadingVersions: boolean
    source: "modrinth" | "curseforge"
    versions: ModrinthVersion[]
    curseforgeFiles: CurseforgeFile[]
    latestVersionId?: string
    latestCurseforgeFileId?: number
    installedFiles: Set<string>
    downloadingMap: Set<string>
    completedIds: Set<string>
    onInstall: (version: ModrinthVersion) => void
    onInstallFile: (file: CurseforgeFile) => void
  } = $props()

  function formatGameVersions(list: string[]): string {
    return list.slice(0, 3).join(", ")
  }
</script>

{#if needsInstance}
  <p class="text-sm text-[var(--text-muted)]">Select an instance to install</p>
{:else if isLoadingVersions}
  <div class="flex items-center justify-center py-8">
    <Loader2 size={20} class="animate-spin text-[#16a34a]" />
  </div>
{:else if source === "modrinth" && versions.length === 0}
  <p class="text-sm text-[var(--text-muted)]">No compatible versions found</p>
{:else if source === "curseforge" && curseforgeFiles.length === 0}
  <p class="text-sm text-[var(--text-muted)]">No files available</p>
{:else}
  <div class="flex flex-col">
    {#if source === "modrinth"}
      {#each [...versions].reverse() as version (version.id)}
        {@const installed = installedFiles.has(version.files.find(f => f.primary)?.filename || version.files[0]?.filename || "")}
        {@const downloading = downloadingMap.has(version.id)}
        {@const done = completedIds.has(version.id)}
        {@const rowDisabled = downloading || installed || done}
        <button
          type="button"
          role="menuitem"
          disabled={rowDisabled}
          onclick={() => onInstall(version)}
          class="w-full text-left flex items-center justify-between gap-2.5 px-2 py-2 rounded-sm select-none cursor-pointer hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-[var(--text-primary)] truncate">{version.name}</div>
            <div class="flex items-center gap-1.5 mt-0.5 min-w-0">
              <span class="text-xs text-[var(--text-muted)] truncate">
                {version.version_type === "release" ? "Release" : version.version_type === "beta" ? "Beta" : "Alpha"}
                {#if version.loaders.filter(l => l !== "minecraft" && l !== "iris" && l !== "optifine").length > 0}
                  &middot; {version.loaders.filter(l => l !== "minecraft" && l !== "iris" && l !== "optifine").join(", ")}
                {/if}
                &middot; {formatGameVersions(version.game_versions)}
              </span>
              {#if version.id === latestVersionId}
                <span class="flex-shrink-0 px-1.5 py-px rounded-full text-[10px] font-semibold bg-[#16a34a] text-white/80 leading-none">Latest</span>
              {/if}
            </div>
          </div>
          <span class="flex items-center justify-center flex-shrink-0 w-7 h-7">
            {#if downloading}
              <Loader2 size={20} strokeWidth={2.5} class="animate-spin text-[#16a34a]" />
            {:else if installed || done}
              <Check size={20} strokeWidth={3} class="text-[#16a34a]" />
            {:else}
              <ArrowBigDownDash size={22} strokeWidth={2.5} class="text-[#16a34a]" />
            {/if}
          </span>
        </button>
      {/each}
    {:else}
      {#each [...curseforgeFiles].reverse() as file (file.id)}
        {@const installed = installedFiles.has(file.fileName)}
        {@const downloading = downloadingMap.has(file.id.toString())}
        {@const done = completedIds.has(file.id.toString())}
        {@const rowDisabled = downloading || installed || done || !file.downloadUrl}
        <button
          type="button"
          role="menuitem"
          disabled={rowDisabled}
          onclick={() => onInstallFile(file)}
          class="w-full text-left flex items-center justify-between gap-2.5 px-2 py-2 rounded-sm select-none cursor-pointer hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-[var(--text-primary)] truncate">{file.fileName}</div>
            <div class="flex items-center gap-1.5 mt-0.5 min-w-0">
              <span class="text-xs text-[var(--text-muted)] truncate">
                {file.releaseType === 1 ? "Release" : file.releaseType === 2 ? "Beta" : "Alpha"}
                &middot; {formatFileSize(file.fileLength)}
              </span>
              {#if file.id === latestCurseforgeFileId}
                <span class="flex-shrink-0 px-1.5 py-px rounded-full text-[10px] font-semibold bg-[#16a34a] text-white/80 leading-none">Latest</span>
              {/if}
            </div>
          </div>
          <span class="flex items-center justify-center flex-shrink-0 w-7 h-7">
            {#if downloading}
              <Loader2 size={20} strokeWidth={2.5} class="animate-spin text-[#16a34a]" />
            {:else if installed || done}
              <Check size={20} strokeWidth={3} class="text-[#16a34a]" />
            {:else}
              <ArrowBigDownDash size={22} strokeWidth={2.5} class="text-[#16a34a]" />
            {/if}
          </span>
        </button>
      {/each}
    {/if}
  </div>
{/if}
