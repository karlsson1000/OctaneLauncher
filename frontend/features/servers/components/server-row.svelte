<script lang="ts">
  import { Server, Trash2, Play, ArrowUp, ArrowDown } from "lucide-svelte"
  import type { ServerInfo } from "../../../types"
  import { formatAddress, joinButtonClass, pingColor, ROW_HEIGHT } from "./server-utils"

  let { server, index, total, isFiltering, isAnyInstanceRunning, launching, onMove, onDelete, onLaunch }: {
    server: ServerInfo
    index: number
    total: number
    isFiltering: boolean
    isAnyInstanceRunning: boolean
    launching: boolean
    onMove: (direction: -1 | 1) => void
    onDelete: () => void
    onLaunch: (e: MouseEvent) => void
  } = $props()

  let isOnline = $derived(server.status === "online")
  let isDisabled = $derived(!isOnline || launching || isAnyInstanceRunning)
  let showPlayers = $derived(isOnline && server.players_online !== undefined)
</script>

<div
  class="group flex items-center gap-3 px-4 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]"
  style="height: {ROW_HEIGHT}px"
>
  <div class="flex-shrink-0 flex flex-col gap-1">
    <button
      onclick={() => onMove(-1)}
      disabled={isFiltering || index === 0}
      aria-label="Move up"
      title="Move up"
      class="w-8 h-8 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover-strong)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[var(--text-muted)]"
    >
      <ArrowUp size={20} strokeWidth={3} />
    </button>
    <button
      onclick={() => onMove(1)}
      disabled={isFiltering || index === total - 1}
      aria-label="Move down"
      title="Move down"
      class="w-8 h-8 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover-strong)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[var(--text-muted)]"
    >
      <ArrowDown size={20} strokeWidth={3} />
    </button>
  </div>

  <div class="flex-shrink-0">
    {#if server.favicon}
      <img
        src={server.favicon}
        alt={server.name}
        class="w-20 h-20 rounded object-cover"
        style="image-rendering: pixelated"
      />
    {:else}
      <div class="w-20 h-20 bg-[var(--bg-secondary)] rounded flex items-center justify-center">
        <Server size={40} class="text-[var(--text-muted)]" strokeWidth={2} />
      </div>
    {/if}
  </div>

  <div class="flex-1 min-w-0">
    <p class="font-semibold text-xl text-[var(--text-primary)] truncate leading-none mb-2">{server.name}</p>
    {#if server.motd_html}
      {#each server.motd_html.slice(0, 2) as line}
        <p class="text-base truncate leading-snug">{@html line}</p>
      {/each}
    {:else if server.motd}
      {#each server.motd.split("\n").slice(0, 2) as line}
        <p class="text-base text-[var(--text-muted)] truncate leading-snug">{line}</p>
      {/each}
    {:else}
      <p class="text-base text-[var(--text-muted)] truncate">{formatAddress(server.address, server.port)}</p>
    {/if}
  </div>

  <div class="flex-shrink-0 flex flex-col items-end gap-2 group-hover:hidden">
    {#if isOnline}
      {#if server.ping === undefined}
        <span class="text-base font-medium text-[var(--text-muted)]">N/A</span>
      {:else}
        <span class="text-base font-medium" style="color: {pingColor(server.ping)}">{server.ping}ms</span>
      {/if}
    {/if}
    {#if showPlayers}
      <span class="text-base text-[var(--text-muted)]">
        {server.players_online}/{server.players_max}
      </span>
    {:else if server.status === "offline"}
      <span class="text-base font-medium text-[#ef4444]">Offline</span>
    {:else}
      <span class="text-base font-medium text-[var(--text-muted)]">-</span>
    {/if}
  </div>

  <div class="flex-shrink-0 items-center gap-2 hidden group-hover:flex">
    <button
      onclick={(e) => { e.stopPropagation(); onDelete() }}
      aria-label="Remove server"
      class="w-10 h-10 flex items-center justify-center rounded-md cursor-pointer shrink-0 text-[var(--text-secondary)] hover:bg-[var(--bg-hover-strong)] hover:text-red-400"
    >
      <Trash2 size={20} strokeWidth={2.5} />
    </button>

    <button
      onclick={onLaunch}
      disabled={isDisabled}
      title={!isOnline ? "Server offline" : launching ? "Launching..." : isAnyInstanceRunning ? "Instance already running" : undefined}
      class="flex-shrink-0 h-10 px-8 flex items-center justify-center gap-3 rounded cursor-pointer disabled:opacity-50 {joinButtonClass(launching, isOnline)}"
    >
      {#if launching}
        <div class="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
      {:else}
        <Play size={18} fill="currentColor" strokeWidth={0} />
        <span class="text-base font-semibold">Join</span>
      {/if}
    </button>
  </div>
</div>
