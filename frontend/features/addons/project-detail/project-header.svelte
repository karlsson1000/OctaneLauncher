<script lang="ts">
  import { X } from "lucide-svelte"
  import { invoke } from "@tauri-apps/api/core"

  let { onBack, iconUrl, title, author, projectUrl, bodyHtml }: {
    onBack: () => void
    iconUrl: string | null
    title: string
    author: string
    projectUrl: string
    bodyHtml: string
  } = $props()

  function openProjectUrl(e: MouseEvent) {
    e.preventDefault()
    invoke("open_url", { url: projectUrl }).catch(() => {})
  }

  function handleBodyClick(e: MouseEvent) {
    const target = e.target as HTMLElement
    const anchor = target.closest("a")
    if (anchor?.href && anchor.href.startsWith("http")) {
      e.preventDefault()
      invoke("open_url", { url: anchor.href }).catch(() => {})
    }
  }
</script>

<div class="relative space-y-4 bg-[var(--bg-tertiary)] rounded-md p-4">
  <button
    onclick={onBack}
    class="sticky top-2 float-right ml-2 z-20 flex items-center justify-center w-9 h-9 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
  >
    <X size={18} />
  </button>
  <!-- Header + Stats -->
  <div class="flex gap-4 items-center">
    {#if iconUrl}
      <img src={iconUrl} alt={title} class="w-16 h-16 rounded-md object-contain flex-shrink-0 bg-[var(--bg-tertiary)]" />
    {:else}
      <div class="w-16 h-16 rounded-md bg-gradient-to-br from-[#16a34a]/10 to-[#22c55e]/10 flex items-center justify-center flex-shrink-0"></div>
    {/if}
    <div class="flex-1 min-w-0">
      <h1 class="text-3xl font-bold text-[var(--text-primary)] truncate">
        <a href={projectUrl} onclick={openProjectUrl} class="hover:underline">
          {title}
        </a>
      </h1>
      {#if author}
        <p class="text-lg text-[var(--text-muted)]">by {author}</p>
      {/if}
    </div>
  </div>

  <!-- Description -->
  {#if bodyHtml}
    <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
    <div class="prose-custom markdown-body" onclick={handleBodyClick}>
      {@html bodyHtml}
    </div>
  {/if}
</div>
