<script lang="ts">
  import { User } from "lucide-svelte"
</script>

<div class="p-8 space-y-4">
  <div class="max-w-7xl mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">Sign In</h1>
    </div>
    <div class="flex flex-col items-center justify-center min-h-[calc(100vh-300px)]">
      <User size={64} class="text-[var(--accent-primary)] mb-4" strokeWidth={1.5} />
      <h3 class="text-lg font-semibold text-[var(--text-primary)] mb-1">Sign In Required</h3>
      <p class="text-sm text-[var(--text-muted)]">
        Please sign in with your Microsoft account to manage your skin
      </p>
    </div>
  </div>
</div>
