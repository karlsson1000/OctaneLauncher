<script lang="ts">
  import { onDestroy } from "svelte"
  import { FolderOpen } from "lucide-svelte"
  import type { Instance } from "../../../types"

  let { instance, groups, onAssign, onClose }: {
    instance: Instance
    groups: string[]
    onAssign: (group: string) => void
    onClose: () => void
  } = $props()

  let value = $state("")
  let closing = $state(false)
  let inputEl: HTMLInputElement | undefined = $state()
  let closeTimer: ReturnType<typeof setTimeout> | undefined

  $effect(() => {
    const t = setTimeout(() => inputEl?.focus(), 50)
    return () => clearTimeout(t)
  })

  onDestroy(() => clearTimeout(closeTimer))

  function close() {
    if (closing) return
    closing = true
    closeTimer = setTimeout(() => {
      closing = false
      onClose()
    }, 150)
  }

  function assign(group: string) {
    const name = group.trim()
    if (!name) return
    onAssign(name)
    close()
  }

  function submit() {
    if (!value.trim()) return
    assign(value)
  }
</script>

<div
  role="presentation"
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm modal-backdrop"
  class:closing
  onclick={close}
  onkeydown={(e) => { if (e.key === 'Escape') close() }}
>
  <div
    role="presentation"
    class="bg-[var(--content-bg)] rounded-md border border-[var(--border-subtle)] shadow-md w-80 modal-content p-5 space-y-4"
    class:closing
    onclick={(e) => e.stopPropagation()}
  >
    <div>
      <h3 class="text-lg font-semibold text-[var(--text-primary)] tracking-tight">Add to group</h3>
      <p class="text-[13px] text-[var(--text-muted)] mt-0.5 truncate">Move "{instance.name}" into a group</p>
    </div>

    {#if groups.length > 0}
      <div class="flex flex-col max-h-48 overflow-y-auto custom-scrollbar">
        {#each groups as group (group)}
          <button
            onclick={() => assign(group)}
            class="flex items-center gap-2.5 px-2 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-sm cursor-pointer text-left"
          >
            <FolderOpen size={16} strokeWidth={2} class="text-[var(--text-muted)] flex-shrink-0" />
            <span class="truncate">{group}</span>
          </button>
        {/each}
        <div class="h-px bg-[var(--border-default)] my-1"></div>
      </div>
    {/if}

    <div class="flex gap-2">
      <input
        bind:this={inputEl}
        type="text"
        placeholder="New group name"
        bind:value
        onkeydown={(e) => {
          if (e.key === "Enter") submit()
          if (e.key === "Escape") close()
        }}
        class="flex-1 min-w-0 h-9 bg-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-sm px-3 text-sm outline-none border border-transparent"
      />
      <button
        onclick={submit}
        disabled={!value.trim()}
        class="h-9 px-4 text-sm bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-md font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
      >
        Create
      </button>
    </div>
  </div>
</div>
