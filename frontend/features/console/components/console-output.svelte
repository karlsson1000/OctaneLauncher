<script lang="ts">
  import { SquareTerminal } from "lucide-svelte"
  import type { ConsoleLog } from "../../../types"
  import { getLogClass, getLogTime, highlightParts } from "./console-log"

  let { logs, searchQuery, hasAnyLogs, activeInstance }: {
    logs: ConsoleLog[]
    searchQuery: string
    hasAnyLogs: boolean
    activeInstance: string | null
  } = $props()

  const ASCII = `
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⠴⠒⠒⠒⠲⢤⣄
⠀⠀⠀⠀⠀⠀⣀⡠⠤⠤⠤⠤⠤⠤⠔⠋⠁⠀⠀⠀⠀⠀⠀⠈⢧⡀
⠀⠀⠀⠀⢀⡾⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢷
⠀⠀⠀⢠⠏⠀⠀⠀⠀⠀⠀⠀⠀⠀⣦⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⡇
⠀⡔⠒⡿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠁⠀⠀⠀⠀⠀⠀⢀⢄⣴⣮⣼⠸⡄
⠘⣴⣿⣷⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⢣⣿⣟⣿⣿⡏⡇
⠀⠀⠉⠳⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣧⣾⣿⣿⣿⣿⡇⡇
⠀⠀⠀⠀⠀⠉⠒⠠⢄⣀⠀⠀⠀⠀⠀⠀⠀⠀⢸⢻⣻⣿⣿⣿⢿⡹⠁
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠲⣄⠀⠀⠀⣠⠔⠛⣎⡻⠿⢿⣫⠞⠁
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢰⣿⣿⣿⣿⠁⠀⠀⠀⠉⠉⠉
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡴⠃⠀⠈⠉⢻⠁
⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⠞⠀⠀⠀⡄⠂⠈⡇
⠀⠀⠀⠀⠀⠀⠀⠀⢠⡏⠀⠀⠀⠸⠀⠀⠀⣿
⠀⠀⠀⠀⠀⠀⠀⠀⣾⠁⠀⠀⠀⡇⠀⠀⠘⡟⡇
⠀⠀⠀⠀⠀⠀⠀⠀⠻⣦⠀⠀⠀⣇⠀⢠⣸⣷⣧⢀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠲⠀⠈⡉⠉⠀⡏⠣⠬⠭⠤⠄
⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣀⣰⠁⠀⡇⠀⠀⣇
⠀⠀⠀⠀⠀⠀⡔⢊⢉⠤⠒⠛⠒⠲⠃⠀⠀⠻⣄
⠀⠀⠀⠀⠀⠀⠧⣧⣧⢀⡔⠀⡄⠀⠀⠀⠀⠀⠀⣱
⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠑⠚⠛⠒⠓⠚⠈⠊⠉⠁
`;

  let containerEl = $state<HTMLDivElement>()
  const scrollPositions = new Map<string, number>()
  const pinned = new Map<string, boolean>()

  let filteredLogs = $derived(
    searchQuery.trim() === ""
      ? logs
      : logs.filter(l => l.message.toLowerCase().includes(searchQuery.trim().toLowerCase()))
  )

  $effect(() => {
    void filteredLogs.length
    const inst = activeInstance
    if (!containerEl || !inst) return
    containerEl.scrollTop = (pinned.get(inst) ?? true) ? containerEl.scrollHeight : (scrollPositions.get(inst) ?? 0)
  })

  function handleScroll() {
    if (!containerEl || !activeInstance) return
    scrollPositions.set(activeInstance, containerEl.scrollTop)
    pinned.set(activeInstance, containerEl.scrollHeight - containerEl.scrollTop - containerEl.clientHeight < 40)
  }
</script>

<div class="bg-[var(--bg-tertiary)] rounded-lg overflow-hidden" style="height: calc(100vh - 250px)">
  {#if !hasAnyLogs}
    <div class="h-full flex items-center justify-center">
      <div class="text-center">
        <pre class="font-mono text-xs text-[var(--accent-primary)] select-none text-left">{ASCII}</pre>
        <p class="text-base text-[var(--text-primary)] mt-4 mb-1">No console output yet</p>
        <p class="text-sm text-[var(--text-muted)]">Launch an instance to see logs</p>
      </div>
    </div>
  {:else if !activeInstance}
    <div class="h-full flex items-center justify-center">
      <div class="text-center">
        <SquareTerminal size={48} class="text-[var(--text-muted)] mx-auto mb-3" strokeWidth={1.5} />
        <p class="text-base text-[var(--text-primary)] mb-1">No instance selected</p>
        <p class="text-sm text-[var(--text-muted)]">Select an instance tab above</p>
      </div>
    </div>
  {:else if filteredLogs.length === 0 && searchQuery.trim() !== ""}
    <div class="h-full flex items-center justify-center">
      <div class="text-center">
        <p class="text-base text-[var(--text-primary)] mb-1">No matching lines</p>
        <p class="text-sm text-[var(--text-muted)]">Try a different search query</p>
      </div>
    </div>
  {:else}
    <div class="h-full overflow-y-auto p-4 font-mono text-sm" bind:this={containerEl} onscroll={handleScroll}>
      {#each filteredLogs as log}
        <div class="py-0.5 leading-relaxed log-line {getLogClass(log)}">
          <span class="text-[var(--text-muted)] mr-2">{getLogTime(log)}</span>
          <span class="text-[#16a34a] mr-2">[{log.instance}]</span>
          <span>{#each highlightParts(log.message, searchQuery) as part}{#if part.match}<span class="bg-yellow-400/30 rounded-[2px]">{part.text}</span>{:else}{part.text}{/if}{/each}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .log-line {
    animation: log-in 0.12s ease-out;
  }

  @keyframes log-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .log-line {
      animation: none;
    }
  }
</style>
