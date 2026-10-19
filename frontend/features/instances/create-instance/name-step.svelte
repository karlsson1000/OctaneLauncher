<script lang="ts">
  import { AlertCircle, FileDown } from "lucide-svelte"

  let { value = $bindable(""), instanceExists, isCreating, onImport, onEnter }: {
    value: string
    instanceExists: boolean
    isCreating: boolean
    onImport: () => void
    onEnter: () => void
  } = $props()

  function autofocus(node: HTMLElement) {
    node.focus({ preventScroll: true })
  }
</script>

<div class="flex-1 min-h-0 flex flex-col">
  <h3 class="text-sm font-semibold text-[var(--text-primary)]">Name your instance</h3>

  <div class="mt-3">
    <label for="create-instance-name" class="sr-only">Instance Name</label>
    <input
      id="create-instance-name"
      type="text"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      bind:value
      use:autofocus
      onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter() } }}
      placeholder="My Minecraft Instance"
      class="w-full bg-[var(--bg-tertiary)] rounded-sm px-4 py-3.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none border transition-colors {instanceExists && value.trim() ? 'border-red-500/60' : 'border-transparent'}"
      disabled={isCreating}
    />
    {#if instanceExists && value.trim()}
      <div class="flex items-center gap-1.5 mt-2 text-xs text-red-400">
        <AlertCircle size={12} strokeWidth={2} />
        <span>An instance with this name already exists</span>
      </div>
    {/if}
  </div>

  <p class="text-[13px] text-[var(--text-secondary)] mt-5">Or upload a custom .mrpack or .zip instead</p>
  <button
    type="button"
    onclick={onImport}
    disabled={isCreating}
    class="mt-1.5 self-start h-7.5 px-3 rounded-sm text-sm font-medium cursor-pointer bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
  >
    <FileDown size={16} strokeWidth={2} />
    <span>Import from file</span>
  </button>
</div>
