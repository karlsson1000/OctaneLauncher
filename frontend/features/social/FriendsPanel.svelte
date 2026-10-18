<script lang="ts">
  import { tick } from "svelte"
  import { fly } from "svelte/transition"
  import { invoke } from "@tauri-apps/api/core"
  import { Users, UserPlus, UserX, Search, Loader2, LogIn, LogOut, ChevronDown, Inbox, Pencil, Star, Check, X, MoreHorizontal } from "lucide-svelte"
  import type { Friend, FriendRequest } from "../../types"
  import { storeGet, storeSet } from "../../lib/store"
  import { store, setShowAccountDropdown, loadAccounts } from "../../lib/launcherStore.svelte"
  import ContextMenu from "../../components/ui/ContextMenu.svelte"

  let { isOpen, isAuthenticated, activeAccountUuid }: { isOpen: boolean, isAuthenticated: boolean, activeAccountUuid?: string } = $props()

  let friends = $state<Friend[]>([])
  let requests = $state<FriendRequest[]>([])
  let isLoading = $state(false)
  let sending = $state(false)
  let sendError = $state<string | null>(null)
  let sendSuccess = $state<string | null>(null)
  let searchQuery = $state("")
  let nicknames = $state<Record<string, string>>({})
  let favorites = $state<string[]>([])
  let editingNicknameUuid = $state<string | null>(null)
  let nicknameDraft = $state("")
  let nicknameInput: HTMLInputElement | undefined = $state()
  let searchInput: HTMLInputElement | undefined = $state()
  let friendMenu = $state<{ x: number; y: number; friend: Friend } | null>(null)
  let collapsed = $state<Record<string, boolean>>({})
  let tab = $state<"friends" | "requests">("friends")
  let dataAccountUuid: string | undefined | null = null

  const storeKey = (prefix: string) => `${prefix}_${activeAccountUuid ?? "default"}`

  const displayName = (friend: Friend) => nicknames[friend.uuid] || friend.username
  const isFavorite = (friendUuid: string) => favorites.includes(friendUuid)
  const isOnline = (friend: Friend) => friend.status === "online" || friend.status === "ingame"

  let ownGame = $derived(activeAccountUuid ? [...store.runningInstances].find(name => store.runningInstanceOwners[name] === activeAccountUuid) : undefined)

  const statuses: Record<string, { color: string, label: string }> = {
    ingame: { color: "bg-[#3b82f6]", label: "In game" },
    online: { color: "bg-[#16a34a]", label: "Online" },
    offline: { color: "bg-[var(--bg-hover-strong)]", label: "Offline" },
  }

  const statusOf = (friend: Friend) => statuses[friend.status] ?? statuses.offline

  const avatarMask = "-webkit-mask-image: radial-gradient(circle 8px at 29px 28px, transparent 7.5px, #000 8px); mask-image: radial-gradient(circle 8px at 29px 28px, transparent 7.5px, #000 8px);"

  const tabButton = (active: boolean) =>
    `h-8 flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded text-base font-semibold cursor-pointer ${active ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"}`

  const dropdownBtn = "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-sm text-sm cursor-pointer"

  const loadNicknames = async () => {
    const uuid = activeAccountUuid
    const key = storeKey("nicknames")
    try {
      const result = (await storeGet<Record<string, string>>(key)) ?? {}
      if (uuid === activeAccountUuid) nicknames = result
    } catch {
      if (uuid === activeAccountUuid) nicknames = {}
    }
  }

  const loadFavorites = async () => {
    const uuid = activeAccountUuid
    const key = storeKey("favorites")
    try {
      const result = (await storeGet<string[]>(key)) ?? []
      if (uuid === activeAccountUuid) favorites = result
    } catch {
      if (uuid === activeAccountUuid) favorites = []
    }
  }

  const toggleFavorite = async (friendUuid: string) => {
    favorites = isFavorite(friendUuid)
      ? favorites.filter(u => u !== friendUuid)
      : [...favorites, friendUuid]
    try {
      await storeSet(storeKey("favorites"), $state.snapshot(favorites))
    } catch {
    }
  }

  const startNickname = (friend: Friend) => {
    nicknameDraft = nicknames[friend.uuid] ?? ""
    editingNicknameUuid = friend.uuid
  }

  const saveNickname = async (friendUuid: string, value: string) => {
    if (editingNicknameUuid !== friendUuid) return
    editingNicknameUuid = null
    const trimmed = value.trim().slice(0, 32)
    if (trimmed) {
      nicknames[friendUuid] = trimmed
    } else {
      delete nicknames[friendUuid]
    }
    try {
      await storeSet(storeKey("nicknames"), $state.snapshot(nicknames))
    } catch {
    }
  }

  const loadFriends = async (silent = false) => {
    const uuid = activeAccountUuid
    if (!silent) isLoading = true
    try {
      const result = await invoke<Friend[]>("get_friends")
      if (uuid === activeAccountUuid) friends = result
    } catch {
    } finally {
      if (uuid === activeAccountUuid) isLoading = false
    }
  }

  const loadRequests = async () => {
    const uuid = activeAccountUuid
    try {
      const result = await invoke<FriendRequest[]>("get_friend_requests")
      if (uuid === activeAccountUuid) requests = result
    } catch {
    }
  }

  const handleSendRequest = async (username: string) => {
    const name = username.trim()
    if (!name || sending) return
    sending = true
    sendError = null
    sendSuccess = null
    try {
      await invoke("send_friend_request", { username: name })
      searchQuery = ""
      sendSuccess = `Request sent to ${name}`
      loadRequests()
    } catch (error) {
      sendError = String(error)
    } finally {
      sending = false
    }
  }

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await invoke("accept_friend_request", { requestId })
      requests = requests.filter(r => r.id !== requestId)
      loadFriends()
    } catch {
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    try {
      await invoke("reject_friend_request", { requestId })
      requests = requests.filter(r => r.id !== requestId)
    } catch {
    }
  }

  const handleRemoveFriend = async (friendUuid: string) => {
    try {
      await invoke("remove_friend", { friendUuid })
      friends = friends.filter(f => f.uuid !== friendUuid)
    } catch {
    }
  }

  const clearSearch = () => {
    searchQuery = ""
    sendError = null
    sendSuccess = null
  }

  const toggleCollapsed = (key: string) => {
    collapsed[key] = !collapsed[key]
  }

  const goToAddFriend = async () => {
    tab = "requests"
    await tick()
    searchInput?.focus()
  }

  $effect(() => {
    if (editingNicknameUuid && nicknameInput) nicknameInput.focus()
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

  $effect(() => {
    const uuid = activeAccountUuid

    if (uuid !== dataAccountUuid) {
      dataAccountUuid = uuid
      friends = []
      requests = []
      nicknames = {}
      favorites = []
      isLoading = false
      editingNicknameUuid = null
      friendMenu = null
    }

    if (isOpen && isAuthenticated) {
      loadFriends()
      loadRequests()
      loadNicknames()
      loadFavorites()
      const interval = setInterval(() => {
        loadFriends(true)
        loadRequests()
      }, 30000)
      return () => clearInterval(interval)
    }
  })

  let query = $derived(searchQuery.trim().toLowerCase())

  let sortedFriends = $derived(
    [...friends].sort((a, b) => {
      const order: Record<string, number> = { ingame: 0, online: 1, offline: 2 }
      const byStatus = (order[a.status] ?? 2) - (order[b.status] ?? 2)
      if (byStatus !== 0) return byStatus
      return displayName(a).localeCompare(displayName(b))
    })
  )

  let favoriteFriends = $derived(sortedFriends.filter(f => isFavorite(f.uuid)))
  let onlineFriends = $derived(sortedFriends.filter(f => !isFavorite(f.uuid) && isOnline(f)))
  let offlineFriends = $derived(sortedFriends.filter(f => !isFavorite(f.uuid) && !isOnline(f)))

  let canSendRequest = $derived(
    query !== "" && !friends.some(f => f.username.toLowerCase() === query)
  )
</script>

{#snippet friendRow(friend: Friend)}
  {@const online = isOnline(friend)}
  {@const status = statusOf(friend)}
  <div class="group flex items-center gap-2.5 px-1.5 py-1 rounded-md hover:bg-[var(--bg-active)]">
    <div class="relative flex-shrink-0">
      <img
        src="https://avatar.mcindex.net/avatar/{friend.username}/32"
        alt={friend.username}
        class="w-8 h-8 rounded object-cover transition-opacity {online ? '' : 'opacity-50 group-hover:opacity-100'}"
        style={avatarMask}
        loading="lazy"
        decoding="async"
      />
      <span
        title={status.label}
        class="absolute -bottom-px -right-0.5 w-2.5 h-2.5 rounded-full {status.color}"
      ></span>
    </div>

    <div class="flex-1 min-w-0 {online ? '' : 'opacity-60 group-hover:opacity-100'} transition-opacity">
      {#if editingNicknameUuid === friend.uuid}
        <input
          type="text"
          bind:this={nicknameInput}
          bind:value={nicknameDraft}
          maxlength={32}
          placeholder={friend.username}
          onkeydown={(e) => {
            if (e.key === "Enter") saveNickname(friend.uuid, nicknameDraft)
            else if (e.key === "Escape") editingNicknameUuid = null
          }}
          onblur={() => saveNickname(friend.uuid, nicknameDraft)}
          class="block w-full min-w-0 h-5 bg-[var(--bg-secondary)] rounded px-1 -mx-1 py-0 text-base leading-5 font-medium text-[var(--text-primary)] focus:outline-none"
        />
      {:else}
        <div
          class="h-5 text-base leading-5 text-[var(--text-primary)] truncate font-medium"
          title={nicknames[friend.uuid] ? friend.username : undefined}
        >
          {displayName(friend)}
        </div>
      {/if}
      <div class="text-[13px] leading-tight text-[var(--text-muted)] truncate">
        {#if friend.status === "ingame" && friend.current_instance}
          Playing <span class="text-[#3b82f6] font-semibold">{friend.current_instance}</span>
        {:else if friend.status === "ingame"}
          In game
        {:else if friend.status === "online"}
          In launcher
        {:else}
          Offline
        {/if}
      </div>
    </div>

    <button
      onmousedown={(e) => { if (friendMenu) e.stopPropagation() }}
      onclick={(e) => {
        if (friendMenu?.friend.uuid === friend.uuid) friendMenu = null
        else {
          const rect = e.currentTarget.getBoundingClientRect()
          friendMenu = { x: rect.left, y: rect.bottom + 4, friend }
        }
      }}
      class="flex-shrink-0 p-1 rounded cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:opacity-100 {friendMenu?.friend.uuid === friend.uuid ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}"
    >
      <MoreHorizontal size={16} strokeWidth={2.5} />
    </button>
  </div>
{/snippet}

{#snippet group(key: string, label: string, list: Friend[])}
  {#if list.length > 0}
    <section>
      <div
        role="presentation"
        class="flex items-center gap-1.5 w-full px-1 pt-3 pb-1 mb-1 select-none"
      >
        <ChevronDown
          size={16}
          strokeWidth={3}
          class="text-[var(--text-muted)] flex-shrink-0 transition-transform duration-150 {collapsed[key] ? '-rotate-90' : ''}"
        />
        <span
          role="button"
          tabindex="0"
          class="text-sm font-semibold text-[var(--text-muted)] truncate cursor-pointer"
          onclick={() => toggleCollapsed(key)}
          onkeydown={(e) => { if (e.key === 'Enter') toggleCollapsed(key) }}
        >{label} ({list.length})</span>
      </div>
      {#if !collapsed[key]}
        <div class="space-y-0.5">
          {#each list as friend (friend.uuid)}
            {@render friendRow(friend)}
          {/each}
        </div>
      {/if}
    </section>
  {/if}
{/snippet}

<div
  class="flex-shrink-0 bg-[var(--bg-primary)] h-full overflow-hidden transition-all duration-200 ease-in-out {isOpen ? 'w-60' : 'w-0 -mr-4'}"
>
  <div class="w-60 h-full flex flex-col">
    <div class="relative px-1 pb-1">
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

    <div class="flex items-center gap-1 px-1 pt-2 pb-1">
      <button onclick={() => tab = "friends"} class={tabButton(tab === "friends")}>
        Friends
      </button>
      <button onclick={() => tab = "requests"} class={tabButton(tab === "requests")}>
        Requests
        {#if requests.length > 0}
          <span class="min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none">{requests.length}</span>
        {/if}
      </button>
    </div>

    {#if !isAuthenticated}
      <div class="flex-1 flex flex-col items-center justify-center px-3 py-6 text-center">
        <LogIn size={32} class="text-[var(--text-muted)] mb-3" />
        <p class="text-sm text-[var(--text-secondary)] font-medium">Sign in to see friends</p>
      </div>
    {:else}
      <div class="flex-1 flex flex-col min-h-0">
        {#if tab === "friends"}
          <div class="flex-1 overflow-y-auto pb-2">
            {#if isLoading && friends.length === 0}
              <div class="animate-pulse">
                <div class="flex items-center gap-1.5 px-1 pt-4 pb-1 mb-2">
                  <div class="w-3.5 h-3.5 rounded bg-[var(--bg-tertiary)] flex-shrink-0"></div>
                  <div class="h-3.5 w-24 rounded bg-[var(--bg-tertiary)]"></div>
                </div>
                <div class="space-y-1 px-1.5">
                  {#each [120, 88, 104, 72, 112, 96] as nameWidth, i}
                    <div class="flex items-center gap-2.5 py-1">
                      <div class="w-8 h-8 rounded bg-[var(--bg-tertiary)]"></div>
                      <div class="flex-1 space-y-1.5">
                        <div class="h-3 rounded bg-[var(--bg-tertiary)]" style="width: {nameWidth}px"></div>
                        <div class="h-2.5 rounded bg-[var(--bg-tertiary)]" style="width: {[76, 54, 68, 48, 72, 58][i]}px"></div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {:else if friends.length === 0}
              <div class="flex flex-col items-center justify-center py-10 text-center px-3">
                <Users size={32} class="text-[var(--text-muted)] mb-3" />
                <p class="text-sm text-[var(--text-secondary)] font-medium">No friends yet</p>
                <p class="text-xs text-[var(--text-muted)] mt-1">Add someone by username to see when they're playing</p>
                <button
                  onclick={goToAddFriend}
                  class="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] cursor-pointer"
                >
                  <UserPlus size={14} strokeWidth={2.5} />
                  Add a friend
                </button>
              </div>
            {:else}
              {@render group("favorites", "Favorites", favoriteFriends)}
              {@render group("online", "Online", onlineFriends)}
              {@render group("offline", "Offline", offlineFriends)}
            {/if}
          </div>
        {:else}
          <div class="px-1 pt-1 pb-1 space-y-1">
            <div class="relative">
              <Search size={14} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                bind:this={searchInput}
                placeholder="Add a friend"
                bind:value={searchQuery}
                oninput={() => { sendError = null; sendSuccess = null }}
                onkeydown={(e) => {
                  if (e.key === "Enter" && canSendRequest) handleSendRequest(searchQuery)
                  else if (e.key === "Escape") clearSearch()
                }}
                class="w-full bg-[var(--bg-secondary)] rounded pl-8 pr-2 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
              />
            </div>

            {#if canSendRequest}
              <button
                onclick={() => handleSendRequest(searchQuery)}
                disabled={sending}
                class="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] cursor-pointer disabled:opacity-60 disabled:cursor-default"
              >
                {#if sending}
                  <Loader2 size={14} class="animate-spin flex-shrink-0" />
                {:else}
                  <UserPlus size={14} strokeWidth={2.5} class="flex-shrink-0" />
                {/if}
                <span class="truncate">Send request to <span class="font-semibold text-[var(--text-primary)]">{searchQuery.trim()}</span></span>
              </button>
            {/if}
            {#if sendError}
              <p class="text-xs text-red-400 px-1">{sendError}</p>
            {:else if sendSuccess}
              <p class="text-xs text-[#16a34a] px-1">{sendSuccess}</p>
            {/if}
          </div>

          <div class="flex-1 overflow-y-auto px-1 pt-1 pb-2">
            {#if requests.length > 0}
              <div class="rounded-md bg-[var(--bg-secondary)] divide-y divide-[var(--bg-tertiary)]">
                {#each requests as req (req.id)}
                  <div class="flex items-center gap-2 px-2 py-1.5">
                    <img
                      src="https://avatar.mcindex.net/avatar/{req.from_username}/24"
                      alt={req.from_username}
                      class="w-6 h-6 rounded object-cover flex-shrink-0"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="text-sm text-[var(--text-primary)] truncate font-medium leading-tight">{req.from_username}</div>
                      <div class="text-[11px] text-[var(--text-muted)] leading-tight">Wants to be friends</div>
                    </div>
                    <button
                      onclick={() => handleAcceptRequest(req.id)}
                      class="p-1 rounded bg-[#16a34a]/15 text-[#16a34a] hover:bg-[#16a34a]/30 cursor-pointer"
                      title="Accept"
                    >
                      <Check size={14} strokeWidth={3} />
                    </button>
                    <button
                      onclick={() => handleRejectRequest(req.id)}
                      class="p-1 rounded bg-red-500/15 text-red-400 hover:bg-red-500/30 cursor-pointer"
                      title="Decline"
                    >
                      <X size={14} strokeWidth={3} />
                    </button>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="flex flex-col items-center justify-center py-10 text-center px-3">
                <Inbox size={32} class="text-[var(--text-muted)] mb-3" />
                <p class="text-sm text-[var(--text-secondary)] font-medium">No pending requests</p>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

{#if friendMenu}
  {@const fm = friendMenu}
  <ContextMenu
    x={fm.x}
    y={fm.y}
    onClose={() => friendMenu = null}
    items={[
      { label: isFavorite(fm.friend.uuid) ? "Remove from favorites" : "Add to favorites", icon: Star, onClick: () => toggleFavorite(fm.friend.uuid) },
      { label: "Set nickname", icon: Pencil, onClick: () => startNickname(fm.friend) },
      { separator: true },
      { label: "Remove friend", icon: UserX, onClick: () => handleRemoveFriend(fm.friend.uuid), danger: true },
    ]}
  />
{/if}
