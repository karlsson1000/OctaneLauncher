<script lang="ts">
  import type { Instance } from "../../../types"
  import PackSection from "./pack-section.svelte"

  let { instance }: { instance: Instance } = $props()
</script>

<PackSection {instance} kind="resource" />
