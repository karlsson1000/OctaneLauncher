<script lang="ts">
  import { Trash2, Upload, ExternalLink, Loader2, X } from "lucide-svelte"
  import type { UploadState } from "./console-log"

  let { upload, canUpload, canClear, activeInstance, onUpload, onClear }: {
    upload: UploadState
    canUpload: boolean
    canClear: boolean
    activeInstance: string | null
    onUpload: () => void
    onClear: () => void
  } = $props()

  let uploadColor = $derived(
    upload.url
      ? "bg-[#16a34a]/10 hover:bg-[#16a34a]/20 text-[#16a34a]"
      : upload.error
        ? "bg-red-500/10 hover:bg-red-500/20 text-red-400"
        : "bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
  )
  let uploadLabel = $derived(
    upload.loading ? "Uploading..." : upload.url ? "Uploaded & Copied!" : (upload.error ?? "Upload to mclo.gs")
  )
</script>

<div class="flex items-center justify-end gap-2 mt-4">
  <button
    onclick={onUpload}
    disabled={!canUpload}
    class="px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed {uploadColor}"
    title="Upload logs to mclo.gs"
  >
    {#if upload.loading}
      <Loader2 size={16} strokeWidth={2} class="animate-spin" />
    {:else if upload.url}
      <ExternalLink size={16} strokeWidth={2} />
    {:else if upload.error}
      <X size={16} strokeWidth={2} />
    {:else}
      <Upload size={16} strokeWidth={2} />
    {/if}
    <span>{uploadLabel}</span>
  </button>
  <button
    onclick={onClear}
    disabled={!canClear}
    class="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-md font-medium text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <Trash2 size={16} strokeWidth={2} />
    <span>Clear {activeInstance || "Console"}</span>
  </button>
</div>
