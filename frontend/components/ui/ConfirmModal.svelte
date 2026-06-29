<script lang="ts">
  import { AlertCircle, X, CheckCircle, XCircle, Info } from "lucide-svelte"

  let { isOpen, title, message, confirmText, cancelText, type = "warning", onConfirm, onCancel, checkboxLabel, checkboxChecked: controlledChecked, onCheckboxChange }: {
    isOpen: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    type?: "warning" | "danger" | "success" | "info"
    onConfirm: () => void
    onCancel: () => void
    checkboxLabel?: string
    checkboxChecked?: boolean
    onCheckboxChange?: (checked: boolean) => void
  } = $props()

  let isClosing = $state(false)
  let localChecked = $state(false)
  let backdropEl: HTMLDivElement | undefined = $state()

  $effect(() => {
    if (isOpen && backdropEl) backdropEl.focus()
  })

  let isChecked = $derived(controlledChecked !== undefined ? controlledChecked : localChecked)

  function handleCheckboxChange(checked: boolean) {
    localChecked = checked
    onCheckboxChange?.(checked)
  }

  function handleClose() {
    isClosing = true
    setTimeout(() => {
      isClosing = false
      onCancel()
    }, 150)
  }

  function handleConfirmClick() {
    isClosing = true
    setTimeout(() => {
      isClosing = false
      onConfirm()
    }, 150)
  }

  function getConfirmButtonStyle() {
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
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    bind:this={backdropEl}
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

      <div class="px-6 pb-4">
        <p class="text-sm text-[var(--text-primary)] whitespace-pre-line leading-snug">{message}</p>
        {#if checkboxLabel}
          <button
            type="button"
            onclick={() => handleCheckboxChange(!isChecked)}
            class="flex items-center gap-2 mt-3 cursor-pointer select-none bg-transparent border-0 p-0 w-full text-left"
          >
            <div
              class="w-4 h-4 rounded flex items-center justify-center transition-colors {isChecked ? 'bg-red-500' : 'border border-[var(--border-default)] bg-[var(--bg-elevated)]'}"
            >
              {#if isChecked}
                <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>
              {/if}
            </div>
            <span class="text-xs text-[var(--text-muted)]">{checkboxLabel}</span>
          </button>
        {/if}
      </div>

      <div class="flex items-center justify-end gap-3 px-6 pb-5 pt-1">
        <button
          onclick={handleClose}
          class="px-5 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover-strong)] text-[var(--text-primary)] rounded font-medium text-sm transition-colors cursor-pointer"
        >
          {cancelText || "Cancel"}
        </button>
        <button
          onclick={handleConfirmClick}
          class="px-5 py-3 rounded font-medium text-sm transition-colors cursor-pointer {getConfirmButtonStyle()}"
        >
          {confirmText || "Confirm"}
        </button>
      </div>
    </div>
  </div>
{/if}
