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
    class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop {isClosing ? 'closing' : ''}"
    class:closing={isClosing}
    role="presentation"
    onclick={handleClose}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') handleClose() }}
  >
    <div
      role="presentation"
      class="blur-border bg-[var(--bg-secondary)] rounded w-full max-w-md modal-content"
      class:closing={isClosing}
      onclick={(e) => e.stopPropagation()}
      style="pointer-events: auto"
    >
      <div class="flex items-center justify-between px-6 pt-6 pb-5">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center">
            {#if type === "danger"}
              <XCircle size={24} class="text-red-400" strokeWidth={2} />
            {:else if type === "success"}
              <CheckCircle size={24} class="text-green-400" strokeWidth={2} />
            {:else if type === "info"}
              <Info size={24} class="text-blue-400" strokeWidth={2} />
            {:else}
              <AlertCircle size={24} class="text-yellow-400" strokeWidth={2} />
            {/if}
          </div>
          <div>
            <h2 class="text-xl font-semibold text-[var(--text-primary)] tracking-tight">{title}</h2>
          </div>
        </div>
        <button
          onclick={handleClose}
          class="p-1.5 hover:bg-[var(--bg-hover-strong)] rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div class="px-6 pb-5">
        <p class="text-sm text-[var(--text-primary)] whitespace-pre-line leading-snug">{message}</p>
      </div>

      <div class="flex items-center justify-end gap-3 px-6 pb-6 pt-2">
        <button
          bind:this={confirmBtn}
          onclick={handleClose}
          class="px-5 py-3 rounded font-medium text-sm transition-colors cursor-pointer {getButtonStyle()}"
        >
          {confirmText || "OK"}
        </button>
      </div>
    </div>
  </div>
{/if}
