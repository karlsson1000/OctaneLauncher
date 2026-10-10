<script lang="ts">
  import { AlertCircle, X, CheckCircle, XCircle, Info } from "lucide-svelte"

  let { isOpen, title, message, confirmText, type = "info", onClose }: {
    isOpen: boolean
    title: string
    message: string
    confirmText?: string
    type?: "warning" | "danger" | "success" | "info"
    onClose: () => void
  } = $props()

  let isClosing = $state(false)
  let confirmBtn: HTMLButtonElement | undefined = $state()

  $effect(() => {
    if (isOpen) {
      confirmBtn?.focus()
    }
  })

  function handleClose() {
    isClosing = true
    setTimeout(() => {
      isClosing = false
      onClose()
    }, 150)
  }

  function getButtonStyle() {
    switch (type) {
      case "danger": return "bg-red-500/10 hover:bg-red-500/20 text-red-400"
      case "success": return "bg-green-500/10 hover:bg-green-500/20 text-green-400"
      case "info": return "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400"
      case "warning": default: return "bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white"
    }
  }
</script>

{#if isOpen}
  <div
    class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop"
    class:closing={isClosing}
    role="presentation"
    onclick={handleClose}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') handleClose() }}
  >
    <div
      role="presentation"
      class="bg-[var(--content-bg)] rounded-md border border-[var(--border-subtle)] shadow-md w-full max-w-lg modal-content"
      class:closing={isClosing}
      onclick={(e) => e.stopPropagation()}
      style="pointer-events: auto"
    >
      <div class="grid grid-cols-[auto_1fr] gap-4 px-5 pt-5 pb-4">
        <div class="pt-1">
          {#if type === "danger"}
            <XCircle size={28} class="text-red-400" strokeWidth={2} />
          {:else if type === "success"}
            <CheckCircle size={28} class="text-green-400" strokeWidth={2} />
          {:else if type === "info"}
            <Info size={28} class="text-blue-400" strokeWidth={2} />
          {:else}
            <AlertCircle size={28} class="text-yellow-400" strokeWidth={2} />
          {/if}
        </div>
        <div class="min-w-0">
          <div class="flex items-start justify-between gap-3">
            <h2 class="text-lg font-semibold text-[var(--text-primary)] tracking-tight">{title}</h2>
            <button
              onclick={handleClose}
              class="p-1.5 -mt-1 hover:bg-[var(--bg-hover)] rounded-sm transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
          <p class="text-sm text-[var(--text-secondary)] whitespace-pre-line leading-snug mt-1">{message}</p>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 px-5 pb-5 pt-1">
        <button
          bind:this={confirmBtn}
          onclick={handleClose}
          class="h-8 px-4 rounded-md font-medium text-sm transition-colors cursor-pointer flex items-center {getButtonStyle()}"
        >
          {confirmText || "OK"}
        </button>
      </div>
    </div>
  </div>
{/if}
