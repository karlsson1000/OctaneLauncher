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
    class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop"
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

      <div class="flex items-center gap-2 px-5 pb-5 pt-1 {checkboxLabel ? 'justify-between' : 'justify-end'}">
        {#if checkboxLabel}
          <div
            role="checkbox"
            tabindex="0"
            aria-checked={isChecked}
            aria-label={checkboxLabel}
            onclick={() => handleCheckboxChange(!isChecked)}
            onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") handleCheckboxChange(!isChecked) }}
            class="flex items-center gap-2 select-none text-left"
          >
            <div
              class="w-4 h-4 rounded-sm flex items-center justify-center transition-colors shrink-0 {isChecked ? 'bg-red-500' : 'border border-[var(--border-default)] bg-[var(--bg-elevated)]'}"
            >
              {#if isChecked}
                <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>
              {/if}
            </div>
            <span class="text-xs text-[var(--text-muted)] cursor-pointer">{checkboxLabel}</span>
          </div>
        {/if}
        <div class="flex items-center gap-2">
          <button
            onclick={handleClose}
            class="h-8 px-4 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-md font-medium text-sm transition-colors cursor-pointer"
          >
            {cancelText || "Cancel"}
          </button>
          <button
            onclick={handleConfirmClick}
            class="h-8 px-4 rounded-md font-medium text-sm transition-colors cursor-pointer flex items-center {getConfirmButtonStyle()}"
          >
            {confirmText || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
