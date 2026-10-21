<script lang="ts">
  import { fly } from "svelte/transition"
  import { invoke } from "@tauri-apps/api/core"
  import { ChevronDown, Check, LogIn, LogOut } from "lucide-svelte"
  import { store, setShowAccountDropdown, loadAccounts } from "../../../lib/launcherStore.svelte"

  let { isOpen }: { isOpen: boolean } = $props()

  const dropdownBtn = "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-sm text-sm cursor-pointer"

  const ownGame = $derived.by(() => {
    const uuid = store.activeAccount?.uuid
    if (!uuid) return undefined
    return [...store.runningInstances].find(name => store.runningInstanceOwners[name] === uuid)
  })

  $effect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest("[data-account-dropdown]") && !target.closest("[data-account-button]")) {
        setShowAccountDropdown(false)
      }
    }
    if (store.showAccountDropdown) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  })

  $effect(() => {
    if (!isOpen && store.showAccountDropdown) setShowAccountDropdown(false)
  })
</script>

<div class="relative px-1 mt-2 pb-1">
  {#if store.isAuthenticated && store.activeAccount}
    {@const activeAccount = store.activeAccount}
    <button
      data-account-button
      onclick={() => setShowAccountDropdown(!store.showAccountDropdown)}
      class="w-full flex items-center gap-2.5 px-2.5 h-12 rounded cursor-pointer {store.showAccountDropdown ? 'bg-[var(--bg-hover)]' : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]'}"
    >
      <div class="relative flex-shrink-0">
        <img
          src="https://avatar.mcindex.net/avatar/{activeAccount.username}/32"
          alt={activeAccount.username}
          class="w-8 h-8 rounded object-cover"
          style="image-rendering: pixelated;"
        />
      </div>
      <div class="flex-1 min-w-0 text-left">
        <div class="h-5 text-base leading-5 text-[var(--text-primary)] truncate font-semibold">{activeAccount.username}</div>
        <div class="text-[13px] font-normal leading-tight text-[var(--text-muted)] truncate">
          {#if ownGame}
            Playing <span class="text-[#3b82f6] font-semibold">{ownGame}</span>
          {:else}
            In launcher
          {/if}
        </div>
      </div>
      <ChevronDown size={16} strokeWidth={3} class="flex-shrink-0 text-[var(--text-secondary)] transition-transform {store.showAccountDropdown ? 'rotate-180' : ''}" />
    </button>
    {#if store.showAccountDropdown}
      <div
        data-account-dropdown
        transition:fly={{ y: -8, duration: 160 }}
        class="absolute top-full mt-1 left-1 right-1 z-50 border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] rounded shadow-md p-1.5"
      >
        <div class="flex flex-col">
          {#each [...store.accounts].sort((a, b) => Number(b.is_active) - Number(a.is_active)) as acc (acc.uuid)}
            <button
              onclick={async () => {
                if (!acc.is_active) {
                  try { await invoke("switch_account", { uuid: acc.uuid }); await loadAccounts() } catch {}
                }
                setShowAccountDropdown(false)
              }}
              class="{dropdownBtn} text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <img
                src="https://avatar.mcindex.net/avatar/{acc.username}/24"
                alt={acc.username}
                class="w-6 h-6 rounded object-cover flex-shrink-0"
                style="image-rendering: pixelated"
              />
              <span class="flex-1 min-w-0 text-left truncate">{acc.username}</span>
              {#if acc.is_active}
                <Check size={14} strokeWidth={3} class="text-[#16a34a] flex-shrink-0" />
              {/if}
            </button>
          {/each}
          <div class="h-px bg-[var(--border-default)] my-1"></div>
          <button
            onclick={async () => {
              try { await invoke("microsoft_login_and_store"); await loadAccounts(); setShowAccountDropdown(false) } catch {}
            }}
            class="{dropdownBtn} text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          >
            <LogIn size={16} strokeWidth={3} class="text-[#16a34a]" />
            Add Account
          </button>
          <button
            onclick={async () => {
              try { await invoke("remove_account", { uuid: activeAccount.uuid }); await loadAccounts(); setShowAccountDropdown(false) } catch {}
            }}
            class="{dropdownBtn} text-red-400 hover:bg-[var(--bg-hover)]"
          >
            <LogOut size={16} strokeWidth={3} />
            Sign Out
          </button>
        </div>
      </div>
    {/if}
  {:else}
    <button
      onclick={async () => {
        try { await invoke("microsoft_login_and_store"); await loadAccounts() } catch {}
      }}
      class="w-full flex items-center justify-center gap-2 px-2 h-12 rounded text-base font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] cursor-pointer"
    >
      <LogIn size={16} strokeWidth={2} class="text-[#16a34a]" />
      Sign in
    </button>
  {/if}
</div>
