<script lang="ts">
  import { tick } from "svelte"
  import { invoke } from "@tauri-apps/api/core"
  import { UserX, Pencil, Star, LogIn } from "lucide-svelte"
  import type { Friend, FriendRequest } from "../../types"
  import { storeGet, storeSet } from "../../lib/store"
  import ContextMenu from "../../components/ui/context-menu.svelte"
  import AccountSwitcher from "./components/account-switcher.svelte"
  import FriendsTab from "./components/friends-tab.svelte"
  import RequestsTab from "./components/requests-tab.svelte"

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
  let searchInput: HTMLInputElement | undefined = $state()
  let friendMenu = $state<{ x: number; y: number; friend: Friend } | null>(null)
  let collapsed = $state<Record<string, boolean>>({})
  let tab = $state<"friends" | "requests">("friends")
  let dataAccountUuid: string | undefined | null = null

  const storeKey = (prefix: string) => `${prefix}_${activeAccountUuid ?? "default"}`

  const displayName = (friend: Friend) => nicknames[friend.uuid] || friend.username
  const isFavorite = (friendUuid: string) => favorites.includes(friendUuid)
  const isOnline = (friend: Friend) => friend.status === "online" || friend.status === "ingame"

  const statuses: Record<string, { color: string, label: string }> = {
    ingame: { color: "bg-[#3b82f6]", label: "In game" },
    online: { color: "bg-[#16a34a]", label: "Online" },
    offline: { color: "bg-[var(--bg-hover-strong)]", label: "Offline" },
  }

  const statusOf = (friend: Friend) => statuses[friend.status]

  const tabButton = (active: boolean) =>
    `h-8 flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded text-base font-semibold cursor-pointer ${active ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"}`

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

  function handleOpenFriendMenu(e: MouseEvent, friend: Friend) {
    if (friendMenu?.friend.uuid === friend.uuid) friendMenu = null
    else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      friendMenu = { x: rect.left, y: rect.bottom + 4, friend }
    }
  }

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
      const byStatus = order[a.status] - order[b.status]
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

<div
  class="flex-shrink-0 bg-[var(--bg-primary)] h-full overflow-hidden transition-all duration-200 ease-in-out {isOpen ? 'w-60' : 'w-0 -mr-4'}"
>
  <div class="w-60 h-full flex flex-col">
    <AccountSwitcher {isOpen} />

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
          <FriendsTab
            {friends}
            {isLoading}
            {favoriteFriends}
            {onlineFriends}
            {offlineFriends}
            bind:collapsed
            onToggleCollapsed={toggleCollapsed}
            nicknameOf={(f) => nicknames[f.uuid]}
            {isOnline}
            {statusOf}
            editingUuid={editingNicknameUuid}
            bind:draft={nicknameDraft}
            menuUuid={friendMenu?.friend.uuid}
            onSave={(friend, value) => saveNickname(friend.uuid, value)}
            onCancelEdit={() => (editingNicknameUuid = null)}
            onOpenMenu={handleOpenFriendMenu}
            onGoToAddFriend={goToAddFriend}
          />
        {:else}
          <RequestsTab
            {requests}
            {sending}
            {sendError}
            {sendSuccess}
            bind:searchQuery
            bind:searchInput
            {canSendRequest}
            onSend={handleSendRequest}
            onAccept={handleAcceptRequest}
            onReject={handleRejectRequest}
            onInput={() => { sendError = null; sendSuccess = null }}
            onClearSearch={clearSearch}
          />
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
