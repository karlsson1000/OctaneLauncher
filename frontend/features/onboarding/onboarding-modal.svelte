<script lang="ts">
  import { onMount } from "svelte"
  import { fade } from "svelte/transition"
  import { invoke } from "@tauri-apps/api/core"
  import type { ImportableInstance } from "../../types"
  import {
    store,
    loadAccounts,
    loadInstances,
    setShowOnboarding,
    generateUniqueName,
  } from "../../lib/launcherStore.svelte"
  import StepProgress from "./components/step-progress.svelte"
  import WelcomeStep from "./components/welcome-step.svelte"
  import ImportStep from "./components/import-step.svelte"
  import DoneStep from "./components/done-step.svelte"

  type OnboardingStep = "welcome" | "import" | "done"

  const STEP_ORDER: Record<OnboardingStep, number> = { welcome: 0, import: 1, done: 2 }

  let step = $state<OnboardingStep>("welcome")
  let navDir = $state(1)
  let detected = $state<ImportableInstance[]>([])
  let isDetecting = $state(true)
  let detectFailed = $state(false)
  let isSigningIn = $state(false)
  let isImporting = $state(false)
  let importedCount = $state(0)

  let selected = $state<Record<string, boolean>>({})
  let itemStatus = $state<Record<string, "importing" | "done" | "error">>({})

  onMount(() => {
    detect()
  })

  async function detect() {
    isDetecting = true
    detectFailed = false
    try {
      detected = await invoke<ImportableInstance[]>("detect_importable_instances")
      const nextSelected: Record<string, boolean> = {}
      for (const item of detected) {
        nextSelected[item.path] = !!item.mc_version
      }
      selected = nextSelected
    } catch {
      detectFailed = true
    } finally {
      isDetecting = false
    }
  }

  function getSelectedItems(): ImportableInstance[] {
    return detected.filter(d => selected[d.path])
  }

  async function handleSignIn() {
    isSigningIn = true
    try {
      await invoke("microsoft_login_and_store")
      await loadAccounts()
      if (store.activeAccount) goTo("import")
    } catch {}
    isSigningIn = false
  }

  let usedNames = new Set<string>()

  function uniqueTargetName(base: string): string {
    let candidate = generateUniqueName(base)
    let n = 2
    while (usedNames.has(candidate)) {
      candidate = `${base} (${n++})`
    }
    usedNames.add(candidate)
    return candidate
  }

  async function handleImport() {
    const items = getSelectedItems()
    if (items.length === 0) return

    isImporting = true
    usedNames = new Set(store.instances.map(i => i.name))
    importedCount = 0

    for (const item of items) {
      const targetName = uniqueTargetName(item.name)
      itemStatus[item.path] = "importing"
      store.creatingInstanceName = targetName

      try {
        await invoke("import_instance", {
          source: item.source,
          sourcePath: item.path,
          name: item.name,
          targetName,
          mcVersion: item.mc_version,
          loader: item.loader,
          loaderVersion: item.loader_version,
          iconPath: item.icon_path,
        })
        itemStatus[item.path] = "done"
        importedCount++
      } catch (error) {
        itemStatus[item.path] = "error"
      }
    }

    await loadInstances()
    store.creatingInstanceName = null
    isImporting = false
    goTo("done")
  }

  function finish() {
    setShowOnboarding(false)
  }

  function goTo(next: OnboardingStep) {
    if (next === step) return
    navDir = STEP_ORDER[next] > STEP_ORDER[step] ? 1 : -1
    step = next
  }

  function skipStep() {
    if (step === "welcome") goTo("import")
    else if (step === "import") goTo("done")
  }
</script>

<div transition:fade={{ duration: 150 }} class="fixed inset-0 z-50 bg-[var(--bg-primary)] flex flex-col overflow-hidden">
  {#if step === "welcome"}
    <div class="absolute inset-0 pointer-events-none select-none" transition:fade={{ duration: 250 }}>
      <img src="/logo.png" alt="" aria-hidden="true" class="absolute left-1/2 -translate-x-[16vmin] -bottom-[60vmin] w-[150vmin] h-[150vmin] object-contain opacity-[0.04]" />
    </div>
  {/if}

  <header class="flex items-center justify-between px-8 py-6 flex-shrink-0">
    <div class="flex items-center gap-2">
      <img src="/logo.png" alt="Octane" class="h-5 w-5" />
      <span class="text-sm font-semibold text-[var(--text-secondary)]">Octane Launcher</span>
    </div>
    <StepProgress {step} />
  </header>

  <main class="flex-1 min-h-0 flex items-center justify-center px-8 pb-16">
    <div class="grid w-full max-w-lg">
      {#if step === "welcome"}
        <WelcomeStep
          {navDir}
          username={store.activeAccount?.username ?? null}
          {isSigningIn}
          onSignIn={handleSignIn}
        />
      {:else if step === "import"}
        <ImportStep
          {navDir}
          {detected}
          {isDetecting}
          {detectFailed}
          {isImporting}
          {itemStatus}
          bind:selected
          onBack={() => goTo("welcome")}
          onImport={handleImport}
          onGetStarted={() => goTo("done")}
        />
      {:else}
        <DoneStep {navDir} {importedCount} onFinish={finish} />
      {/if}
    </div>
  </main>

  {#if step !== "done"}
    <button
      onclick={skipStep}
      disabled={isImporting}
      class="fixed bottom-6 right-8 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer disabled:opacity-40"
    >
      Skip
    </button>
  {/if}
</div>
