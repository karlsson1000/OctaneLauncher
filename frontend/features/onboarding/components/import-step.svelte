<script lang="ts">
  import { Loader2, CheckCircle2, XCircle, ArrowRight, ArrowLeft, Check } from "lucide-svelte"
  import { fly } from "svelte/transition"
  import { cubicIn, cubicOut } from "svelte/easing"
  import type { ImportableInstance } from "../../../types"
  import { formatFileSize } from "../../../lib/format"

  const sourceLabels: Record<string, string> = {
    prism: "Prism",
    modrinth: "Modrinth",
    curseforge: "CurseForge",
  }

  const sourceIcons: Record<string, string> = {
    prism: "/prism.svg",
    modrinth: "/modrinth.svg",
    curseforge: "/curseforge.svg",
  }

  let {
    navDir, detected, isDetecting, detectFailed, isImporting, itemStatus,
    selected = $bindable(), onBack, onImport, onGetStarted,
  }: {
    navDir: number
    detected: ImportableInstance[]
    isDetecting: boolean
    detectFailed: boolean
    isImporting: boolean
    itemStatus: Record<string, "importing" | "done" | "error">
    selected: Record<string, boolean>
    onBack: () => void
    onImport: () => void
    onGetStarted: () => void
  } = $props()

  let dragValue: boolean | null = $state(null)

  let selectedCount = $derived(detected.filter(d => selected[d.path]).length)

  function rowPointerDown(e: PointerEvent, item: ImportableInstance) {
    if (e.button !== 0 || !item.mc_version || isImporting) return
    e.preventDefault()
    dragValue = !selected[item.path]
    selected[item.path] = dragValue
  }

  function rowPointerEnter(e: PointerEvent, item: ImportableInstance) {
    if (dragValue === null || !item.mc_version || isImporting) return
    if ((e.buttons & 1) === 0) {
      dragValue = null
      return
    }
    selected[item.path] = dragValue
  }

  function instanceMeta(item: ImportableInstance): string {
    if (!item.mc_version) return "Unknown version"
    const parts = [`Minecraft ${item.mc_version}`]
    if (item.loader && item.loader !== "vanilla") {
      parts.push(`${item.loader.charAt(0).toUpperCase() + item.loader.slice(1)}${item.loader_version ? ` ${item.loader_version}` : ""}`)
    }
    parts.push(formatFileSize(item.size_bytes))
    return parts.join("  ·  ")
  }
</script>

<svelte:window onpointerup={() => dragValue = null} />

<div class="col-start-1 row-start-1 flex flex-col justify-center" in:fly={{ x: 72 * navDir, duration: 420, delay: 200, easing: cubicOut }} out:fly={{ x: -72 * navDir, duration: 300, easing: cubicIn }}>
  <h1 class="text-2xl font-semibold text-[var(--text-primary)] tracking-tight text-center">
    {#if isDetecting}
      Looking for your instances
    {:else if detected.length > 0}
      Found {detected.length} {detected.length === 1 ? "instance" : "instances"}
    {:else}
      Nothing found
    {/if}
  </h1>
  <p class="mt-2 text-sm text-[var(--text-muted)] text-center leading-relaxed">
    {#if detectFailed}
      Couldn't scan this PC. You can create instances manually instead.
    {:else if detected.length > 0}
      From Modrinth, Prism and CurseForge. Pick what to bring over, nothing is moved or deleted.
    {:else}
      Scanning for Modrinth, Prism and CurseForge installations on this PC...
    {/if}
  </p>

  {#if isDetecting}
    <div class="mt-12 flex justify-center">
      <Loader2 size={22} class="animate-spin text-[var(--accent-primary)]" />
    </div>
  {:else if detected.length > 0}
    <div class="mt-3 max-h-[54vh] overflow-y-auto custom-scrollbar -mx-2 px-2 space-y-0.5 select-none">
      {#each detected as item (item.path)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions: drag-to-select rows; keyboard toggling via inner checkbox -->
        <label
          class="flex items-center gap-3 px-3 py-2.5 rounded-md {dragValue !== null ? 'no-scale' : ''} {!item.mc_version || isImporting
  ? 'opacity-40'
  : 'cursor-pointer hover:bg-[var(--bg-secondary)]'}"
          onpointerdown={(e) => rowPointerDown(e, item)}
          onpointerenter={(e) => rowPointerEnter(e, item)}
          onclick={(e) => e.preventDefault()}
        >
          <input
            type="checkbox"
            bind:checked={selected[item.path]}
            disabled={!item.mc_version || isImporting}
            class="sr-only"
          />
          {#key selected[item.path]}
            <span class="check-pop w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mr-1 {selected[item.path] ? 'bg-[#16a34a] border-[#16a34a]' : 'bg-transparent border-[var(--text-muted)]/60'}">
              {#if selected[item.path]}
                <Check size={16} strokeWidth={4} color="#0f1115" />
              {/if}
            </span>
          {/key}
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-[var(--text-primary)] truncate">{item.name}</div>
            <div class="text-xs text-[var(--text-muted)] truncate mt-0.5">{instanceMeta(item)}</div>
          </div>
          <img
            src={sourceIcons[item.source]}
            alt={sourceLabels[item.source]}
            title={sourceLabels[item.source]}
            class="w-5 h-5 flex-shrink-0"
            draggable="false"
          />
          {#if itemStatus[item.path] === "importing"}
            <Loader2 size={14} class="animate-spin text-[var(--accent-primary)] flex-shrink-0" />
          {:else if itemStatus[item.path] === "done"}
            <CheckCircle2 size={14} class="text-[#16a34a] flex-shrink-0" />
          {:else if itemStatus[item.path] === "error"}
            <XCircle size={14} class="text-red-500 flex-shrink-0" />
          {/if}
        </label>
      {/each}
    </div>
  {/if}

  <div class="mt-4 flex items-center justify-between">
    <button
      onclick={onBack}
      disabled={isImporting}
      class="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer disabled:opacity-40"
    >
      <ArrowLeft size={14} />
      Back
    </button>
    <div class="flex items-center gap-4">
      {#if detected.length > 0}
        <button
          onclick={onImport}
          disabled={selectedCount === 0 || isImporting}
          class="px-5 py-1.5 rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium cursor-pointer flex items-center gap-2"
        >
          {#if isImporting}
            <Loader2 size={14} class="animate-spin" />
            Importing...
          {:else}
            Import{selectedCount > 0 ? ` ${selectedCount}` : ""}
          {/if}
        </button>
      {:else}
        <button
          onclick={onGetStarted}
          class="flex items-center gap-1.5 px-5 py-1.5 rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium cursor-pointer"
        >
          Get started
          <ArrowRight size={14} />
        </button>
      {/if}
    </div>
  </div>
</div>
