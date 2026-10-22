<script lang="ts">
  import { Puzzle, Layers, Image, Sparkles } from "lucide-svelte"
  import type { AddonKind } from "../adapters"

  let { active, onSelect }: {
    active: AddonKind
    onSelect: (id: AddonKind) => void
  } = $props()

  const tabs: { id: AddonKind; label: string; icon: typeof Puzzle; color: string }[] = [
    { id: "mods", label: "Mods", icon: Puzzle, color: "text-[#16a34a]" },
    { id: "modpacks", label: "Modpacks", icon: Layers, color: "text-[#3b82f6]" },
    { id: "resourcepacks", label: "Resource Packs", icon: Image, color: "text-[#8b5cf6]" },
    { id: "shaderpacks", label: "Shader Packs", icon: Sparkles, color: "text-[#f59e0b]" },
  ]
</script>

<div class="flex-1 min-w-0 flex items-center gap-0.5 p-1 rounded-md bg-[var(--bg-tertiary)]">
  {#each tabs as tab (tab.id)}
    {@const Icon = tab.icon}
    {@const isActive = active === tab.id}
    <button
      onclick={() => onSelect(tab.id)}
      aria-pressed={isActive}
      class="flex-1 h-8 px-2.5 rounded-sm text-sm font-medium flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap {isActive
        ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm'
        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
    >
      <Icon size={14} strokeWidth={2} class={isActive ? tab.color : ''} />
      <span>{tab.label}</span>
    </button>
  {/each}
</div>
