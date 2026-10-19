<script lang="ts">
  import { Loader2 } from "lucide-svelte"
  import { invoke } from "@tauri-apps/api/core"
  import { Marked } from "marked"
  import type {
    Instance, ModrinthProjectDetails, ModrinthVersion, ModFile,
    CurseforgeModDetail, CurseforgeFile, CurseforgeGetModFilesResult
  } from "../../../types"
  import { getMinecraftVersion } from "../../../lib/version"
  import { sanitizeHtml } from "../../../lib/sanitize"
  import ProjectHeader from "./project-header.svelte"
  import InstallMenu from "./install-menu.svelte"

  let {
    source,
    projectId,
    projectSlug = "",
    author = "",
    projectType,
    selectedInstance,
    instances = [],
    onBack,
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
    onShowCreationToast?: (instanceName: string) => void
    onRefreshInstances?: () => void
  } = $props()

  const isModpack = $derived(projectType === "modpack")

  const marked = new Marked({
    breaks: true,
    gfm: true,
  })

  let details = $state<ModrinthProjectDetails | null>(null)
  let curseforgeDetails = $state<CurseforgeModDetail | null>(null)
  let isLoading = $state(true)
  let error = $state<string | null>(null)

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

  let renderedBody = $state("")

  let bodyHtml = $derived.by(() => {
    if (renderedBody) return sanitizeHtml(renderedBody)
    if (curseforgeDetails?.description) return sanitizeHtml(curseforgeDetails.description)
    return ""
  })

  let spinnerColor = $derived.by(() => {
    switch (projectType) {
      case "mod": return "text-[#16a34a]"
      case "modpack": return "text-[#3b82f6]"
      case "resourcepack": return "text-[#8b5cf6]"
      case "shaderpack": return "text-[#f59e0b]"
    }
  })

  $effect(() => {
    fetchDetails()
    loadInstalledFiles()
  })

  async function fetchDetails() {
    isLoading = true
    error = null
    try {
      if (source === "modrinth") {
        const idOrSlug = projectSlug || projectId
        const result = await invoke<ModrinthProjectDetails>("get_project_details", { idOrSlug })
        details = result
        if (result.body) {
          renderedBody = await marked.parse(result.body)
        }
        await fetchVersions()
      } else {
        const result = await invoke<CurseforgeModDetail>("get_curseforge_mod_details", { modId: parseInt(projectId) })
        curseforgeDetails = result
        await fetchCurseforgeFiles()
      }
    } catch (e) {
      error = String(e)
    } finally {
      isLoading = false
    }
  }

  async function fetchVersions() {
    if (!details) return
    isLoadingVersions = true
    try {
      const loaders = selectedInstance && (selectedInstance.loader === "fabric" || selectedInstance.loader === "neoforge" || selectedInstance.loader === "forge")
        ? [selectedInstance.loader]
        : undefined
      const gameVersions = selectedInstance
        ? [getMinecraftVersion(selectedInstance)]
        : undefined
      let result = await invoke<ModrinthVersion[]>("get_mod_versions", {
        idOrSlug: details.id,
        loaders: projectType === "mod" ? loaders : undefined,
        gameVersions: projectType === "mod" ? gameVersions : undefined,
      })
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
      const result = await invoke<CurseforgeGetModFilesResult>("get_curseforge_mod_files", {
        modId: curseforgeDetails.id,
        gameVersion: null,
        modLoaderType: null,
        pageSize: 20,
      })
      curseforgeFiles = result.data
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
    return null
  }

  function getTitle(): string {
    if (details?.title) return details.title
    if (curseforgeDetails?.name) return curseforgeDetails.name
    return ""
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

<div class="h-full overflow-hidden">
  {#if isLoading}
    <div class="flex items-center justify-center h-full">
      <Loader2 size={32} class="animate-spin {spinnerColor}" />
    </div>
  {:else if error}
    <div class="flex items-center justify-center h-full">
      <div class="text-center">
        <p class="text-red-400 mb-2">Failed to load project details</p>
        <p class="text-sm text-[var(--text-muted)]">{error}</p>
      </div>
    </div>
  {:else}
    <div class="h-full max-w-7xl mx-auto grid grid-cols-1">
      <!-- Left: Header + Description -->
      <div class="overflow-y-auto pr-2">
        <ProjectHeader
          {onBack}
          iconUrl={getIconUrl()}
          title={getTitle()}
          author={getAuthor()}
          projectUrl={getProjectUrl()}
          {bodyHtml}
        />
      </div>
    </div>

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
</div>
