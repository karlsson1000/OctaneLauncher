<script lang="ts">
  import { Search, Loader2, UserPlus, Check, X, Inbox } from "lucide-svelte"
  import type { FriendRequest } from "../../../types"

  let {
    requests, sending, sendError, sendSuccess, searchQuery = $bindable(), searchInput = $bindable(),
    canSendRequest, onSend, onAccept, onReject, onInput, onClearSearch,
  }: {
    requests: FriendRequest[]
    sending: boolean
    sendError: string | null
    sendSuccess: string | null
    searchQuery: string
    searchInput: HTMLInputElement | undefined
    canSendRequest: boolean
    onSend: (username: string) => void
    onAccept: (requestId: string) => void
    onReject: (requestId: string) => void
    onInput: () => void
    onClearSearch: () => void
  } = $props()
</script>

<div class="px-1 pt-1 pb-1 space-y-1">
  <div class="relative">
    <Search size={14} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
    <input
      type="text"
      bind:this={searchInput}
      placeholder="Add a friend"
      bind:value={searchQuery}
      oninput={onInput}
      onkeydown={(e) => {
        if (e.key === "Enter" && canSendRequest) onSend(searchQuery)
        else if (e.key === "Escape") onClearSearch()
      }}
      class="w-full bg-[var(--bg-secondary)] rounded pl-8 pr-2 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
    />
  </div>

  {#if canSendRequest}
    <button
      onclick={() => onSend(searchQuery)}
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
            onclick={() => onAccept(req.id)}
            class="p-1 rounded bg-[#16a34a]/15 text-[#16a34a] hover:bg-[#16a34a]/30 cursor-pointer"
            title="Accept"
          >
            <Check size={14} strokeWidth={3} />
          </button>
          <button
            onclick={() => onReject(req.id)}
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
      <p class="text-sm text-[var(--text-muted)] font-medium">No pending requests</p>
    </div>
  {/if}
</div>
