import { invoke } from "@tauri-apps/api/core"
import { Marked } from "marked"
import type {
  CurseforgeFile,
  CurseforgeGetModFilesResult,
  CurseforgeModDetail,
  ModrinthProjectDetails,
  ModrinthVersion,
} from "../../types"
import type { ContentSource } from "./adapters"
import { sanitizeHtml } from "../../lib/sanitize"

export interface ProjectDetailsPayload {
  modrinth: ModrinthProjectDetails | null
  curseforge: CurseforgeModDetail | null
  bodyHtml: string
}

const DETAILS_TTL = 5 * 60 * 1000
const VERSIONS_TTL = 2 * 60 * 1000

const marked = new Marked({ gfm: true })

function createAsyncCache<T>(ttl: number) {
  const values = new Map<string, { value: T; ts: number }>()
  const inflight = new Map<string, Promise<T>>()

  function peek(key: string): T | undefined {
    const entry = values.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.ts > ttl) {
      values.delete(key)
      return undefined
    }
    return entry.value
  }

  function load(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = peek(key)
    if (cached !== undefined) return Promise.resolve(cached)

    const pending = inflight.get(key)
    if (pending) return pending

    const request = fetcher()
      .then((value) => {
        values.set(key, { value, ts: Date.now() })
        return value
      })
      .finally(() => inflight.delete(key))

    inflight.set(key, request)
    return request
  }

  return { peek, load }
}

const detailsCache = createAsyncCache<ProjectDetailsPayload>(DETAILS_TTL)
const versionsCache = createAsyncCache<ModrinthVersion[]>(VERSIONS_TTL)
const filesCache = createAsyncCache<CurseforgeFile[]>(VERSIONS_TTL)

function detailsKey(source: ContentSource, projectId: string, projectSlug?: string): string {
  return source === "modrinth" ? `modrinth:${projectSlug || projectId}` : `curseforge:${projectId}`
}

async function fetchProjectDetails(
  source: ContentSource,
  projectId: string,
  projectSlug?: string,
): Promise<ProjectDetailsPayload> {
  if (source === "modrinth") {
    const idOrSlug = projectSlug || projectId
    const result = await invoke<ModrinthProjectDetails>("get_project_details", { idOrSlug })
    const bodyHtml = result.body ? sanitizeHtml(await marked.parse(result.body)) : ""
    return { modrinth: result, curseforge: null, bodyHtml }
  }

  const result = await invoke<CurseforgeModDetail>("get_curseforge_mod_details", {
    modId: parseInt(projectId),
  })
  return {
    modrinth: null,
    curseforge: result,
    bodyHtml: result.description ? sanitizeHtml(result.description) : "",
  }
}

export function getCachedProjectDetails(
  source: ContentSource,
  projectId: string,
  projectSlug?: string,
): ProjectDetailsPayload | undefined {
  return detailsCache.peek(detailsKey(source, projectId, projectSlug))
}

export function loadProjectDetails(
  source: ContentSource,
  projectId: string,
  projectSlug?: string,
): Promise<ProjectDetailsPayload> {
  return detailsCache.load(detailsKey(source, projectId, projectSlug), () =>
    fetchProjectDetails(source, projectId, projectSlug),
  )
}

export function prefetchProjectDetails(
  source: ContentSource,
  projectId: string,
  projectSlug?: string,
): void {
  void loadProjectDetails(source, projectId, projectSlug).catch(() => {})
}

export function loadModrinthVersions(
  idOrSlug: string,
  loaders?: string[],
  gameVersions?: string[],
): Promise<ModrinthVersion[]> {
  const key = `${idOrSlug}|${loaders?.join(",") ?? ""}|${gameVersions?.join(",") ?? ""}`
  return versionsCache.load(key, () =>
    invoke<ModrinthVersion[]>("get_mod_versions", { idOrSlug, loaders, gameVersions }),
  )
}

export function loadCurseforgeFiles(modId: number, pageSize: number): Promise<CurseforgeFile[]> {
  return filesCache.load(`${modId}|${pageSize}`, () =>
    invoke<CurseforgeGetModFilesResult>("get_curseforge_mod_files", {
      modId,
      gameVersion: null,
      modLoaderType: null,
      pageSize,
    }).then(result => result.data),
  )
}
