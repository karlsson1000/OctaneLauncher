<script lang="ts">
  import { fly } from "svelte/transition"
  import { cubicIn, cubicOut } from "svelte/easing"

  let { navDir, importedCount, onFinish }: {
    navDir: number
    importedCount: number
    onFinish: () => void
  } = $props()
</script>

<div class="col-start-1 row-start-1 flex flex-col justify-center text-center" in:fly={{ x: 72 * navDir, duration: 420, delay: 200, easing: cubicOut }} out:fly={{ x: -72 * navDir, duration: 300, easing: cubicIn }}>
  <svg class="onboard-check mx-auto" viewBox="0 0 72 72" aria-hidden="true">
    <path d="M22 37 L32 47 L50 27"/>
  </svg>
  <h1 class="mt-1 text-2xl font-semibold text-[var(--text-primary)] tracking-tight">You're all set</h1>
  <p class="mt-3 text-sm text-[var(--text-muted)] leading-relaxed">
    {#if importedCount > 0}
      Imported {importedCount} {importedCount === 1 ? "instance" : "instances"} from your other launchers.
    {:else}
      Create your first instance from the Instances tab, or browse mods in the Addons tab.
    {/if}
  </p>
  <button
    onclick={onFinish}
    class="self-center mt-6 px-8 py-1.5 rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium cursor-pointer"
  >
    Get started
  </button>
</div>

<style>
  .onboard-check {
    width: 112px;
    height: 112px;
    margin-bottom: -14px;
  }

  .onboard-check path {
    fill: none;
    stroke: var(--accent-primary);
    stroke-width: 3.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 48;
    stroke-dashoffset: 48;
    animation: draw-check 0.35s ease-out 0.62s forwards;
  }

  @keyframes draw-check {
    to { stroke-dashoffset: 0; }
  }
</style>
