<script lang="ts">
  import { Users, UserPlus, ChevronDown } from "lucide-svelte"
  import type { Friend } from "../../../types"
  import FriendRow from "./friend-row.svelte"

  let {
    friends, isLoading, favoriteFriends, onlineFriends, offlineFriends,
    collapsed = $bindable(), onToggleCollapsed,
    nicknameOf, isOnline, statusOf,
    editingUuid, draft = $bindable(), menuUuid,
    onSave, onCancelEdit, onOpenMenu, onGoToAddFriend,
  }: {
    friends: Friend[]
    isLoading: boolean
    favoriteFriends: Friend[]
    onlineFriends: Friend[]
    offlineFriends: Friend[]
    collapsed: Record<string, boolean>
    onToggleCollapsed: (key: string) => void
    nicknameOf: (friend: Friend) => string | undefined
    isOnline: (friend: Friend) => boolean
    statusOf: (friend: Friend) => { color: string; label: string }
    editingUuid: string | null
    draft: string
    menuUuid: string | undefined
    onSave: (friend: Friend, value: string) => void
    onCancelEdit: () => void
    onOpenMenu: (e: MouseEvent, friend: Friend) => void
    onGoToAddFriend: () => void
  } = $props()

  const skeletonWidths = [76, 54, 68, 48, 72, 58]
</script>

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
          onclick={() => onToggleCollapsed(key)}
          onkeydown={(e) => { if (e.key === 'Enter') onToggleCollapsed(key) }}
        >{label} ({list.length})</span>
      </div>
      {#if !collapsed[key]}
        <div class="space-y-0.5">
          {#each list as friend (friend.uuid)}
            <FriendRow
              {friend}
              nickname={nicknameOf(friend)}
              online={isOnline(friend)}
              status={statusOf(friend)}
              editing={editingUuid === friend.uuid}
              bind:draft
              menuOpen={menuUuid === friend.uuid}
              onSave={(value) => onSave(friend, value)}
              {onCancelEdit}
              onOpenMenu={(e) => onOpenMenu(e, friend)}
            />
          {/each}
        </div>
      {/if}
    </section>
  {/if}
{/snippet}

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
              <div class="h-2.5 rounded bg-[var(--bg-tertiary)]" style="width: {skeletonWidths[i]}px"></div>
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
        onclick={onGoToAddFriend}
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
