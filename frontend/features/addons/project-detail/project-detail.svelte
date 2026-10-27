<script lang="ts">
  import { untrack } from "svelte"
  import { invoke } from "@tauri-apps/api/core"
  import type {
    Instance, ModrinthProjectDetails, ModrinthVersion, ModFile,
    CurseforgeModDetail, CurseforgeFile
  } from "../../../types"
  import { getMinecraftVersion } from "../../../lib/version"
  import ProjectHeader from "./project-header.svelte"
  import InstallMenu from "./install-menu.svelte"
  import {
    getCachedProjectDetails,
    loadProjectDetails,
    loadModrinthVersions,
    loadCurseforgeFiles,
  } from "../project-cache"

  let {
    source,
    projectId,
    projectSlug = "",
    author = "",
    projectType,
    selectedInstance,
    instances = [],
    onBack,
    previewTitle = "",
    previewIconUrl = null as string | null,
    onShowCreationToast = undefined as ((instanceName: string) => void) | undefined,
    onRefreshInstances = undefined as (() => void) | undefined,
  }: {
    source: "modrinth" | "curseforge"
    projectId: string
    projectSlug?: string
    author?: string
    projectType: string
    selectedInstance: Instance | null
    instances?: Instance[]
    onBack: () => void
    previewTitle?: string
    previewIconUrl?: string | null
    onShowCreationToast?: (instanceName: string) => void
    onRefreshInstances?: () => void
  } = $props()

  const isModpack = $derived(projectType === "modpack")

  const cachedDetails = untrack(() => getCachedProjectDetails(source, projectId, projectSlug))

  let details = $state<ModrinthProjectDetails | null>(cachedDetails?.modrinth ?? null)
  let curseforgeDetails = $state<CurseforgeModDetail | null>(cachedDetails?.curseforge ?? null)
  let bodyHtml = $state(cachedDetails?.bodyHtml ?? "")
  let isLoadingDetails = $state(!cachedDetails)
  let error = $state<string | null>(null)

  let isClosing = $state(false)
  let closeTimer: ReturnType<typeof setTimeout> | undefined
  let backdropArmed = false

  function requestClose() {
    if (isClosing) return
    isClosing = true
    closeTimer = setTimeout(() => {
      isClosing = false
      onBack()
    }, 150)
  }

  $effect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose()
    }
    window.addEventListener("keydown", handleKeydown)
    return () => {
      window.removeEventListener("keydown", handleKeydown)
      clearTimeout(closeTimer)
    }
  })

  let versions = $state<ModrinthVersion[]>([])
  let curseforgeFiles = $state<CurseforgeFile[]>([])
  let isLoadingVersions = $state(false)

  let installedFiles = $state<Set<string>>(new Set())
  let downloadingMap = $state<Set<string>>(new Set())
  let completedIds = $state<Set<string>>(new Set())

  let latestVersionId = $derived(versions[0]?.id)
  let latestCurseforgeFileId = $derived(curseforgeFiles[0]?.id)

  function uniqueInstanceName(name: string): string {
    return instances.some(i => i.name === name) ? `${name}-${Date.now()}` : name
  }

  $effect(() => {
    fetchDetails()
    loadInstalledFiles()
  })

  async function fetchDetails() {
    error = null
    try {
      const payload = await loadProjectDetails(source, projectId, projectSlug)
      details = payload.modrinth
      curseforgeDetails = payload.curseforge
      bodyHtml = payload.bodyHtml
    } catch (e) {
      error = String(e)
      return
    } finally {
      isLoadingDetails = false
    }

    if (source === "modrinth") {
      if (details) void fetchVersions()
    } else if (curseforgeDetails) {
      void fetchCurseforgeFiles()
    }
  }

  async function fetchVersions() {
    if (!details) return
    isLoadingVersions = true
    try {
      const loader = selectedInstance?.loader ?? null
      const loaders = projectType === "mod" && (loader === "fabric" || loader === "neoforge" || loader === "forge")
        ? [loader]
        : undefined
      const gameVersions = projectType === "mod" && selectedInstance
        ? [getMinecraftVersion(selectedInstance)]
        : undefined
      let result = await loadModrinthVersions(details.id, loaders, gameVersions)
      if (projectType === "modpack" || projectType === "resourcepack" || projectType === "shaderpack") {
        const seen = new Set<string>()
        result = result.filter(v => {
          const key = v.version_number || v.name
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      }
      versions = result
    } catch {} finally {
      isLoadingVersions = false
    }
  }

  async function fetchCurseforgeFiles() {
    if (!curseforgeDetails) return
    isLoadingVersions = true
    try {
      curseforgeFiles = await loadCurseforgeFiles(curseforgeDetails.id, 20)
    } catch {} finally {
      isLoadingVersions = false
    }
  }

  async function loadInstalledFiles() {
    if (!selectedInstance) return
    try {
      if (projectType === "mod") {
        const mods = await invoke<ModFile[]>("get_installed_mods", { instanceName: selectedInstance.name })
        installedFiles = new Set(mods.map(m => m.filename))
      } else if (projectType === "resourcepack") {
        const packs = await invoke<string[]>("get_installed_resourcepacks", { instanceName: selectedInstance.name })
        installedFiles = new Set(packs)
      } else if (projectType === "shaderpack") {
        const packs = await invoke<string[]>("get_installed_shaderpacks", { instanceName: selectedInstance.name })
        installedFiles = new Set(packs)
      }
    } catch {}
  }

  async function handleInstallVersion(version: ModrinthVersion) {
    if (!isModpack && !selectedInstance) return
    const primaryFile = version.files.find(f => f.primary) || version.files[0]
    if (!primaryFile && !isModpack) return
    downloadingMap = new Set(downloadingMap).add(version.id)
    try {
      if (source === "modrinth") {
        if (isModpack) {
          const instanceName = uniqueInstanceName(details?.title || version.name)
          onShowCreationToast?.(instanceName)
          await invoke("install_modpack", {
            modpackSlug: details!.id,
            instanceName,
            versionId: version.id,
            preferredGameVersion: null,
          })
          if (onRefreshInstances) setTimeout(() => onRefreshInstances!(), 500)
          completedIds = new Set(completedIds).add(version.id)
        } else {
          const targetCommand = projectType === "resourcepack" ? "download_resourcepack" : projectType === "shaderpack" ? "download_shaderpack" : "download_mod"
          await invoke<string>(targetCommand, {
            instanceName: selectedInstance!.name,
            downloadUrl: primaryFile!.url,
            filename: primaryFile!.filename,
            expectedSha1: primaryFile!.hashes?.sha1 ?? null,
          })
          installedFiles = new Set(installedFiles).add(primaryFile!.filename)
        }
      }
    } catch {} finally {
      const n = new Set(downloadingMap)
      n.delete(version.id)
      downloadingMap = n
    }
  }

  async function handleInstallCurseforgeFile(file: CurseforgeFile) {
    if (!file.downloadUrl) return
    if (!isModpack && !selectedInstance) return
    downloadingMap = new Set(downloadingMap).add(file.id.toString())
    const expectedSha1 = file.hashes?.find(h => h.algo === 1)?.value ?? null
    try {
      if (isModpack) {
        const filePath = await invoke<string>("download_curseforge_file_temp", {
          downloadUrl: file.downloadUrl,
          filename: file.fileName,
          expectedSha1,
        })
        const instanceName = uniqueInstanceName(curseforgeDetails?.name || file.fileName)
        onShowCreationToast?.(instanceName)
        await invoke("install_modpack_from_file", {
          filePath,
          instanceName,
          preferredGameVersion: null,
          projectId: curseforgeDetails?.id ?? file.modId,
        })
        if (onRefreshInstances) setTimeout(() => onRefreshInstances!(), 500)
        completedIds = new Set(completedIds).add(file.id.toString())
      } else {
        const targetFolder = projectType === "resourcepack" ? "resourcepacks" : projectType === "shaderpack" ? "shaderpacks" : "mods"
        await invoke<string>("download_curseforge_file", {
          instanceName: selectedInstance!.name,
          downloadUrl: file.downloadUrl,
          filename: file.fileName,
          targetFolder,
          expectedSha1,
        })
        installedFiles = new Set(installedFiles).add(file.fileName)
      }
    } catch {} finally {
      const n = new Set(downloadingMap)
      n.delete(file.id.toString())
      downloadingMap = n
    }
  }

  function getIconUrl(): string | null {
    if (details?.icon_url) return details.icon_url
    if (curseforgeDetails?.logo?.thumbnailUrl) return curseforgeDetails.logo.thumbnailUrl
    return previewIconUrl
  }

  function getTitle(): string {
    if (details?.title) return details.title
    if (curseforgeDetails?.name) return curseforgeDetails.name
    return previewTitle
  }

  function getAuthor(): string {
    if (author) return author
    if (curseforgeDetails?.authors?.[0]?.name) return curseforgeDetails.authors[0].name
    return ""
  }

  function getProjectUrl(): string {
    if (source === "modrinth") {
      return `https://modrinth.com/project/${projectSlug || projectId}`
    }
    const classPath = projectType === "modpack" ? "modpacks"
      : projectType === "resourcepack" ? "texture-packs"
      : projectType === "shaderpack" ? "shaders"
      : "mc-mods"
    return `https://www.curseforge.com/minecraft/${classPath}/${projectSlug}`
  }
</script>

<div
  role="presentation"
  class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop"
  class:closing={isClosing}
  onmousedown={(e) => { backdropArmed = e.target === e.currentTarget }}
  onmouseup={(e) => { backdropArmed = backdropArmed && e.target === e.currentTarget }}
  onclick={() => { if (backdropArmed) requestClose() }}
>
  <div
    role="dialog"
    aria-modal="true"
    aria-label={getTitle() || "Project details"}
    class="relative w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] rounded-md shadow-md modal-content"
    class:closing={isClosing}
  >
    {#if error}
      <div class="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
        <div>
          <p class="text-red-400 mb-2">Failed to load project details</p>
          <p class="text-sm text-[var(--text-muted)]">{error}</p>
        </div>
        <button
          onclick={requestClose}
          class="px-3 h-9 rounded-md bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-sm font-medium text-[var(--text-secondary)] cursor-pointer"
        >
          Close
        </button>
      </div>
    {:else}
      <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5">
        <ProjectHeader
          onBack={requestClose}
          iconUrl={getIconUrl()}
          title={getTitle()}
          author={getAuthor()}
          projectUrl={getProjectUrl()}
          {bodyHtml}
          loading={isLoadingDetails}
        />
      </div>

      {#if !isLoadingDetails}
        <InstallMenu
          label={isModpack ? getTitle() : selectedInstance ? `Installing to ${selectedInstance.name}` : "Installing to…"}
          needsInstance={!isModpack && !selectedInstance}
          {isLoadingVersions}
          {source}
          {versions}
          {curseforgeFiles}
          {latestVersionId}
          {latestCurseforgeFileId}
          {installedFiles}
          {downloadingMap}
          {completedIds}
          onInstall={handleInstallVersion}
          onInstallFile={handleInstallCurseforgeFile}
        />
      {/if}
    {/if}
  </div>
</div>
