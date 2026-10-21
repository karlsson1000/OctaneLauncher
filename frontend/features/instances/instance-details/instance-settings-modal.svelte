<script lang="ts">
  import { X, Trash2 } from "lucide-svelte"
  import ConfirmModal from "../../../components/ui/confirm-modal.svelte"
  import AlertModal from "../../../components/ui/alert-modal.svelte"
  import type { Instance } from "../../../types"
  import { store, deleteInstanceOptimistically } from "../../../lib/launcherStore.svelte"
  import InstanceIconField from "./instance-settings/instance-icon-field.svelte"
  import InstanceNameField from "./instance-settings/instance-name-field.svelte"
  import MinecraftVersionField from "./instance-settings/minecraft-version-field.svelte"
  import LoaderVersionField from "./instance-settings/loader-version-field.svelte"
  import RamAllocationField from "./instance-settings/ram-allocation-field.svelte"

  let { isOpen, instance, instanceIcon, onClose, onInstanceUpdated, onInstanceDeleted }: {
    isOpen: boolean
    instance: Instance
    instanceIcon: string | null
    onClose: () => void
    onInstanceUpdated: () => void
    onInstanceDeleted: () => void
  } = $props()

  let isClosing = $state(false)
  let closeTimer: ReturnType<typeof setTimeout> | undefined
  let backdropArmed = false

  let confirmModal = $state<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
    onConfirm: () => void
  } | null>(null)
  let alertModal = $state<{
    isOpen: boolean
    title: string
    message: string
    type: "warning" | "danger" | "success" | "info"
  } | null>(null)

  function handleClose() {
    if (isClosing) return
    isClosing = true
    closeTimer = setTimeout(() => {
      isClosing = false
      onClose()
    }, 150)
  }

  $effect(() => {
    if (isOpen) {
      clearTimeout(closeTimer)
      isClosing = false
    }
  })

  function handleDelete() {
    if (store.runningInstances.has(instance.name)) {
      alertModal = { isOpen: true, title: "Instance is running", message: `Stop "${instance.name}" before deleting it.`, type: "warning" }
      return
    }
    confirmModal = {
      isOpen: true,
      title: "Delete Instance",
      message: `Are you sure you want to delete "${instance.name}"?\n\nThis action cannot be undone.`,
      type: "danger",
      onConfirm: () => {
        onClose()
        onInstanceDeleted()
        deleteInstanceOptimistically(instance.name, true)
      }
    }
  }
</script>

{#if isOpen}
  <div
    role="presentation"
    class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop"
    class:closing={isClosing}
    onmousedown={(e) => { backdropArmed = e.target === e.currentTarget }}
    onmouseup={(e) => { backdropArmed = backdropArmed && e.target === e.currentTarget }}
    onclick={() => { if (backdropArmed) handleClose() }}
    onkeydown={(e) => { if (e.key === 'Escape') handleClose() }}
  >
    <div
      role="presentation"
      class="border border-[var(--border-subtle)] bg-[var(--content-bg)] rounded-md w-full max-w-2xl shadow-md modal-content"
      class:closing={isClosing}
      onclick={(e) => e.stopPropagation()}
      style="pointer-events: auto"
    >
      <div class="flex items-center justify-between px-5 pt-5 pb-4">
        <h2 class="text-lg font-semibold text-[var(--text-primary)] tracking-tight">Instance Settings</h2>
        <button onclick={handleClose} class="p-1.5 hover:bg-[var(--bg-hover)] rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div class="px-5 pb-5">
        <div class="grid grid-cols-2 gap-x-5 gap-y-5 items-start">

          <!-- Icon -->
          <InstanceIconField {instance} {instanceIcon} {onInstanceUpdated} onAlert={(alert) => alertModal = alert} onConfirm={(confirm) => confirmModal = confirm} />

          <!-- Name -->
          <InstanceNameField {instance} {onClose} />

          <!-- Minecraft Version -->
          <MinecraftVersionField {instance} {onInstanceUpdated} onAlert={(alert) => alertModal = alert} onConfirm={(confirm) => confirmModal = confirm} />

          <!-- Loader version (Fabric / NeoForge / Forge) -->
          <LoaderVersionField {instance} {onInstanceUpdated} onAlert={(alert) => alertModal = alert} />

          <!-- RAM Allocation -->
          <RamAllocationField {instance} {onInstanceUpdated} onAlert={(alert) => alertModal = alert} />

          <!-- Delete -->
          <div class="col-span-2 pt-3">
            <button
              onclick={handleDelete}
              class="w-full px-4 h-11 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-sm font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trash2 size={16} />
              <span>Delete Instance</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if confirmModal}
  <ConfirmModal
    isOpen={confirmModal.isOpen}
    title={confirmModal.title}
    message={confirmModal.message}
    type={confirmModal.type}
    confirmText={confirmModal.type === "danger" ? "Delete" : "Confirm"}
    onConfirm={() => { const fn = confirmModal?.onConfirm; confirmModal = null; fn?.() }}
    onCancel={() => confirmModal = null}
  />
{/if}

{#if alertModal}
  <AlertModal
    isOpen={alertModal.isOpen}
    title={alertModal.title}
    message={alertModal.message}
    type={alertModal.type}
    onClose={() => alertModal = null}
  />
{/if}
