<script lang="ts">
  import { MoreHorizontal } from "lucide-svelte"
  import type { Friend } from "../../../types"

  let {
    friend, nickname, online, status, editing, draft = $bindable(), menuOpen,
    onSave, onCancelEdit, onOpenMenu,
  }: {
    friend: Friend
    nickname: string | undefined
    online: boolean
    status: { color: string; label: string }
    editing: boolean
    draft: string
    menuOpen: boolean
    onSave: (value: string) => void
    onCancelEdit: () => void
    onOpenMenu: (e: MouseEvent) => void
  } = $props()

  const avatarMask = "-webkit-mask-image: radial-gradient(circle 8px at 29px 28px, transparent 7.5px, #000 8px); mask-image: radial-gradient(circle 8px at 29px 28px, transparent 7.5px, #000 8px);"

  let nicknameInput = $state<HTMLInputElement | undefined>()

  $effect(() => {
    if (editing && nicknameInput) nicknameInput.focus()
  })
</script>

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
    {#if editing}
      <input
        type="text"
        bind:this={nicknameInput}
        bind:value={draft}
        maxlength={32}
        placeholder={friend.username}
        onkeydown={(e) => {
          if (e.key === "Enter") onSave(draft)
          else if (e.key === "Escape") onCancelEdit()
        }}
        onblur={() => onSave(draft)}
        class="block w-full min-w-0 h-5 bg-[var(--bg-secondary)] rounded px-1 -mx-1 py-0 text-base leading-5 font-medium text-[var(--text-primary)] focus:outline-none"
      />
    {:else}
      <div
        class="h-5 text-base leading-5 text-[var(--text-primary)] truncate font-medium"
        title={nickname ? friend.username : undefined}
      >
        {nickname || friend.username}
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
    onmousedown={(e) => { if (menuOpen) e.stopPropagation() }}
    onclick={(e) => onOpenMenu(e)}
    class="flex-shrink-0 p-1 rounded cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:opacity-100 {menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}"
  >
    <MoreHorizontal size={16} strokeWidth={2.5} />
  </button>
</div>
