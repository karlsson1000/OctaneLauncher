<script lang="ts">
  import { invoke } from "@tauri-apps/api/core"
  import { Camera, ImagePlus, Loader2 } from "lucide-svelte"
  import type { Instance } from "../../../../types"
  import { instanceIconSrc, bumpInstanceIcon, clearInstanceIcon } from "../../../../lib/icons"

  let { instance, instanceIcon, onInstanceUpdated, onAlert, onConfirm }: {
    instance: Instance
    instanceIcon: string | null
    onInstanceUpdated: () => void
    onAlert: (alert: { isOpen: boolean; title: string; message: string; type: "warning" | "danger" | "success" | "info" }) => void
    onConfirm: (confirm: { isOpen: boolean; title: string; message: string; type: "warning" | "danger" | "success" | "info"; onConfirm: () => void }) => void
  } = $props()

  let localIcon = $state<string | null>(null)
  let isUploadingIcon = $state(false)
  let fileInputEl: HTMLInputElement | undefined = $state()

  $effect(() => {
    localIcon = instanceIcon
  })

  function handleIconClick() {
    fileInputEl?.click()
  }

  function handleIconChange(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      onAlert({ isOpen: true, title: "Invalid File", message: "Please select an image file (PNG, JPEG, WebP, or GIF)", type: "danger" })
      return
    }

    if (file.size > 25 * 1024 * 1024) {
      onAlert({ isOpen: true, title: "File Too Large", message: "Image must be smaller than 25MB", type: "danger" })
      return
    }

    isUploadingIcon = true

    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1]

        try {
          const iconPath = await invoke<string | null>("set_instance_icon", { instanceName: instance.name, imageData: base64 })
          bumpInstanceIcon(instance.name)
          localIcon = instanceIconSrc(iconPath, instance.name)
          onInstanceUpdated()
        } catch (error) {
          onAlert({ isOpen: true, title: "An error occurred", message: `Failed to set icon: ${String(error)}`, type: "danger" })
        } finally {
          isUploadingIcon = false
        }
      }
      reader.readAsDataURL(file)
    } catch (error) {
      isUploadingIcon = false
    }

    input.value = ""
  }

  function handleRemoveIcon() {
    onConfirm({
      isOpen: true,
      title: "Remove Icon",
      message: "Are you sure you want to remove this instance icon?",
      type: "warning",
      onConfirm: async () => {
        try {
          await invoke("remove_instance_icon", { instanceName: instance.name })
          clearInstanceIcon(instance.name)
          localIcon = null
          onInstanceUpdated()
        } catch (error) {
          onAlert({ isOpen: true, title: "An error occurred", message: `Failed to remove icon: ${String(error)}`, type: "danger" })
        }
      }
    })
  }
</script>

<div>
  <label for="instance-icon-input" class="block text-sm font-medium text-[var(--text-primary)] mb-2.5">Instance Icon</label>
  <div class="flex items-center gap-4">
    <input id="instance-icon-input" bind:this={fileInputEl} type="file" accept="image/*" onchange={handleIconChange} class="hidden" />
    {#if localIcon}
      <button onclick={handleIconClick} disabled={isUploadingIcon} class="w-12 h-12 flex-shrink-0 rounded-sm overflow-hidden relative cursor-pointer group bg-[var(--bg-tertiary)]">
        <img src={localIcon} alt={instance.name} class="w-full h-full object-cover" />
        <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Camera size={16} class="text-[var(--text-muted)]" />
        </div>
      </button>
    {:else}
      <button onclick={handleIconClick} disabled={isUploadingIcon} class="w-12 h-12 flex-shrink-0 border-2 border-dashed border-[var(--text-disabled)] hover:border-[var(--accent-primary)]/50 rounded-sm flex items-center justify-center bg-[var(--bg-tertiary)] cursor-pointer">
        {#if isUploadingIcon}
          <Loader2 size={18} class="text-[var(--accent-primary)] animate-spin" />
        {:else}
          <ImagePlus size={18} class="text-[var(--text-muted)]" />
        {/if}
      </button>
    {/if}

    {#if localIcon}
      <button onclick={handleRemoveIcon} disabled={isUploadingIcon} class="px-4 h-12 bg-[var(--bg-tertiary)] hover:bg-red-500/10 text-[var(--text-primary)] hover:text-red-400 rounded-sm text-sm font-medium disabled:opacity-50 cursor-pointer">
        Remove Icon
      </button>
    {:else}
      <button onclick={handleIconClick} disabled={isUploadingIcon} class="px-4 h-12 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-sm text-sm font-medium disabled:opacity-50 cursor-pointer">
        Upload Icon
      </button>
    {/if}
  </div>
</div>
