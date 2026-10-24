<script lang="ts">
  import { ChevronDown, ChevronUp } from "lucide-svelte"
  import { store, setShowOnboarding } from "../../../lib/launcherStore.svelte"
  import type { LauncherSettings } from "../../../types"
  import MenuOption from "./menu-option.svelte"

  let { onChange, onClose }: {
    onChange: (settings: LauncherSettings) => void
    onClose: () => void
  } = $props()

  let isTabDropdownOpen = $state(false)
  let tabDropdownEl: HTMLDivElement | undefined = $state()

  const DEFAULT_TAB_OPTIONS = ["instances", "addons", "skins", "screenshots", "servers"]

  let selectedTab = $derived.by(() => {
    const tab = store.settings?.default_tab
    return tab && DEFAULT_TAB_OPTIONS.includes(tab) ? tab : "instances"
  })

  $effect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tabDropdownEl && !tabDropdownEl.contains(event.target as Node)) {
        isTabDropdownOpen = false
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  })
</script>

{#snippet toggleRow(label: string, desc: string, checked: boolean, toggle: () => void, id?: string)}
  <div {id} class="flex items-center gap-3 py-2.5">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="flex-1 min-w-0" onclick={toggle}>
      <p class="text-sm font-medium text-[var(--text-primary)] leading-tight">{label}</p>
      <p class="text-xs text-[var(--text-muted)] mt-0.5">{desc}</p>
    </div>
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onclick={toggle}
      class="relative w-9 h-[22px] rounded-md shrink-0 cursor-pointer {checked ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-hover-strong)]'}"
    >
      <span class="absolute top-[3px] left-[3px] w-4 h-4 rounded-[3px] bg-white transition-transform {checked ? 'translate-x-[14px]' : ''}"></span>
    </button>
  </div>
{/snippet}

<section class="rounded-md bg-[var(--bg-tertiary)] px-4 py-1.5 divide-y divide-[var(--border-subtle)]">
  <div class="flex items-center gap-3 py-2.5">
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-[var(--text-primary)] leading-tight">Default tab</p>
      <p class="text-xs text-[var(--text-muted)] mt-0.5">The tab shown when the launcher opens.</p>
    </div>
    <div class="relative shrink-0" bind:this={tabDropdownEl}>
      <button
        onclick={() => isTabDropdownOpen = !isTabDropdownOpen}
        class="relative h-8 pl-3 pr-8 bg-[var(--content-bg)] hover:bg-[var(--bg-hover)] text-sm text-[var(--text-primary)] rounded-md flex items-center gap-2 cursor-pointer capitalize min-w-[130px]"
      >
        {selectedTab}
        <div class="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          {#if isTabDropdownOpen}
            <ChevronUp size={14} strokeWidth={3} />
          {:else}
            <ChevronDown size={14} strokeWidth={3} />
          {/if}
        </div>
      </button>
      {#if isTabDropdownOpen}
        <div role="menu" class="dropdown-menu drop-right absolute right-0 z-[60] w-full min-w-[160px] bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] shadow-md rounded-md overflow-hidden p-1.5 flex flex-col mt-1.5">
          {#each DEFAULT_TAB_OPTIONS as tab (tab)}
            <MenuOption label={tab.charAt(0).toUpperCase() + tab.slice(1)} checked={selectedTab === tab} onclick={() => { onChange({ ...store.settings!, default_tab: tab } as LauncherSettings); isTabDropdownOpen = false }} />
          {/each}
        </div>
      {/if}
    </div>
  </div>

  {@render toggleRow(
    "Auto-navigate to console",
    "Switch to the Console tab when an instance launches.",
    store.settings?.auto_navigate_to_console ?? true,
    () => onChange({ ...store.settings!, auto_navigate_to_console: !(store.settings?.auto_navigate_to_console ?? true) } as LauncherSettings),
    "settings-console"
  )}

  {@render toggleRow(
    "Discord Rich Presence",
    "Show Octane Launcher activity on Discord.",
    store.settings?.discord_rpc ?? true,
    () => onChange({ ...store.settings!, discord_rpc: !(store.settings?.discord_rpc ?? true) } as LauncherSettings)
  )}

  {@render toggleRow(
    "Status privacy",
    "Hide your instance name in your friend status.",
    store.settings?.status_privacy ?? false,
    () => onChange({ ...store.settings!, status_privacy: !(store.settings?.status_privacy ?? false) } as LauncherSettings),
    "settings-status-privacy"
  )}

  {@render toggleRow(
    "Cat mode",
    "A cat lays down at the top of the launcher.",
    store.settings?.cat_mode ?? false,
    () => onChange({ ...store.settings!, cat_mode: !(store.settings?.cat_mode ?? false) } as LauncherSettings)
  )}

  <div class="flex items-center gap-3 py-2.5">
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-[var(--text-primary)] leading-tight">Run onboarding again</p>
      <p class="text-xs text-[var(--text-muted)] mt-0.5">Revisit first-time setup or import instances from other launchers.</p>
    </div>
    <button
      onclick={() => { onClose(); setShowOnboarding(true) }}
      class="h-8 px-3 shrink-0 text-sm font-medium rounded-md bg-[var(--content-bg)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] cursor-pointer"
    >
      Show onboarding
    </button>
  </div>
</section>
