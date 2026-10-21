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

<div class="flex-shrink-0 px-8 pt-8 pb-4">
  <div class="max-w-7xl mx-auto">
    <div class="flex items-center gap-4">
      {#each tabs as tab, index}
        {@const Icon = tab.icon}
        {@const isActive = active === tab.id}
        <button
          onclick={() => onSelect(tab.id)}
          class="flex items-center gap-2 text-2xl font-semibold tracking-tight cursor-pointer {isActive ? tab.color : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
        >
          <Icon size={24} strokeWidth={2} />
          <span>{tab.label}</span>
        </button>
        {#if index < tabs.length - 1}
          <div class="h-8 w-px bg-[var(--bg-hover-strong)]"></div>
        {/if}
      {/each}
    </div>
  </div>
</div>
