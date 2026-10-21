<script lang="ts">
  import { Loader2 } from "lucide-svelte"
  import { fly } from "svelte/transition"
  import { cubicIn, cubicOut } from "svelte/easing"

  let { navDir, username, isSigningIn, onSignIn }: {
    navDir: number
    username: string | null
    isSigningIn: boolean
    onSignIn: () => void
  } = $props()
</script>

<div class="col-start-1 row-start-1 flex flex-col justify-center text-center" in:fly={{ x: 72 * navDir, duration: 420, delay: 200, easing: cubicOut }} out:fly={{ x: -72 * navDir, duration: 300, easing: cubicIn }}>
  <h1 class="text-3xl font-semibold text-[var(--text-primary)] tracking-tight">Welcome to Octane</h1>
  <p class="mt-3 text-sm text-[var(--text-muted)] leading-relaxed">
    Sign in with Microsoft to play with friends, or continue without an account.
    You can sign in at any time.
  </p>

  {#if username}
    <div class="mt-10 mx-auto w-64 space-y-2.5">
      <div class="px-4 py-1.5 rounded-md bg-[var(--bg-hover)] text-sm font-medium text-[var(--text-primary)] flex items-center justify-center gap-2 min-h-[34px]">
        <img
          src="https://avatar.mcindex.net/avatar/{username}/32"
          alt=""
          aria-hidden="true"
          class="w-[18px] h-[18px] rounded-sm flex-shrink-0"
        />
        <span class="truncate">Signed in as {username}</span>
      </div>
      <button
        onclick={onSignIn}
        disabled={isSigningIn}
        class="w-full px-4 py-1.5 rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-60 text-white text-sm font-medium cursor-pointer flex items-center justify-center gap-2 min-h-[34px]"
      >
        {#if isSigningIn}
          <Loader2 size={15} class="animate-spin" />
          Waiting for browser...
        {:else}
          Sign in with another account
        {/if}
      </button>
    </div>
  {:else}
    <button
      onclick={onSignIn}
      disabled={isSigningIn}
      class="mt-10 mx-auto w-64 px-4 py-1.5 rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-60 text-white text-sm font-medium cursor-pointer flex items-center justify-center gap-2"
    >
      {#if isSigningIn}
        <Loader2 size={15} class="animate-spin" />
        Waiting for browser...
      {:else}
        <img src="/microsoft.svg" alt="" aria-hidden="true" class="w-[18px] h-[18px]" />
        Sign in with Microsoft
      {/if}
    </button>
  {/if}
</div>
