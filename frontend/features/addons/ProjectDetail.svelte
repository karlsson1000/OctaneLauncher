<script lang="ts">
  import { X, Download, ArrowBigDownDash, Check, Loader2, ChevronUp } from "lucide-svelte"
  import { invoke } from "@tauri-apps/api/core"
  import { Marked } from "marked"
  import type {
    Instance, ModrinthProjectDetails, ModrinthVersion, ModFile,
    CurseforgeModDetail, CurseforgeFile, CurseforgeGetModFilesResult
  } from "../../types"
  import { getMinecraftVersion } from "../../lib/version"
  import { sanitizeHtml } from "../../lib/sanitize"

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

  let showVersionsPicker = $state(false)
  let versionsPickerRef: HTMLDivElement | undefined = $state()
  let versionsMenuRef: HTMLDivElement | undefined = $state()

  let latestVersionId = $derived(versions[0]?.id)
  let latestCurseforgeFileId = $derived(curseforgeFiles[0]?.id)

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
      default: return "text-[var(--text-muted)]"
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
    } catch (e) {
    } finally {
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
    } catch (e) {
    } finally {
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
    } catch (e) {
    }
  }

  function formatGameVersions(versions: string[]): string {
    return versions.slice(0, 3).join(", ")
  }

  function isInstalled(filename: string): boolean {
    return installedFiles.has(filename)
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
    } catch (e) {
    } finally {
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
    } catch (e) {
    } finally {
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

  function openProjectUrl(e: MouseEvent) {
    e.preventDefault()
    invoke("open_url", { url: getProjectUrl() }).catch(() => {})
  }
</script>

{#snippet versionsBody(asMenu: boolean = false)}
  {#if !isModpack && !selectedInstance}
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
    <div class="{asMenu ? 'flex flex-col' : 'space-y-2 pr-2'}">
      {#if source === "modrinth"}
        {#each (asMenu ? [...versions].reverse() : versions) as version (version.id)}
          {@const installed = isInstalled(version.files.find(f => f.primary)?.filename || version.files[0]?.filename || "")}
          {@const downloading = downloadingMap.has(version.id)}
          {@const done = completedIds.has(version.id)}
          {@const rowDisabled = downloading || installed || done || (!isModpack && !selectedInstance)}
          <svelte:element
            this={asMenu ? "button" : "div"}
            type={asMenu ? "button" : undefined}
            role={asMenu ? "menuitem" : undefined}
            disabled={asMenu ? rowDisabled : undefined}
            onclick={asMenu ? () => handleInstallVersion(version) : undefined}
            class="{asMenu ? 'w-full text-left flex items-center justify-between gap-2.5 px-2 py-2 rounded-sm select-none cursor-pointer hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent' : 'bg-[var(--bg-tertiary)] rounded-md p-3 flex items-center justify-between gap-2'}"
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
            {#if asMenu}
              <span class="flex items-center justify-center flex-shrink-0 w-7 h-7">
                {#if downloading}
                  <Loader2 size={20} strokeWidth={2.5} class="animate-spin text-[#16a34a]" />
                {:else if installed || done}
                  <Check size={20} strokeWidth={3} class="text-[#16a34a]" />
                {:else}
                  <ArrowBigDownDash size={22} strokeWidth={2.5} class="text-[#16a34a]" />
                {/if}
              </span>
            {:else}
              <button
                onclick={() => handleInstallVersion(version)}
                disabled={rowDisabled}
                class="px-3 py-2 bg-[#16a34a] hover:bg-[#22c55e] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium whitespace-nowrap cursor-pointer flex items-center gap-1 flex-shrink-0"
              >
                {#if downloading}
                  <Loader2 size={14} class="animate-spin" />
                {:else if installed || done}
                  Installed
                {:else}
                  <Download size={14} />Install
                {/if}
              </button>
            {/if}
          </svelte:element>
        {/each}
      {:else}
        {#each (asMenu ? [...curseforgeFiles].reverse() : curseforgeFiles) as file (file.id)}
          {@const installed = isInstalled(file.fileName)}
          {@const downloading = downloadingMap.has(file.id.toString())}
          {@const done = completedIds.has(file.id.toString())}
          {@const rowDisabled = downloading || installed || done || !file.downloadUrl || (!isModpack && !selectedInstance)}
          <svelte:element
            this={asMenu ? "button" : "div"}
            type={asMenu ? "button" : undefined}
            role={asMenu ? "menuitem" : undefined}
            disabled={asMenu ? rowDisabled : undefined}
            onclick={asMenu ? () => handleInstallCurseforgeFile(file) : undefined}
            class="{asMenu ? 'w-full text-left flex items-center justify-between gap-2.5 px-2 py-2 rounded-sm select-none cursor-pointer hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent' : 'bg-[var(--bg-tertiary)] rounded-md p-3 flex items-center justify-between gap-2'}"
          >
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-[var(--text-primary)] truncate">{file.fileName}</div>
              <div class="flex items-center gap-1.5 mt-0.5 min-w-0">
                <span class="text-xs text-[var(--text-muted)] truncate">
                  {file.releaseType === 1 ? "Release" : file.releaseType === 2 ? "Beta" : "Alpha"}
                  &middot; {(file.fileLength / 1024 / 1024).toFixed(1)} MB
                </span>
                {#if file.id === latestCurseforgeFileId}
                  <span class="flex-shrink-0 px-1.5 py-px rounded-full text-[10px] font-semibold bg-[#16a34a] text-white/80 leading-none">Latest</span>
                {/if}
              </div>
            </div>
            {#if asMenu}
              <span class="flex items-center justify-center flex-shrink-0 w-7 h-7">
                {#if downloading}
                  <Loader2 size={20} strokeWidth={2.5} class="animate-spin text-[#16a34a]" />
                {:else if installed || done}
                  <Check size={20} strokeWidth={3} class="text-[#16a34a]" />
                {:else}
                  <ArrowBigDownDash size={22} strokeWidth={2.5} class="text-[#16a34a]" />
                {/if}
              </span>
            {:else}
              <button
                onclick={() => handleInstallCurseforgeFile(file)}
                disabled={rowDisabled}
                class="px-3 py-2 bg-[#16a34a] hover:bg-[#22c55e] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium whitespace-nowrap cursor-pointer flex items-center gap-1 flex-shrink-0"
              >
                {#if downloading}
                  <Loader2 size={14} class="animate-spin" />
                {:else if installed}
                  Installed
                {:else}
                  <Download size={14} />Install
                {/if}
              </button>
            {/if}
          </svelte:element>
        {/each}
      {/if}
    </div>
  {/if}
{/snippet}

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
      <div class="relative space-y-4 bg-[var(--bg-tertiary)] rounded-md p-4">
        <button
          onclick={onBack}
          class="sticky top-2 float-right ml-2 z-20 flex items-center justify-center w-9 h-9 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
        >
          <X size={18} />
        </button>
        <!-- Header + Stats -->
        <div class="flex gap-4 items-center">
          {#if getIconUrl()}
            <img src={getIconUrl()} alt={getTitle()} class="w-16 h-16 rounded-md object-contain flex-shrink-0 bg-[var(--bg-tertiary)]" />
          {:else}
            <div class="w-16 h-16 rounded-md bg-gradient-to-br from-[#16a34a]/10 to-[#22c55e]/10 flex items-center justify-center flex-shrink-0"></div>
          {/if}
          <div class="flex-1 min-w-0">
            <h1 class="text-3xl font-bold text-[var(--text-primary)] truncate">
              <a href={getProjectUrl()} onclick={openProjectUrl} class="hover:underline">
                {getTitle()}
              </a>
            </h1>
            {#if getAuthor()}
              <p class="text-lg text-[var(--text-muted)]">by {getAuthor()}</p>
            {/if}
          </div>
        </div>

        <!-- Description -->
        {#if bodyHtml}
          <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
          <div class="prose-custom markdown-body" onclick={(e) => {
            const target = e.target as HTMLElement
            const anchor = target.closest('a')
            if (anchor?.href && anchor.href.startsWith('http')) {
              e.preventDefault()
              invoke('open_url', { url: anchor.href }).catch(() => {})
            }
          }}>
            {@html bodyHtml}
          </div>
        {/if}
      </div>
      </div>

    </div>

    <div class="absolute bottom-4 right-4 z-30" bind:this={versionsPickerRef}>
        {#if showVersionsPicker}
          <div role="menu" bind:this={versionsMenuRef} class="dropdown-menu absolute bottom-full right-0 mb-1.5 z-[60] w-80 min-w-[190px] bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] shadow-md rounded-md overflow-hidden p-1.5 flex flex-col max-h-60 overflow-y-auto custom-scrollbar">
            {@render versionsBody(true)}
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
              {isModpack ? getTitle() : selectedInstance ? `Installing to ${selectedInstance.name}` : "Installing to…"}
            </div>
          </div>
          <ChevronUp size={18} strokeWidth={3} class="text-[var(--text-secondary)] transition-transform {showVersionsPicker ? 'rotate-180' : ''}" />
        </button>
      </div>
  {/if}
</div>
