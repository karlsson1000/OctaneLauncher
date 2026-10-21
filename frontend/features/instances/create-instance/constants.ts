export interface MinecraftVersion {
  id: string
  type: "release" | "snapshot"
}

export type LoaderType = "vanilla" | "fabric" | "neoforge" | "forge"
export type CreateStep = "name" | "version" | "loader"

export const STEPS: CreateStep[] = ["name", "version", "loader"]
export const STEP_ORDER: Record<CreateStep, number> = { name: 0, version: 1, loader: 2 }

export const LOADERS: { id: LoaderType; label: string; bg: string }[] = [
  { id: "vanilla", label: "Vanilla", bg: "bg-[#16a34a]" },
  { id: "fabric", label: "Fabric", bg: "bg-[#3b82f6]" },
  { id: "neoforge", label: "NeoForge", bg: "bg-[#f97316]" },
  { id: "forge", label: "Forge", bg: "bg-[#e05d2e]" },
]
