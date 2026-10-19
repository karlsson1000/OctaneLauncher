<script lang="ts">
  import { Download, ChevronUp } from "lucide-svelte"
  import type { ModrinthVersion, CurseforgeFile } from "../../../types"
  import VersionList from "./version-list.svelte"

  let {
    label, needsInstance, isLoadingVersions, source, versions, curseforgeFiles,
    latestVersionId, latestCurseforgeFileId, installedFiles, downloadingMap, completedIds,
    onInstall, onInstallFile,
  }: {
    label: string
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

  let showVersionsPicker = $state(false)
  let versionsPickerRef: HTMLDivElement | undefined = $state()
  let versionsMenuRef: HTMLDivElement | undefined = $state()

  $effect(() => {
    if (!showVersionsPicker) return
    void versions.length
    void curseforgeFiles.length
    if (versionsMenuRef) versionsMenuRef.scrollTop = versionsMenuRef.scrollHeight
  })

  $effect(() => {
    if (!showVersionsPicker) return
    const handleClickOutside = (e: MouseEvent) => {
      if (versionsPickerRef && !versionsPickerRef.contains(e.target as Node)) showVersionsPicker = false
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  })
</script>

<div class="absolute bottom-4 right-4 z-30" bind:this={versionsPickerRef}>
  {#if showVersionsPicker}
    <div role="menu" bind:this={versionsMenuRef} class="dropdown-menu absolute bottom-full right-0 mb-1.5 z-[60] w-80 min-w-[190px] bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] shadow-md rounded-md overflow-hidden p-1.5 flex flex-col max-h-60 overflow-y-auto custom-scrollbar">
      <VersionList
        {needsInstance}
        {isLoadingVersions}
        {source}
        {versions}
        {curseforgeFiles}
        {latestVersionId}
        {latestCurseforgeFileId}
        {installedFiles}
        {downloadingMap}
        {completedIds}
        {onInstall}
        {onInstallFile}
      />
    </div>
  {/if}
  <button
    onclick={() => showVersionsPicker = !showVersionsPicker}
    class="flex items-center gap-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 hover:bg-[var(--bg-hover)] cursor-pointer"
  >
    <div class="w-9 h-9 flex items-center justify-center flex-shrink-0">
      <Download size={26} class="text-[#16a34a]" />
    </div>
    <div class="text-left">
      <div class="text-[15px] font-semibold text-[var(--text-primary)] leading-none">Install</div>
      <div class="text-xs leading-tight text-[var(--text-muted)] max-w-[180px] truncate">
        {label}
      </div>
    </div>
    <ChevronUp size={18} strokeWidth={3} class="text-[var(--text-secondary)] transition-transform {showVersionsPicker ? 'rotate-180' : ''}" />
  </button>
</div>
